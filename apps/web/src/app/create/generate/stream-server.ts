import type { CommandRunner } from '@buildit/exec';
import { generateProject } from '@buildit/generator';
import { parseManifest } from '@buildit/manifest';
import { detectProject, formatCommand, installCommand } from '@buildit/workspace';
import { registerGenerated } from '../../../lib/output-registry';
import type { SessionDeps } from '../../github/session';
import { installProject } from '../../open/project';
import { type CreateRepositoryResult, createRepository } from '../../repo/sharing';
import { checkOutputDestination, HOSTED_FOLDER_REFUSAL } from './output-destination';

/**
 * La génération dans un dossier choisi, **en flux** la logique de la route
 * `POST /api/generate`, sans Next.
 *
 * Séparée de la route pour une seule raison : se prouver avec un vrai dossier
 * temporaire et un faux exécuteur, sans monter de serveur. La route ne fait
 * qu'empaqueter ces événements en `text/event-stream`.
 *
 * L'ordre des événements est le contrat de l'écran :
 * `writing` → `written` (fichiers, octets) → éventuellement `installing` →
 * `done`. Un refus (hébergé, manifest invalide, dossier pris) saute
 * directement à `done` : rien n'a été écrit, et l'écran ne doit rien annoncer
 * d'autre. `done` arrive **toujours**, même sur une panne imprévue.
 */

export type GenerateStreamEvent =
  | { readonly type: 'phase'; readonly phase: 'writing' }
  | {
      readonly type: 'written';
      readonly directory: string;
      readonly files: number;
      readonly bytes: number;
    }
  | { readonly type: 'phase'; readonly phase: 'installing'; readonly command?: string }
  | GenerateDoneEvent;

export interface GenerateDoneEvent {
  readonly type: 'done';
  /** Le projet est sur le disque. Vrai même si l'installation a échoué ensuite. */
  readonly ok: boolean;
  readonly directory: string;
  readonly files: readonly string[];
  readonly bytes: number;
  readonly warnings: readonly string[];
  readonly steps: readonly string[];
  /** Les refus de la génération : rien n'a été écrit. */
  readonly issues: readonly string[];
  /** L'installation a été demandée. */
  readonly installRequested: boolean;
  /** L'installation a réellement abouti, jamais supposé. */
  readonly installed: boolean;
  /** La commande d'installation, telle que l'utilisateur la taperait. */
  readonly installCommand?: string;
  /** Pourquoi l'installation a échoué ; vide si elle a abouti ou n'a pas été demandée. */
  readonly installIssues: readonly string[];
  /** L'adresse du dépôt GitHub créé et poussé, quand on l'a demandé et qu'il a abouti. */
  readonly repositoryUrl?: string;
  /** Pourquoi la création du dépôt GitHub a échoué ; le projet, lui, reste écrit. */
  readonly githubIssues?: readonly string[];
}

export interface GenerateStreamDeps {
  readonly hosted: boolean;
  /** Le dossier de travail, où vit le registre des dossiers générés. */
  readonly registryRoot: string;
  /** L'exécuteur de l'installation, déjà privé des secrets du serveur. */
  readonly runner: CommandRunner;
  /** La session GitHub, pour créer le dépôt du projet si on l'a demandé. */
  readonly session?: SessionDeps;
}

function record(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

/**
 * Le nom du dépôt GitHub demandé par l'écran, réduit à une chaîne non vide.
 *
 * Le champ `github` est un objet hostile : seule une chaîne `name` non vide est
 * retenue, le reste est ignoré. La validation du nom (grammaire GitHub) est
 * faite plus loin par `createRepository`, qui refuse nommément ce qui ne passe
 * pas.
 */
function githubNameOf(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return undefined;
  }
  const name = (input as Record<string, unknown>)['name'];
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined;
}

function refusal(issues: readonly string[], directory = ''): GenerateDoneEvent {
  return {
    type: 'done',
    ok: false,
    directory,
    files: [],
    bytes: 0,
    warnings: [],
    steps: [],
    issues,
    installRequested: false,
    installed: false,
    installIssues: [],
  };
}

/** La commande que l'installation va lancer, pour l'annoncer avant qu'elle parte. */
async function announcedCommand(directory: string): Promise<string | undefined> {
  const detected = await detectProject(directory);
  if (!detected.ok) {
    return undefined;
  }
  const command = installCommand(detected.value);
  return command === undefined ? detected.value.manualCommand : formatCommand(command);
}

export async function runGenerateStream(
  body: unknown,
  deps: GenerateStreamDeps,
  send: (event: GenerateStreamEvent) => void,
): Promise<GenerateDoneEvent> {
  const finish = (event: GenerateDoneEvent): GenerateDoneEvent => {
    send(event);
    return event;
  };

  try {
    const input = record(body);
    // Le refus hébergé passe avant tout le reste : le chemin reçu désigne la
    // machine du visiteur, pas celle du serveur, et ne sera même pas lu.
    if (deps.hosted) {
      return finish(refusal([HOSTED_FOLDER_REFUSAL]));
    }
    const manifest = parseManifest(input['manifest']);
    if (!manifest.ok) {
      return finish(refusal(manifest.issues.map((issue) => issue.message)));
    }
    const destination = await checkOutputDestination(
      input['parent'],
      manifest.value.name,
      deps.hosted,
    );
    if (!destination.ok) {
      return finish(refusal(destination.issues));
    }
    const directory = destination.directory;
    const install = input['install'] === true;

    send({ type: 'phase', phase: 'writing' });
    const result = await generateProject(manifest.value, directory);
    if (!result.ok) {
      // Le moteur annule ce qu'il a commencé : un refus ne laisse rien.
      return finish(refusal(result.issues.map((issue) => issue.message)));
    }
    const { written, bytes } = result.value.report;
    const warnings = result.value.warnings.map((warning) => warning.message);
    send({ type: 'written', directory, files: written.length, bytes });

    try {
      await registerGenerated(deps.registryRoot, directory);
    } catch {
      // Le projet est écrit, c'est l'essentiel. Sans registre, il ne pourra
      // simplement pas être supprimé depuis BuildIt : c'est dit, pas caché.
      warnings.push(
        'Ce projet ne pourra pas être supprimé depuis BuildIt : le registre des projets générés n’a pas pu être mis à jour. Supprimez son dossier vous-même le jour venu.',
      );
    }

    let installed = false;
    let command: string | undefined;
    let installIssues: readonly string[] = [];
    if (install) {
      command = await announcedCommand(directory);
      send({
        type: 'phase',
        phase: 'installing',
        ...(command === undefined ? {} : { command }),
      });
      // Le projet vient d'être écrit par BuildIt : ses scripts sont les nôtres,
      // l'installation les exécute. `installProject` retire en plus les secrets
      // du serveur de l'environnement de l'enfant.
      try {
        const outcome = await installProject(directory, false, deps.runner);
        installed = outcome.ok;
        installIssues = outcome.issues;
        command = outcome.command === '' ? command : outcome.command;
      } catch {
        // Le gestionnaire n'a pas pu être lancé du tout (absent du PATH). Le
        // projet, lui, est écrit : on le dit, sans prétendre l'avoir installé.
        installIssues = [
          'Le gestionnaire de paquets n’a pas pu être lancé. Installez-le, puis relancez l’installation.',
        ];
      }
    }

    // GitHub est un choix, jamais une obligation (§20bis) : on ne crée le dépôt
    // que si l'écran l'a demandé avec un nom, et seulement une fois le projet
    // écrit et installé. Un échec du dépôt ne retire pas le projet du disque —
    // il est signalé à part, pour ne pas faire croire qu'il est connecté.
    let repositoryUrl: string | undefined;
    let githubIssues: readonly string[] = [];
    const githubName = githubNameOf(input['github']);
    if (githubName !== undefined) {
      if (deps.session === undefined) {
        githubIssues = ['La session GitHub n’est pas disponible : le dépôt n’a pas été créé.'];
      } else {
        const created: CreateRepositoryResult = await createRepository({
          directory,
          name: githubName,
          isPrivate: true,
          runner: deps.runner,
          deps: deps.session,
        });
        if (created.ok && created.url !== undefined) {
          repositoryUrl = created.url;
        } else {
          githubIssues = created.issues;
        }
      }
    }

    return finish({
      type: 'done',
      ok: true,
      directory,
      files: written,
      bytes,
      warnings,
      steps:
        install && installed
          ? [...result.value.completedSteps, 'install']
          : [...result.value.completedSteps],
      issues: [],
      installRequested: install,
      installed,
      ...(command === undefined ? {} : { installCommand: command }),
      installIssues,
      ...(repositoryUrl === undefined ? {} : { repositoryUrl }),
      ...(githubIssues.length === 0 ? {} : { githubIssues }),
    });
  } catch {
    return finish(
      refusal([
        'La génération s’est arrêtée sur une erreur inattendue. Vérifiez le dossier choisi, puis réessayez.',
      ]),
    );
  }
}

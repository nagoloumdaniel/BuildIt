import { stat } from 'node:fs/promises';
import { isAbsolute, normalize } from 'node:path';
import type { CommandRunner } from '@project-factory/exec';
import {
  type Detection,
  detectProject,
  formatCommand,
  install,
  installCommand,
} from '@project-factory/workspace';
import { describeIssues } from '../github/session';

/**
 * Un projet déjà sur la machine (§6.23, §18bis).
 *
 * Aucune analyse : `packages/workspace` lit les fichiers qui nomment
 * l'outillage, et ce module ne fait que rendre le résultat affichable et
 * n'exécuter l'installation **qu'après** confirmation explicite de l'appelant.
 *
 * Règle de chemin (§24) : un chemin venu du navigateur est validé avant tout
 * accès disque — absolu, sans caractère de contrôle, normalisé. Un dossier
 * relatif serait relatif à ce que Node décide, pas à ce que l'utilisateur croit.
 */

export type LocalPathResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly issues: readonly string[] };

const ABSOLUTE_ONLY =
  'Indiquez un chemin absolu, par exemple C:\\projets\\mon-projet ou /home/moi/mon-projet.';

/** Valide la forme d'un dossier local. L'existence est vérifiée au premier accès. */
export function resolveLocalDirectory(input: unknown): LocalPathResult {
  if (typeof input !== 'string' || input.trim() === '') {
    return { ok: false, issues: ['Indiquez le dossier du projet.'] };
  }
  const value = input.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, issues: ['Le chemin contient des caractères de contrôle.'] };
  }
  if (!isAbsolute(value)) {
    return { ok: false, issues: [ABSOLUTE_ONLY] };
  }
  return { ok: true, value: normalize(value) };
}

/** Le dossier existe et c'est un dossier ; sinon la phrase qui le dit, sans lever. */
export async function refuseMissingDirectory(directory: string): Promise<string | undefined> {
  try {
    const info = await stat(directory);
    return info.isDirectory() ? undefined : `« ${directory} » n’est pas un dossier.`;
  } catch {
    return `Le dossier ${directory} n’existe pas.`;
  }
}

/**
 * Ce qu'un projet local est, et d'où on le sait.
 *
 * `origin` est la phrase du CLI : « d'après pnpm-lock.yaml », ou « supposé »
 * quand rien ne le dit. `plainCommand` / `safeCommand` sont les deux commandes
 * possibles — avec et sans exécution des scripts du projet — pour que l'écran
 * montre exactement ce qu'il lancera.
 */
export interface ProjectSummaryView {
  readonly directory: string;
  readonly label: string;
  readonly ecosystem: string;
  readonly packageManager?: string;
  readonly packageManagerVersion?: string;
  readonly source: Detection['source'];
  readonly evidence: string;
  readonly origin: string;
  readonly warnings: readonly string[];
  /** `pnpm install`, tel que l'utilisateur le taperait. */
  readonly plainCommand?: string;
  readonly safeCommand?: string;
  /** Hors JavaScript : la commande à lancer soi-même (installation V1). */
  readonly manualCommand?: string;
  /** Ce qui suit la détection : « pnpm (d'après pnpm-lock.yaml) ». */
  readonly description: string;
}

function originOf(detection: Detection): string {
  if (detection.packageManager === undefined) {
    return `d’après ${detection.evidence}`;
  }
  return detection.source === 'assumed' ? 'supposé' : `d’après ${detection.evidence}`;
}

/** La phrase que le CLI affiche : « JavaScript / TypeScript — pnpm (d'après …) ». */
export function describeDetection(detection: Detection): string {
  if (detection.packageManager === undefined) {
    return `${detection.label} (${originOf(detection)})`;
  }
  return `${detection.label} — ${detection.packageManager} (${originOf(detection)})`;
}

export function toProjectSummary(detection: Detection, directory: string): ProjectSummaryView {
  const plain = installCommand(detection);
  const safe = installCommand(detection, { ignoreScripts: true });
  return {
    directory,
    label: detection.label,
    ecosystem: detection.ecosystem,
    ...(detection.packageManager === undefined ? {} : { packageManager: detection.packageManager }),
    ...(detection.packageManagerVersion === undefined
      ? {}
      : { packageManagerVersion: detection.packageManagerVersion }),
    source: detection.source,
    evidence: detection.evidence,
    origin: originOf(detection),
    warnings: [...detection.warnings],
    ...(plain === undefined ? {} : { plainCommand: formatCommand(plain) }),
    ...(safe === undefined ? {} : { safeCommand: formatCommand(safe) }),
    ...(detection.manualCommand === undefined ? {} : { manualCommand: detection.manualCommand }),
    description: describeDetection(detection),
  };
}

export type ProjectInspectionView =
  | { readonly ok: true; readonly value: ProjectSummaryView }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Reconnaît le projet de `directory`, sans rien écrire ni lancer.
 *
 * Un dossier sans manifeste reconnu n'est pas une panne : c'est le bloquant du
 * §6.23, et le message le dit.
 */
export async function inspectProject(directory: string): Promise<ProjectInspectionView> {
  const detected = await detectProject(directory);
  if (!detected.ok) {
    return { ok: false, issues: describeIssues(detected.issues) };
  }
  return { ok: true, value: toProjectSummary(detected.value, directory) };
}

export interface InstallResultView {
  readonly ok: boolean;
  readonly directory: string;
  /** La commande réellement lancée, telle qu'elle a été annoncée. */
  readonly command: string;
  readonly issues: readonly string[];
  readonly retryable: boolean;
}

/**
 * Les variables d'environnement du serveur qu'un projet n'a pas à voir.
 *
 * `packages/exec` laisse volontairement la commande hériter de `process.env` ;
 * or l'installation lance le `postinstall` d'un projet qu'on n'a pas écrit
 * (§18bis : « un dépôt cloné n'est pas du code de confiance »). Un `postinstall`
 * qui lit `process.env.PF_GITHUB_TOKEN` exfiltrerait le jeton du serveur.
 *
 * `PF_GIT_TOKEN` n'est **pas** ici : c'est la variable du helper d'authentification
 * Git, posée explicitement par `packages/git` pour la seule commande qui en a
 * besoin, et neutralisée par ce garde-fou si on l'y ajoutait.
 */
const SERVER_SECRETS = ['PF_GITHUB_TOKEN'] as const;

/**
 * Un exécuteur dont les commandes **enfants** ne reçoivent aucun secret du
 * serveur. Le nom de la variable reste présent, vidé : `packages/exec` empile
 * `process.env` puis `options.env`, on ne peut donc pas la retirer — mais le
 * code du projet y lit une chaîne vide.
 */
export function withoutServerSecrets(runner: CommandRunner): CommandRunner {
  const scrubbed: Readonly<Record<string, string>> = Object.fromEntries(
    SERVER_SECRETS.map((name) => [name, '']),
  );
  return {
    run: (command, args, cwd, options) =>
      runner.run(command, args, cwd, { ...options, env: { ...options?.env, ...scrubbed } }),
  };
}

/**
 * Lance l'installation. À n'appeler qu'après confirmation : c'est le seul
 * endroit qui exécute un script du projet, et `packages/workspace` porte la
 * politique (`--ignore-scripts`, erreurs passagères).
 *
 * Le garde-fou d'environnement est ici, et pas chez l'appelant : il vaut pour
 * l'écran « ouvrir un projet local » comme pour le clone, sans qu'aucun des
 * deux puisse l'oublier.
 */
export async function installProject(
  directory: string,
  ignoreScripts: boolean,
  runner: CommandRunner,
): Promise<InstallResultView> {
  const detected = await detectProject(directory);
  if (!detected.ok) {
    return {
      ok: false,
      directory,
      command: '',
      issues: describeIssues(detected.issues),
      retryable: false,
    };
  }
  const detection = detected.value;
  const options = ignoreScripts ? { ignoreScripts: true } : {};
  const command = installCommand(detection, options);
  const shown = command === undefined ? (detection.manualCommand ?? '') : formatCommand(command);
  const failure = await install(detection, directory, withoutServerSecrets(runner), options);
  if (failure !== undefined) {
    return {
      ok: false,
      directory,
      command: shown,
      issues: describeIssues(failure.issues),
      retryable: failure.retryable,
    };
  }
  return { ok: true, directory, command: shown, issues: [], retryable: false };
}

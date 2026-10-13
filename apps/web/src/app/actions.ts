'use server';

import { mkdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { Selection } from '@buildit/compatibility';
import { generateProject } from '@buildit/generator';
import { parseManifest } from '@buildit/manifest';
import type { Category } from '@buildit/registry';
import { type DeleteRefusal, deletionTarget } from '../lib/delete-project';
import {
  dependencyGraph,
  type EnvVarView,
  type GraphView,
  listPresets,
  type OptionView,
  type PlanPreviewView,
  type PresetView,
  previewPlan,
  type ResolutionView,
  requiredEnvVars,
  resolveSelection,
  stackOptions,
} from '../lib/engine';
import { isHostedEnvironment } from '../lib/hosting';
import { readRegistry, unregisterGenerated } from '../lib/output-registry';
import { type GeneratedFilesView, generateArchive, generateFiles } from './create/generate/archive';
import {
  launchDetached,
  type OpenFolderOutcome,
  openProjectFolder,
} from './create/generate/open-folder';
import { checkOutputDestination } from './create/generate/output-destination';

/**
 * Les Server Actions : le **seul** chemin par lequel le navigateur parle au
 * moteur (§9, décision 8B.6).
 *
 * Rien de ce qui vient du client n'est cru sur parole. Les écrans envoient un
 * brouillon, donc du JSON quelqu'un peut fabriquer à la main : chaque action
 * revalide. Un manifest passe par `parseManifest`, jamais par un cast ; une
 * sélection est réduite à des tableaux de chaînes. Le moteur reste seul juge de
 * ce qui existe (registry) et de ce qui va ensemble (compatibility).
 */

/** Ne garde que les chaînes d'un tableau venu du client. */
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * Une sélection réduite à sa forme sûre.
 *
 * Les cibles et les identifiants inconnus ne sont pas écartés ici : le moteur
 * les refuse **nommément** (`COMPAT_UNKNOWN_TECHNOLOGY`, `COMPAT_TARGET_UNSUPPORTED`),
 * et c'est cette explication-là que l'écran doit afficher (§12).
 */
function toSelection(input: unknown): Selection {
  const record: Record<string, unknown> =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const { targets, technologies } = record;
  return {
    targets: strings(targets) as Selection['targets'],
    technologies: strings(technologies),
  };
}

export async function loadPresetsAction(): Promise<PresetView[]> {
  return listPresets();
}

export async function loadOptionsAction(
  category: Category,
  selection: unknown,
): Promise<OptionView[]> {
  return stackOptions(category, toSelection(selection));
}

export async function checkSelectionAction(selection: unknown): Promise<ResolutionView> {
  return resolveSelection(toSelection(selection));
}

/** Les noms de variables d'environnement réclamés — jamais une valeur (§6.8). */
export async function loadEnvVarsAction(selection: unknown): Promise<EnvVarView[]> {
  return requiredEnvVars(toSelection(selection));
}

/** Le Dependency Graph de la sélection courante (§6.11). */
export async function loadGraphAction(selection: unknown): Promise<GraphView> {
  return dependencyGraph(toSelection(selection));
}

/** L'aperçu des fichiers — un dry-run : rien n'est écrit (§22). */
export async function previewManifestAction(input: unknown): Promise<PlanPreviewView> {
  const manifest = parseManifest(input);
  if (!manifest.ok) {
    return { files: [], warnings: manifest.issues.map((issue) => issue.message) };
  }
  return previewPlan(manifest.value);
}

export interface GenerationView {
  readonly ok: boolean;
  /** Le dossier écrit — toujours sous la racine de travail, jamais un chemin du client. */
  readonly directory: string;
  readonly files: readonly string[];
  readonly bytes: number;
  readonly warnings: readonly string[];
  readonly steps: readonly string[];
  /** Les problèmes d'un refus : manifest invalide, dossier déjà pris. */
  readonly issues: readonly string[];
  /**
   * Les dépendances ont réellement été installées après l'écriture. Absent
   * quand l'installation n'a pas été demandée : le rapport montre alors la
   * commande à lancer, il ne prétend rien.
   */
  readonly installed?: boolean;
  /**
   * Présent seulement pour une sortie en archive (`generateZipAction`, et
   * `generateProjectAction` en hébergé) : l'archive du projet, en base64,
   * prête à être transformée en `Blob` et proposée au téléchargement. Absent
   * quand le projet est écrit dans un dossier.
   */
  readonly zipBase64?: string;
}

/**
 * La racine sous laquelle le configurateur écrit.
 *
 * Le chemin ne vient **jamais** du navigateur : une Server Action qui écrit là
 * où le client le demande est une écriture de fichier arbitraire. Par défaut
 * `~/buildit`, modifiable par `PF_WEB_WORKSPACE` pour les tests.
 */
function workspaceRoot(): string {
  const configured = process.env['PF_WEB_WORKSPACE'];
  return resolve(
    configured === undefined || configured === '' ? join(homedir(), 'buildit') : configured,
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Ce qu'il y a au bout du chemin : un dossier, autre chose, ou rien. */
async function directoryAt(path: string): Promise<'directory' | 'notADirectory' | 'missing'> {
  try {
    return (await stat(path)).isDirectory() ? 'directory' : 'notADirectory';
  } catch {
    return 'missing';
  }
}

function refused(issues: readonly string[]): GenerationView {
  return { ok: false, directory: '', files: [], bytes: 0, warnings: [], steps: [], issues };
}

/**
 * Génère le projet sur la machine qui sert l'UI (décision 8B.6) — en local
 * seulement. En mode hébergé (`VERCEL=1`/`PF_HOSTED=1`), le projet part en
 * archive (`generateArchive`) : aucune écriture partagée entre visiteurs
 * anonymes (Phase 12, §3).
 *
 * `generateProject` n'installe rien et n'initialise rien par défaut : le
 * moteur ne lance aucune commande qu'on ne lui a pas demandée. Pas de réseau,
 * pas de script exécuté — un projet est écrit, point.
 */
export async function generateProjectAction(input: unknown): Promise<GenerationView> {
  const manifest = parseManifest(input);
  if (!manifest.ok) {
    return refused(manifest.issues.map((issue) => issue.message));
  }

  if (isHostedEnvironment()) {
    return generateArchive(manifest.value);
  }

  const root = workspaceRoot();
  // `parseManifest` a déjà imposé la grammaire du nom (pas de `/`, pas de `..`
  // en tête) ; la vérification qui suit est une ceinture en plus des bretelles.
  const directory = resolve(root, manifest.value.name);
  if (!directory.startsWith(root + sep)) {
    return refused(['Le nom du projet sort du dossier de travail.']);
  }
  if (await exists(directory)) {
    return refused([`Le dossier existe déjà : ${directory}. Choisissez un autre nom.`]);
  }

  await mkdir(root, { recursive: true });
  const result = await generateProject(manifest.value, directory);
  if (!result.ok) {
    return {
      ok: false,
      directory,
      files: [],
      bytes: 0,
      warnings: [],
      steps: result.completedSteps,
      issues: result.issues.map((issue) => issue.message),
    };
  }
  return {
    ok: true,
    directory,
    files: result.value.report.written,
    bytes: result.value.report.bytes,
    warnings: result.value.warnings.map((warning) => warning.message),
    steps: result.value.completedSteps,
    issues: [],
  };
}

/** Où l'UI écrit, pour l'afficher avant d'écrire quoi que ce soit. */
export async function workspaceRootAction(): Promise<string> {
  return workspaceRoot();
}

/**
 * Le projet entier en archive `.zip`, dans les deux modes.
 *
 * Le projet est écrit dans un répertoire temporaire isolé, archivé, puis ce
 * répertoire est supprimé : rien ne reste sur la machine qui sert l'UI, et le
 * navigateur choisit où l'archive atterrit. C'est la même implémentation que
 * la sortie hébergée de `generateProjectAction` (`generateArchive`).
 */
/** Les fichiers du projet, que le navigateur écrira lui-même (sortie dossier en hébergé). */
export async function generateFilesAction(input: unknown): Promise<GeneratedFilesView> {
  const manifest = parseManifest(input);
  if (!manifest.ok) {
    return {
      ok: false,
      files: [],
      bytes: 0,
      warnings: [],
      issues: manifest.issues.map((issue) => issue.message),
    };
  }
  return generateFiles(manifest.value);
}

export async function generateZipAction(input: unknown): Promise<GenerationView> {
  const manifest = parseManifest(input);
  if (!manifest.ok) {
    return refused(manifest.issues.map((issue) => issue.message));
  }
  return generateArchive(manifest.value);
}

export interface OutputDestinationView {
  readonly ok: boolean;
  /** Le dossier qui sera écrit, résolu par le serveur. Vide si le parent est refusé. */
  readonly directory: string;
  readonly issues: readonly string[];
}

/**
 * Vérifie, **sans rien écrire**, le dossier où le projet atterrira : le parent
 * choisi dans l'explorateur, plus le nom du projet.
 *
 * L'écran l'appelle dès le choix du dossier pour dire tout de suite qu'un
 * dossier est inaccessible ou déjà occupé, plutôt qu'après le clic sur
 * « Générer ». La route d'écriture refait la même vérification : le disque a
 * pu changer entre les deux.
 */
export async function checkOutputDestinationAction(
  parent: unknown,
  name: unknown,
): Promise<OutputDestinationView> {
  const checked = await checkOutputDestination(parent, name, isHostedEnvironment());
  return checked.ok
    ? { ok: true, directory: checked.directory, issues: [] }
    : { ok: false, directory: checked.directory, issues: checked.issues };
}

export interface DeleteProjectView {
  readonly ok: boolean;
  /** Le dossier réellement supprimé, pour que l'écran dise lequel. */
  readonly directory: string;
  readonly issues: readonly string[];
}

/** Pourquoi un dossier n'est pas supprimable, dit en une phrase. */
const DELETE_REFUSALS: Readonly<Record<DeleteRefusal, string>> = {
  hosted: 'Rien n’est écrit sur le disque en mode hébergé : il n’y a pas de dossier à supprimer.',
  empty: 'Aucun dossier n’a été indiqué.',
  notInWorkspace:
    'BuildIt n’a pas écrit ce dossier : il n’est ni dans le dossier de travail, ni parmi les projets générés ailleurs. Rien ne sera supprimé.',
  isWorkspace:
    'C’est le dossier de travail lui-même, pas un projet. Supprimez-le vous-même si c’est votre intention.',
  notADirectChild:
    'Seul un projet généré par BuildIt peut être supprimé d’ici, pas un dossier qu’il contient.',
};

/**
 * Supprime du disque un projet généré (§6.14).
 *
 * Le dossier n'est pas celui que le navigateur demande : c'est celui que la
 * règle de `deletionTarget` accepte — un enfant direct du dossier de travail,
 * celui-là même où `generateProjectAction` écrit, ou un dossier que la route
 * de génération a inscrit à son registre après l'avoir écrit ailleurs. Tout le
 * reste est refusé **nommément**, parce qu'un refus muet sur une suppression
 * laisse croire que le fichier a disparu.
 *
 * `rm -r` est irréversible : il n'y a pas de corbeille ici. C'est l'écran qui
 * porte la confirmation explicite, et l'action ne part jamais d'un seul clic.
 */
export async function deleteProjectAction(directory: unknown): Promise<DeleteProjectView> {
  if (typeof directory !== 'string' || directory.trim() === '') {
    return { ok: false, directory: '', issues: [DELETE_REFUSALS.empty] };
  }

  const root = workspaceRoot();
  const hosted = isHostedEnvironment();
  // Le registre n'est lu qu'en local : en hébergé, le refus tombe avant.
  const registered = hosted ? [] : await readRegistry(root);
  const target = deletionTarget(resolve(directory), root, hosted, registered);
  if (!target.ok) {
    return { ok: false, directory: '', issues: [DELETE_REFUSALS[target.reason]] };
  }

  const info = await directoryAt(target.directory);
  if (info === 'missing') {
    // Déjà parti : l'intention de l'utilisateur est satisfaite, ce n'est pas
    // une panne. L'écran retirera la carte comme pour une suppression réussie.
    await forget(root, target.directory);
    return { ok: true, directory: target.directory, issues: [] };
  }
  if (info === 'notADirectory') {
    return {
      ok: false,
      directory: '',
      issues: [`Ce chemin n’est pas un dossier : ${target.directory}`],
    };
  }

  try {
    await rm(target.directory, { recursive: true, force: true });
  } catch (error) {
    return {
      ok: false,
      directory: '',
      issues: [
        `Le dossier n’a pas pu être supprimé : ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
  await forget(root, target.directory);
  return { ok: true, directory: target.directory, issues: [] };
}

/**
 * Retire du registre un dossier supprimé : son droit de suppression part avec
 * lui. Un échec ici ne change rien au résultat, le dossier est déjà parti.
 */
async function forget(root: string, directory: string): Promise<void> {
  try {
    await unregisterGenerated(root, directory);
  } catch {
    // Registre illisible ou protégé : il sera réécrit à la prochaine génération.
  }
}

/**
 * Ouvre dans l'explorateur de la machine le dossier d'un projet que BuildIt a
 * écrit (fin de génération, rapport). Local seulement, et seulement pour un
 * dossier inscrit au registre : les refus sont rendus par leur code, l'écran
 * les dit dans la langue de l'utilisateur.
 */
export async function openProjectFolderAction(directory: unknown): Promise<OpenFolderOutcome> {
  return openProjectFolder(directory, {
    hosted: isHostedEnvironment(),
    registryRoot: workspaceRoot(),
    platform: process.platform,
    launch: launchDetached,
  });
}

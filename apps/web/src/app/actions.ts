'use server';

import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import type { Selection } from '@buildit/compatibility';
import { generateProject } from '@buildit/generator';
import { type Manifest, parseManifest } from '@buildit/manifest';
import type { Category } from '@buildit/registry';
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
import { createZip } from '../lib/zip';

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
   * Présent seulement en mode hébergé (Phase 12, §3) : l'archive du projet,
   * en base64, prête à être transformée en `Blob` et proposée au
   * téléchargement. En mode local, ce champ est absent — le projet est
   * écrit directement sur le disque de l'utilisateur, comme avant.
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

function refused(issues: readonly string[]): GenerationView {
  return { ok: false, directory: '', files: [], bytes: 0, warnings: [], steps: [], issues };
}

/**
 * Génère le projet dans un répertoire temporaire **isolé par requête**
 * (`fs.mkdtempSync` dans `os.tmpdir()`), produit une archive `.zip` du
 * résultat, puis nettoie ce répertoire — jamais d'écriture dans un dossier
 * partagé entre visiteurs (Phase 12, §3). C'est la contrepartie hébergée de
 * `generateProjectAction` : un visiteur anonyme ne peut ni écrire sur le
 * disque du serveur de façon persistante, ni y laisser quoi que ce soit après
 * sa requête.
 */
async function generateHosted(manifest: Manifest): Promise<GenerationView> {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'buildit-hosted-'));
  const directory = join(tmpRoot, manifest.name);
  try {
    const result = await generateProject(manifest, directory);
    if (!result.ok) {
      return {
        ok: false,
        directory: '',
        files: [],
        bytes: 0,
        warnings: [],
        steps: result.completedSteps,
        issues: result.issues.map((issue) => issue.message),
      };
    }
    const entries = await Promise.all(
      result.value.report.written.map(async (file) => ({
        path: file,
        data: await readFile(join(directory, ...file.split('/'))),
      })),
    );
    return {
      ok: true,
      // Pas de chemin disque à montrer : seul le nom de l'archive a un sens
      // pour le visiteur, le répertoire temporaire aura disparu au retour.
      directory: `${manifest.name}.zip`,
      files: result.value.report.written,
      bytes: result.value.report.bytes,
      warnings: result.value.warnings.map((warning) => warning.message),
      steps: result.value.completedSteps,
      issues: [],
      zipBase64: createZip(entries).toString('base64'),
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

/**
 * Génère le projet sur la machine qui sert l'UI (décision 8B.6) — en local
 * seulement. En mode hébergé (`VERCEL=1`/`PF_HOSTED=1`), voir `generateHosted` :
 * aucune écriture partagée entre visiteurs anonymes (Phase 12, §3).
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
    return generateHosted(manifest.value);
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

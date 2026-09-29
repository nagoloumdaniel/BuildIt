import { fileURLToPath } from 'node:url';
import { resolve, type Selection } from '@project-factory/compatibility';
import type { Manifest } from '@project-factory/manifest';
import { loadRecipeCatalogue, type Recipe, type RecipeCatalogue } from '@project-factory/recipes';
import { loadCatalogue, type Registry, type RegistryEntry } from '@project-factory/registry';
import {
  fail,
  type Issue,
  ok,
  type ParseFailure,
  type ParseResult,
} from '@project-factory/validation';
import { type GeneratedFiles, planMonorepo } from './monorepo.js';
import { type FilePlan, planFiles } from './plan.js';
import {
  type CommandRunner,
  nodeCommandRunner,
  runGit,
  runInstall,
  runValidation,
  type StepFailure,
} from './postinstall.js';
import { resolveRecipes } from './recipes.js';
import { buildScaffold, NODE_RANGE, PACKAGE_MANAGER } from './scaffold.js';
import type { TemplateContext } from './template.js';
import { loadTemplateFiles, type TemplateRequest } from './templates.js';
import { type FileSystem, type GenerationReport, generate } from './write.js';

/**
 * Le pipeline du §22, assemblé.
 *
 * ```
 * Manifest → Stack Resolver → Compatibility → Recipe Resolver → Scaffold
 *          → Template Resolver → File Plan → [Dry Run] → Generator
 *          → Post Install (install, git) → Validation
 * ```
 *
 * Le rollback couvre l'écriture — la seule étape qui produit le projet. Après
 * elle, le projet est complet sur le disque : un échec d'installation, de Git
 * ou de validation le laisse en place et nomme l'étape (`failedStep`), pour
 * qu'on puisse la relancer (`fromStep`) plutôt que tout régénérer.
 *
 * Chaque étage existe déjà et est testé isolément. Ce fichier ne fait que les
 * enchaîner, et s'arrête au premier qui refuse — avec ses mots à lui. Un
 * pipeline qui reformulerait les erreurs de ses étages ferait perdre la
 * précision que chacun a construite.
 */

/**
 * Extrait du manifest la liste des technologies choisies.
 *
 * Le manifest range les slugs par rôle (`frontend.framework`, `database.orm`…) ;
 * le compatibility engine raisonne sur un ensemble plat. La conversion est
 * mécanique et vit ici plutôt que dans le manifest, qui ne doit rien savoir du
 * moteur.
 */
export function selectionFromManifest(manifest: Manifest): Selection {
  const technologies = [
    manifest.frontend?.framework,
    manifest.frontend?.language,
    manifest.frontend?.styling,
    manifest.frontend?.ui,
    manifest.mobile?.framework,
    manifest.mobile?.language,
    manifest.mobile?.styling,
    manifest.desktop?.framework,
    manifest.backend?.framework,
    manifest.backend?.language,
    manifest.database?.engine,
    manifest.database?.orm,
    manifest.auth?.provider,
    ...(manifest.services ?? []),
    ...(manifest.quality ?? []),
    ...(manifest.infra ?? []),
  ].filter((id): id is string => id !== undefined);

  return { targets: manifest.targets, technologies: [...new Set(technologies)] };
}

/** Étapes du pipeline, dans l'ordre d'exécution. */
export const PIPELINE_STEPS: readonly PipelineStep[] = [
  'plan',
  'write',
  'install',
  'git',
  'validate',
];

export type PipelineStep = 'plan' | 'write' | 'install' | 'git' | 'validate';

/** Étapes à partir desquelles une génération peut reprendre. */
export type ResumableStep = Exclude<PipelineStep, 'plan'>;

export interface GenerationOutcome {
  /** Vide quand l'écriture a été sautée par une reprise. */
  readonly report: GenerationReport;
  readonly warnings: readonly PipelineIssue[];
  /** Étapes réellement exécutées, dans l'ordre. */
  readonly completedSteps: readonly PipelineStep[];
}

/** Un échec dit où il s'est produit, et s'il vaut la peine de reprendre là. */
export interface GenerationFailure extends ParseFailure<string> {
  readonly failedStep: PipelineStep;
  /** `true` : erreur transitoire (réseau) — relancer avec `fromStep: failedStep`. */
  readonly retryable: boolean;
  readonly completedSteps: readonly PipelineStep[];
}

export type GenerationResult =
  | { readonly ok: true; readonly value: GenerationOutcome }
  | GenerationFailure;

export interface PipelineOptions {
  /** Catalogue à utiliser. Par défaut, le catalogue officiel. */
  readonly registry?: Registry;
  /** Recettes à appliquer, choisies explicitement (§22). Par défaut : aucune. */
  readonly recipes?: readonly string[];
  /** Catalogue de recettes. Par défaut, les recettes officielles. */
  readonly recipeCatalogue?: RecipeCatalogue;
  /** Racine des templates. Par défaut, le dossier `templates/` du paquet. */
  readonly templatesRoot?: string;
  /** Horloge des templates (`{{year}}`). Par défaut, maintenant. */
  readonly now?: Date;
  readonly fs?: FileSystem;
  /** Exécuteur des commandes post-écriture. Par défaut, le vrai. */
  readonly runner?: CommandRunner;
  /**
   * Étapes post-écriture, toutes désactivées par défaut : le moteur ne lance
   * aucune commande qu'on ne lui a pas demandée. Les façades (CLI, UI)
   * choisissent leurs propres défauts.
   */
  readonly install?: boolean;
  readonly git?: boolean;
  /** Suppose les dépendances installées. */
  readonly validate?: boolean;
  /** Reprend à cette étape : les précédentes, sauf le plan, sont sautées. */
  readonly fromStep?: ResumableStep;
}

/** Réunit les codes d'erreur de tous les étages traversés. */
type PipelineIssue = Issue<string>;

function toIssues(issues: readonly Issue<string>[]): PipelineIssue[] {
  return [...issues];
}

/**
 * Templates livrés avec le paquet. Résolu depuis ce fichier : `src/` en
 * développement, `dist/` une fois publié — le dossier est à côté des deux.
 */
const DEFAULT_TEMPLATES_ROOT = fileURLToPath(new URL('../templates', import.meta.url));

function requireRecipeCatalogue(options: PipelineOptions): ParseResult<RecipeCatalogue, string> {
  if (options.recipeCatalogue !== undefined) {
    return ok(options.recipeCatalogue);
  }
  const catalogue = loadRecipeCatalogue();
  return catalogue.ok ? ok(catalogue.value) : fail(toIssues(catalogue.issues));
}

/**
 * Variables offertes aux templates. Liste fermée (template.ts) ; toutes
 * dérivées du manifest ou de constantes du socle, jamais d'une saisie libre
 * autre que `name`.
 */
function templateContext(manifest: Manifest, now: Date): TemplateContext {
  return {
    projectName: manifest.name,
    packageName: manifest.name,
    scope: `@${manifest.name}`,
    description: '',
    year: String(now.getUTCFullYear()),
    nodeVersion: NODE_RANGE,
    packageManager: PACKAGE_MANAGER,
  };
}

function requireRegistry(options: PipelineOptions): ParseResult<Registry, string> {
  if (options.registry !== undefined) {
    return ok(options.registry);
  }
  const catalogue = loadCatalogue();
  return catalogue.ok ? ok(catalogue.value) : fail(toIssues(catalogue.issues));
}

/**
 * Construit le plan de fichiers d'un projet, **sans rien écrire**.
 *
 * C'est le dry-run du §22 : exactement ce que `generateProject` écrira, rendu
 * inspectable. Les deux partagent ce code, donc l'aperçu ne peut pas diverger
 * du résultat.
 */
export interface ProjectPlan {
  readonly plan: FilePlan;
  /** Avertissements non bloquants, remontes de tous les etages traverses. */
  readonly warnings: readonly PipelineIssue[];
}

export function planProject(
  manifest: Manifest,
  targetDir: string,
  options: PipelineOptions = {},
): ParseResult<ProjectPlan, string> {
  const registry = requireRegistry(options);
  if (!registry.ok) {
    return registry;
  }

  const resolution = resolve(selectionFromManifest(manifest), registry.value);
  if (!resolution.ok) {
    return fail(toIssues(resolution.issues));
  }

  const entries = resolution.value.technologies
    .map((id) => registry.value.get(id))
    .filter((entry): entry is RegistryEntry => entry !== undefined);

  const requested = options.recipes ?? [];
  let recipes: ReturnType<RecipeCatalogue['all']> = [];
  if (requested.length > 0) {
    const catalogue = requireRecipeCatalogue(options);
    if (!catalogue.ok) {
      return catalogue;
    }
    const resolved = resolveRecipes(requested, entries, catalogue.value);
    if (!resolved.ok) {
      return fail(toIssues(resolved.issues));
    }
    recipes = resolved.value;
  }

  const generated =
    manifest.architecture === 'monorepo'
      ? planMonorepo(
          manifest,
          entries,
          recipes,
          (app, appEntries, appRecipes) => generateApp(app, appEntries, appRecipes, options),
          (template) => {
            const loaded = loadTemplateFiles(
              options.templatesRoot ?? DEFAULT_TEMPLATES_ROOT,
              [{ kind: 'directory', template }],
              templateContext(manifest, options.now ?? new Date()),
            );
            return loaded.ok ? ok(loaded.value) : fail(toIssues(loaded.issues));
          },
        )
      : generateApp(manifest, entries, recipes, options);
  if (!generated.ok) {
    return fail(toIssues(generated.issues));
  }

  // Un template qui viserait un fichier du socle est un conflit : planFiles le
  // détecte avant toute écriture, avec les deux origines.
  const plan = planFiles(targetDir, generated.value.files);
  if (!plan.ok) {
    return fail(toIssues(plan.issues));
  }

  // Les avertissements de tous les étages traversés sont réunis : combinaison
  // expérimentale, licence restrictive, version non épinglée. Aucun n'est
  // consommé en chemin.
  return ok({
    plan: plan.value,
    warnings: [...resolution.value.warnings, ...generated.value.warnings],
  });
}

/**
 * Une application seule : socle, puis templates des fiches certifiées et
 * fichiers des recettes. En monorepo, appelée une fois par application.
 */
function generateApp(
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  recipes: readonly Recipe[],
  options: PipelineOptions,
): ParseResult<GeneratedFiles, string> {
  const scaffold = buildScaffold(manifest, entries, recipes);
  if (!scaffold.ok) {
    return fail(toIssues(scaffold.issues));
  }

  // Template Resolver : le template de chaque fiche certifiée, puis les
  // fichiers des recettes. Sans demande, aucun accès au disque.
  const requests: TemplateRequest[] = [
    ...entries.flatMap((entry): TemplateRequest[] =>
      entry.generation === 'certified' && entry.template !== undefined
        ? [{ kind: 'directory', template: entry.template }]
        : [],
    ),
    ...recipes.flatMap((recipe) =>
      (recipe.files ?? []).map(
        (file): TemplateRequest => ({
          kind: 'file',
          template: file.template,
          target: file.target,
          origin: `recipe:${recipe.id}`,
        }),
      ),
    ),
  ];
  const templates = loadTemplateFiles(
    options.templatesRoot ?? DEFAULT_TEMPLATES_ROOT,
    requests,
    templateContext(manifest, options.now ?? new Date()),
  );
  if (!templates.ok) {
    return fail(toIssues(templates.issues));
  }

  return ok({
    files: [...scaffold.value.files, ...templates.value],
    warnings: scaffold.value.warnings,
  });
}

const EMPTY_REPORT: GenerationReport = { written: [], bytes: 0, rolledBack: false };

function failure(
  issues: readonly PipelineIssue[],
  failedStep: PipelineStep,
  completedSteps: readonly PipelineStep[],
  retryable = false,
): GenerationFailure {
  return { ...fail(toIssues(issues)), failedStep, retryable, completedSteps: [...completedSteps] };
}

function fromStepFailure(
  step: StepFailure,
  failedStep: PipelineStep,
  completedSteps: readonly PipelineStep[],
): GenerationFailure {
  return failure([step.issue], failedStep, completedSteps, step.retryable);
}

/** Scripts du package.json planifié — ceux que la validation lancera. */
function plannedScripts(plan: FilePlan): Record<string, string> {
  const file = plan.files.find((planned) => planned.path === 'package.json');
  if (file === undefined) {
    return {};
  }
  return (JSON.parse(file.contents) as { scripts?: Record<string, string> }).scripts ?? {};
}

/**
 * Construit le plan, l'écrit, puis déroule les étapes post-écriture demandées.
 *
 * Une erreur avant ou pendant l'écriture n'écrit rien (rollback). Le plan est
 * toujours recalculé, même en reprise : il est pur et déterministe, et c'est
 * lui qui dit quels scripts valider.
 */
export async function generateProject(
  manifest: Manifest,
  targetDir: string,
  options: PipelineOptions = {},
): Promise<GenerationResult> {
  const completed: PipelineStep[] = [];
  const planned = planProject(manifest, targetDir, options);
  if (!planned.ok) {
    return failure(planned.issues, 'plan', completed);
  }
  completed.push('plan');

  const start = PIPELINE_STEPS.indexOf(options.fromStep ?? 'write');
  const wanted = (step: PipelineStep, enabled: boolean): boolean =>
    enabled && PIPELINE_STEPS.indexOf(step) >= start;

  let report = EMPTY_REPORT;
  if (wanted('write', true)) {
    const written = await generate(planned.value.plan, options.fs);
    if (!written.ok) {
      return failure(written.issues, 'write', completed);
    }
    report = written.value;
    completed.push('write');
  }

  const runner = options.runner ?? nodeCommandRunner;
  const warnings: PipelineIssue[] = [...planned.value.warnings];

  if (wanted('install', options.install === true)) {
    const installFailure = await runInstall(runner, targetDir);
    if (installFailure !== undefined) {
      return fromStepFailure(installFailure, 'install', completed);
    }
    completed.push('install');
  }

  if (wanted('git', options.git === true)) {
    const git = await runGit(runner, targetDir);
    if (git.failure !== undefined) {
      return fromStepFailure(git.failure, 'git', completed);
    }
    if (git.warning === undefined) {
      completed.push('git');
    } else {
      warnings.push(git.warning);
    }
  }

  if (wanted('validate', options.validate === true)) {
    const validationFailure = await runValidation(
      runner,
      targetDir,
      plannedScripts(planned.value.plan),
    );
    if (validationFailure !== undefined) {
      return fromStepFailure(validationFailure, 'validate', completed);
    }
    completed.push('validate');
  }

  return ok({ report, warnings, completedSteps: completed });
}

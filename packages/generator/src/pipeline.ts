import { resolve, type Selection } from '@project-factory/compatibility';
import type { Manifest } from '@project-factory/manifest';
import { loadCatalogue, type Registry, type RegistryEntry } from '@project-factory/registry';
import { fail, type Issue, ok, type ParseResult } from '@project-factory/validation';
import { type FilePlan, planFiles } from './plan.js';
import { buildScaffold } from './scaffold.js';
import { type FileSystem, type GenerationReport, generate } from './write.js';

/**
 * Le pipeline du §22, assemblé.
 *
 * ```
 * Manifest → Stack Resolver → Compatibility → Scaffold → File Plan → [Dry Run] → Generator
 * ```
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

export interface GenerationOutcome {
  readonly report: GenerationReport;
  readonly warnings: readonly PipelineIssue[];
}

export interface PipelineOptions {
  /** Catalogue à utiliser. Par défaut, le catalogue officiel. */
  readonly registry?: Registry;
  readonly fs?: FileSystem;
}

/** Réunit les codes d'erreur de tous les étages traversés. */
type PipelineIssue = Issue<string>;

function toIssues(issues: readonly Issue<string>[]): PipelineIssue[] {
  return [...issues];
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

  const scaffold = buildScaffold(manifest, entries);
  if (!scaffold.ok) {
    return fail(toIssues(scaffold.issues));
  }

  const plan = planFiles(targetDir, scaffold.value.files);
  if (!plan.ok) {
    return fail(toIssues(plan.issues));
  }

  // Les avertissements des deux etages traverses sont reunis : combinaison
  // experimentale, licence restrictive, version non epinglee. Aucun n'est
  // consomme en chemin.
  return ok({
    plan: plan.value,
    warnings: [...resolution.value.warnings, ...scaffold.value.warnings],
  });
}

/** Construit le plan puis l'écrit. Une erreur à n'importe quel étage n'écrit rien. */
export async function generateProject(
  manifest: Manifest,
  targetDir: string,
  options: PipelineOptions = {},
): Promise<ParseResult<GenerationOutcome, string>> {
  const planned = planProject(manifest, targetDir, options);
  if (!planned.ok) {
    return planned;
  }

  const report = await generate(planned.value.plan, options.fs);
  if (!report.ok) {
    return fail(toIssues(report.issues));
  }

  return ok({ report: report.value, warnings: planned.value.warnings });
}

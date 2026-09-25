/**
 * Pipeline de génération — plan de fichiers, dry-run, écriture, annulation (§22).
 *
 * Rien n'est écrit avant que tout soit décidé : le pipeline produit d'abord un
 * plan complet et inspectable, puis le déroule en journalisant ce qu'il crée.
 * Le dry-run n'est pas un mode à part, c'est la première étape sans la seconde.
 */

export type { DependencyIssue, DependencyIssueCode, ResolvedDependencies } from './dependencies.js';
export { DEPENDENCY_ISSUE_CODES, resolveDependencies } from './dependencies.js';
export type { Integration } from './integrations.data.js';
export { INTEGRATIONS } from './integrations.data.js';
export type { GenerationOutcome, PipelineOptions, ProjectPlan } from './pipeline.js';
export {
  generateProject,
  planProject,
  selectionFromManifest,
} from './pipeline.js';
export type { FilePlan, GenIssue, GenIssueCode, PlannedFile } from './plan.js';
export { describePlan, GEN_ISSUE_CODES, planFiles } from './plan.js';
export type { Scaffold, ScaffoldIssue, ScaffoldIssueCode } from './scaffold.js';
export { buildScaffold, SCAFFOLD_ISSUE_CODES } from './scaffold.js';
export type {
  TemplateContext,
  TemplateIssue,
  TemplateIssueCode,
  TemplateVariable,
} from './template.js';
export {
  renderTemplate,
  TEMPLATE_ISSUE_CODES,
  TEMPLATE_VARIABLES,
} from './template.js';
export type { FileSystem, GenerationReport, GenWriteCode, GenWriteIssue } from './write.js';
export { GEN_WRITE_CODES, generate, nodeFileSystem } from './write.js';

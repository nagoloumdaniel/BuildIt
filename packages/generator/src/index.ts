/**
 * Pipeline de génération — plan de fichiers, dry-run, écriture, annulation (§22).
 *
 * Rien n'est écrit avant que tout soit décidé : le pipeline produit d'abord un
 * plan complet et inspectable, puis le déroule en journalisant ce qu'il crée.
 * Le dry-run n'est pas un mode à part, c'est la première étape sans la seconde.
 */

export type {
  DependencyIssue,
  DependencyIssueCode,
  DependencySource,
  ResolvedDependencies,
} from './dependencies.js';
export { DEPENDENCY_ISSUE_CODES, resolveDependencies } from './dependencies.js';
export { buildInfrastructure, CI_SCRIPTS } from './infrastructure.js';
export type { DockerService, Integration } from './integrations.data.js';
export { INTEGRATIONS } from './integrations.data.js';
export type {
  GenerationFailure,
  GenerationOutcome,
  GenerationResult,
  PipelineOptions,
  PipelineStep,
  ProjectPlan,
  ResumableStep,
} from './pipeline.js';
export {
  generateProject,
  PIPELINE_STEPS,
  planProject,
  selectionFromManifest,
} from './pipeline.js';
export type { FilePlan, GenIssue, GenIssueCode, PlannedFile } from './plan.js';
export { describePlan, GEN_ISSUE_CODES, planFiles } from './plan.js';
export type {
  CommandResult,
  CommandRunner,
  GitOutcome,
  PostInstallCode,
  PostInstallIssue,
  StepFailure,
} from './postinstall.js';
export {
  isTransientFailure,
  nodeCommandRunner,
  POST_INSTALL_CODES,
  runGit,
  runInstall,
  runValidation,
} from './postinstall.js';
export type { RecipeResolutionCode, RecipeResolutionIssue } from './recipes.js';
export {
  RECIPE_RESOLUTION_CODES,
  recipeAsDependencySource,
  resolveRecipes,
} from './recipes.js';
export type { Scaffold, ScaffoldIssue, ScaffoldIssueCode } from './scaffold.js';
export {
  buildScaffold,
  NODE_RANGE,
  PACKAGE_MANAGER,
  SCAFFOLD_ISSUE_CODES,
} from './scaffold.js';
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
export type { TemplateLoadCode, TemplateLoadIssue, TemplateRequest } from './templates.js';
export { loadTemplateFiles, TEMPLATE_LOAD_CODES } from './templates.js';
export type { FileSystem, GenerationReport, GenWriteCode, GenWriteIssue } from './write.js';
export { GEN_WRITE_CODES, generate, nodeFileSystem } from './write.js';

/**
 * Pipeline de génération — plan de fichiers, dry-run, écriture, annulation (§22).
 *
 * Rien n'est écrit avant que tout soit décidé : le pipeline produit d'abord un
 * plan complet et inspectable, puis le déroule en journalisant ce qu'il crée.
 * Le dry-run n'est pas un mode à part, c'est la première étape sans la seconde.
 */

export type { FilePlan, GenIssue, GenIssueCode, PlannedFile } from './plan.js';
export { describePlan, GEN_ISSUE_CODES, planFiles } from './plan.js';
export type { FileSystem, GenerationReport, GenWriteCode, GenWriteIssue } from './write.js';
export { GEN_WRITE_CODES, generate, nodeFileSystem } from './write.js';

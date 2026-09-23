/**
 * Modèle d'erreur et outillage de validation partagés par tout le moteur.
 *
 * Extrait de `@project-factory/manifest` quand le registry a eu besoin des
 * mêmes briques : un code stable, un chemin, un message, un indice. Deux copies
 * auraient fini par diverger — l'une corrigée, l'autre pas.
 */

export type { Issue, PathSegment, Severity } from './issue.js';
export { describeValue, isPlainObject, quoteValue, valueAt } from './issue.js';
export type { MessageParams } from './messages.js';
export { createMessageFormatter } from './messages.js';
export type { ParseFailure, ParseResult } from './result.js';
export { fail, ok } from './result.js';
export { suggest } from './suggest.js';
export type { NormalizedIssue, ZodIssueKind } from './zod.js';
export { normalizeZodIssues } from './zod.js';

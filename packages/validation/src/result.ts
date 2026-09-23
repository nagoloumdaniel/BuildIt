import type { Issue } from './issue.js';

/**
 * Résultat d'une validation.
 *
 * Union discriminée plutôt qu'exception : une exception oblige chaque appelant
 * à un `try/catch` et fait perdre le type des erreurs au passage. Ici le CLI
 * affiche une liste et l'UI surligne des champs — même objet, deux rendus.
 */
export type ParseResult<T, Code extends string = string> =
  | { readonly ok: true; readonly value: T }
  | ParseFailure<Code>;

export interface ParseFailure<Code extends string = string> {
  readonly ok: false;
  /** Toujours au moins un élément. */
  readonly issues: readonly Issue<Code>[];
}

export function ok<T>(value: T): { readonly ok: true; readonly value: T } {
  return { ok: true, value };
}

/**
 * Construit un échec.
 *
 * Refuse une liste vide : un échec sans raison serait affiché à l'utilisateur
 * comme « invalide » sans rien lui dire. C'est un bug de programmation, donc
 * une exception — pas un problème de validation à remonter.
 */
export function fail<Code extends string = string>(
  issues: readonly Issue<Code>[],
): ParseFailure<Code> {
  if (issues.length === 0) {
    throw new Error('fail() exige au moins un problème : un échec sans raison est un bug.');
  }
  return { ok: false, issues };
}

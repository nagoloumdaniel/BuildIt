/**
 * Modèle d'erreur partagé par tout le moteur.
 *
 * Chaque problème porte un **code stable**, indépendant de la langue et de la
 * formulation : les tests assertent sur le code, l'interface se branche sur le
 * code, et reformuler un message ne casse rien. Les messages, eux, vivent dans
 * un catalogue par domaine.
 */

/** Segment de chemin vers la valeur fautive : clé d'objet ou index de tableau. */
export type PathSegment = string | number;

export type Severity = 'error' | 'warning';

export interface Issue<Code extends string = string> {
  /** Code stable, sur lequel portent les tests et les branchements applicatifs. */
  readonly code: Code;
  /** Chemin de la valeur fautive, par exemple `['frontend', 'framework']`. */
  readonly path: readonly PathSegment[];
  /** Message destiné à l'utilisateur. */
  readonly message: string;
  /** Piste de correction, quand une valeur proche existe. */
  readonly hint?: string;
}

/** Lit la valeur d'entrée à un chemin donné, pour distinguer « absent » de « mal typé ». */
export function valueAt(input: unknown, path: readonly PathSegment[]): unknown {
  let current: unknown = input;
  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === 'number') {
      current = current[segment];
    } else if (isPlainObject(current) && typeof segment === 'string') {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Décrit un type de valeur en français, pour les messages « attendu X, reçu Y ». */
export function describeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'un tableau';
  }
  switch (typeof value) {
    case 'string':
      return 'une chaîne';
    case 'number':
      return 'un nombre';
    case 'boolean':
      return 'un booléen';
    case 'undefined':
      return 'une valeur absente';
    default:
      return 'une valeur inattendue';
  }
}

/** Met une valeur en forme pour l'insérer dans un message. */
export function quoteValue(value: unknown): string {
  return typeof value === 'string' ? `« ${value} »` : String(value);
}

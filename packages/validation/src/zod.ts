import type { z } from 'zod';
import { type PathSegment, valueAt } from './issue.js';

/**
 * Traduction des erreurs Zod en descripteurs neutres.
 *
 * Ce fichier est le **seul** du moteur à connaître la forme des erreurs de Zod.
 * Chaque domaine (manifest, registry, …) mappe ensuite ces descripteurs vers
 * ses propres codes stables, avec son propre catalogue de messages.
 *
 * L'intérêt n'est pas théorique : les particularités de Zod sont nombreuses et
 * chacune a coûté un test rouge. Une énumération absente remonte en
 * `invalid_value` et non `invalid_type` ; `params` n'existe que sur les issues
 * `custom` ; une chaîne trop courte remonte en `too_small` et non en
 * `invalid_format`. Ces pièges méritent d'être appris une fois.
 */

export type ZodIssueKind =
  /** Clé inconnue sur un objet strict. */
  | 'unknown-field'
  /** Valeur absente là où elle est obligatoire. */
  | 'required'
  /** Valeur présente mais du mauvais type. */
  | 'type-mismatch'
  /** Valeur hors d'une énumération fermée. */
  | 'enum-unknown'
  /** Valeur au mauvais format : expression régulière, longueur, borne. */
  | 'format'
  /** Vérification personnalisée ayant déclaré son propre code. */
  | 'custom';

export interface NormalizedIssue {
  readonly kind: ZodIssueKind;
  readonly path: PathSegment[];
  /** Valeur fautive telle qu'elle apparaît dans l'entrée. */
  readonly value: unknown;
  /** Code déclaré via `params.pfCode` sur une vérification personnalisée. */
  readonly declaredCode?: string;
  /** Valeurs acceptées, pour une énumération — matière première de l'indice. */
  readonly acceptedValues?: string[];
  /** Type attendu, pour un `type-mismatch`. */
  readonly expectedType?: string;
}

/** Code déclaré par une vérification personnalisée, s'il existe. */
function declaredCodeOf(issue: z.core.$ZodIssue): string | undefined {
  if (issue.code !== 'custom') {
    return undefined;
  }
  const declared = issue.params?.['pfCode'];
  return typeof declared === 'string' ? declared : undefined;
}

function normalizeOne(issue: z.core.$ZodIssue, input: unknown): NormalizedIssue[] {
  const path = issue.path as PathSegment[];

  // Une clé inconnue se traite en premier : le chemin de l'issue désigne
  // l'objet parent, pas la clé fautive, donc la règle « valeur absente » qui
  // suit s'y appliquerait à tort.
  if (issue.code === 'unrecognized_keys') {
    return issue.keys.map((key) => ({
      kind: 'unknown-field' as const,
      path: [...path, key],
      value: undefined,
    }));
  }

  const value = valueAt(input, path);

  // Une valeur absente est un champ manquant, quelle que soit la façon dont Zod
  // l'a signalée : une énumération absente remonte en `invalid_value`, un objet
  // absent en `invalid_type`. Pour l'utilisateur, c'est la même chose.
  if (value === undefined) {
    return [{ kind: 'required', path, value: undefined }];
  }

  const declaredCode = declaredCodeOf(issue);
  if (declaredCode !== undefined) {
    return [{ kind: 'custom', path, value, declaredCode }];
  }

  switch (issue.code) {
    case 'invalid_value':
      return [{ kind: 'enum-unknown', path, value, acceptedValues: issue.values.map(String) }];

    case 'invalid_format':
    case 'too_small':
    case 'too_big':
      return [{ kind: 'format', path, value }];

    case 'invalid_type':
      return [{ kind: 'type-mismatch', path, value, expectedType: String(issue.expected) }];

    default:
      return [{ kind: 'type-mismatch', path, value }];
  }
}

/** Normalise toutes les erreurs d'un `safeParse` échoué. */
export function normalizeZodIssues(
  issues: readonly z.core.$ZodIssue[],
  input: unknown,
): NormalizedIssue[] {
  return issues.flatMap((issue) => normalizeOne(issue, input));
}

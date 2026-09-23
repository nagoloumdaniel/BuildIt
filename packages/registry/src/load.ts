import type { Target } from '@project-factory/manifest';
import {
  describeValue,
  fail,
  isPlainObject,
  type NormalizedIssue,
  normalizeZodIssues,
  ok,
  type ParseResult,
  quoteValue,
  suggest,
} from '@project-factory/validation';
import { messageFor, type RegistryIssue, type RegistryIssueCode } from './errors.js';
import { checkIntegrity, type IntegrityIssue } from './integrity.js';
import {
  type Category,
  entrySchema,
  type GenerationStatus,
  type LifecycleStatus,
  type RegistryEntry,
} from './schema/entry.js';

/**
 * Chargement du catalogue.
 *
 * Deux étapes, dans cet ordre : chaque fiche est validée sur sa forme, puis
 * l'ensemble est contrôlé sur sa cohérence. L'ordre n'est pas un détail —
 * contrôler les références croisées d'un catalogue dont une fiche est
 * malformée produirait des erreurs en cascade qui masqueraient la vraie cause.
 */

export interface RegistryQuery {
  readonly category?: Category;
  readonly target?: Target;
  readonly generation?: GenerationStatus;
  readonly status?: LifecycleStatus;
}

export interface Registry {
  /** Toutes les fiches, triées par identifiant. */
  entries(): RegistryEntry[];
  /** Retrouve une fiche par son identifiant. */
  get(id: string): RegistryEntry | undefined;
  /** Filtre les fiches. Les critères absents ne filtrent pas. */
  query(criteria: RegistryQuery): RegistryEntry[];
  /** Problèmes non bloquants relevés au chargement — fraîcheur, notamment. */
  warnings(): readonly IntegrityIssue[];
}

/**
 * Chemins dont un problème de format désigne un champ précis.
 *
 * Le registry a plusieurs champs à grammaire propre, là où le manifest n'en
 * avait qu'un. Les distinguer donne un message qui dit quoi corriger plutôt
 * qu'un « format invalide » générique.
 */
const FORMAT_CODES: Readonly<Record<string, RegistryIssueCode>> = {
  id: 'REGISTRY_ID_INVALID',
  name: 'REGISTRY_NAME_INVALID',
  env: 'REGISTRY_ENV_NAME_INVALID',
  lastReviewedAt: 'REGISTRY_DATE_INVALID',
  template: 'REGISTRY_TEMPLATE_PATH_INVALID',
  docs: 'REGISTRY_URL_INVALID',
};

function formatCodeFor(path: readonly (string | number)[]): RegistryIssueCode {
  const field = typeof path[0] === 'string' ? path[0] : '';
  return FORMAT_CODES[field] ?? 'REGISTRY_SLUG_INVALID';
}

function toRegistryIssue(issue: NormalizedIssue, index: number): RegistryIssue {
  const path = [index, ...issue.path];
  const field = issue.path.map(String).join('.');

  switch (issue.kind) {
    case 'unknown-field':
      return {
        code: 'REGISTRY_UNKNOWN_FIELD',
        path,
        message: messageFor('REGISTRY_UNKNOWN_FIELD', { field: String(issue.path.at(-1)) }),
      };

    case 'required':
      return {
        code: 'REGISTRY_FIELD_REQUIRED',
        path,
        message: messageFor('REGISTRY_FIELD_REQUIRED', { field }),
      };

    case 'custom': {
      const code = issue.declaredCode as RegistryIssueCode;
      return { code, path, message: messageFor(code, { value: quoteValue(issue.value) }) };
    }

    case 'enum-unknown': {
      const accepted = issue.acceptedValues ?? [];
      const hint = typeof issue.value === 'string' ? suggest(issue.value, accepted) : undefined;
      return {
        code: 'REGISTRY_ENUM_UNKNOWN',
        path,
        message: messageFor('REGISTRY_ENUM_UNKNOWN', {
          value: quoteValue(issue.value),
          expected: accepted.join(', '),
        }),
        ...(hint === undefined ? {} : { hint: `Vouliez-vous dire « ${hint} » ?` }),
      };
    }

    case 'format': {
      const code = formatCodeFor(issue.path);
      return { code, path, message: messageFor(code, { value: quoteValue(issue.value) }) };
    }

    case 'type-mismatch':
      return {
        code: 'REGISTRY_TYPE_MISMATCH',
        path,
        message: messageFor('REGISTRY_TYPE_MISMATCH', {
          field,
          expected: issue.expectedType ?? 'une valeur valide',
          actual: describeValue(issue.value),
        }),
      };
  }
}

function createRegistry(entries: RegistryEntry[], warnings: IntegrityIssue[]): Registry {
  // Tri par identifiant : l'ordre de chargement dépend du système de fichiers,
  // qui n'est pas stable d'une machine à l'autre. Un ordre déterministe rend
  // les sorties du CLI et les tests reproductibles.
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map(sorted.map((entry) => [entry.id, entry]));

  return {
    entries: () => [...sorted],
    get: (id) => byId.get(id),
    query: (criteria) =>
      sorted.filter((entry) => {
        if (criteria.category !== undefined && entry.category !== criteria.category) {
          return false;
        }
        if (criteria.target !== undefined && !entry.targets.includes(criteria.target)) {
          return false;
        }
        if (criteria.generation !== undefined && entry.generation !== criteria.generation) {
          return false;
        }
        if (criteria.status !== undefined && entry.status !== criteria.status) {
          return false;
        }
        return true;
      }),
    warnings: () => warnings,
  };
}

/** Charge et valide un catalogue à partir de fiches non fiables. */
export function loadRegistry(inputs: readonly unknown[]): ParseResult<Registry, RegistryIssueCode> {
  const issues: RegistryIssue[] = [];
  const entries: RegistryEntry[] = [];

  for (const [index, input] of inputs.entries()) {
    if (!isPlainObject(input)) {
      issues.push({
        code: 'REGISTRY_ENTRY_NOT_AN_OBJECT',
        path: [index],
        message: messageFor('REGISTRY_ENTRY_NOT_AN_OBJECT', { actual: describeValue(input) }),
      });
      continue;
    }

    const result = entrySchema.safeParse(input);
    if (result.success) {
      entries.push(result.data);
      continue;
    }

    for (const normalized of normalizeZodIssues(result.error.issues, input)) {
      issues.push(toRegistryIssue(normalized, index));
    }
  }

  if (issues.length > 0) {
    return fail(issues);
  }

  const integrity = checkIntegrity(entries);
  const errors = integrity.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return fail(
      errors.map((issue) => ({
        code: issue.code,
        path: [issue.entryId],
        message: issue.message,
        ...(issue.hint === undefined ? {} : { hint: issue.hint }),
      })),
    );
  }

  return ok(createRegistry(entries, integrity));
}

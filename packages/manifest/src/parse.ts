import type { z } from 'zod';
import {
  type ManifestIssue,
  type ManifestIssueCode,
  type ManifestPathSegment,
  messageFor,
  suggest,
} from './errors.js';
import { fail, ok, type ParseResult } from './result.js';
import { type Manifest, manifestSchema } from './schema/manifest.js';
import { canonicalizeManifest } from './serialize.js';
import { isSupportedManifestVersion, MANIFEST_VERSION } from './version.js';

/**
 * Validation d'un manifest venu d'une source non fiable : un fichier écrit à
 * la main, un lien de partage (§20), ou une version différente de l'outil.
 *
 * Ne lève jamais. Renvoie une union discriminée : le CLI en fait une liste,
 * l'UI en fait des surlignages de champs.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lit la valeur d'entrée à un chemin donné, pour distinguer « absent » de « mal typé ». */
function valueAt(input: unknown, path: readonly ManifestPathSegment[]): unknown {
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

function describe(value: unknown): string {
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

function quote(value: unknown): string {
  return typeof value === 'string' ? `« ${value} »` : String(value);
}

/** Code explicitement attaché à une vérification personnalisée, s'il est valide. */
function explicitCode(issue: z.core.$ZodIssue): ManifestIssueCode | undefined {
  if (issue.code !== 'custom') {
    return undefined;
  }
  const declared = issue.params?.['pfCode'];
  return typeof declared === 'string' ? (declared as ManifestIssueCode) : undefined;
}

/**
 * Traduit une issue Zod en problème de manifest.
 *
 * La discrimination entre nom de projet et slug de technologie se fait sur le
 * chemin. Ce n'est pas fragile ici : le spec pose comme invariant que `name`
 * est le **seul** champ à contenu libre du manifest. Si cet invariant tombait
 * un jour, ce test-là échouerait, ce qui est exactement le comportement voulu.
 */
function translate(issue: z.core.$ZodIssue, input: unknown): ManifestIssue[] {
  const path = issue.path as ManifestPathSegment[];

  // Une valeur absente est un champ manquant, quelle que soit la façon dont Zod
  // l'a signalée — une énumération absente remonte en `invalid_value`, un objet
  // absent en `invalid_type`. Pour l'utilisateur c'est la même chose : il
  // manque un champ. `unrecognized_keys` est exclu : son chemin désigne l'objet
  // parent, pas la clé fautive.
  if (issue.code !== 'unrecognized_keys' && valueAt(input, path) === undefined) {
    const field = path.map(String).join('.');
    return [
      {
        code: 'MANIFEST_FIELD_REQUIRED',
        path,
        message: messageFor('MANIFEST_FIELD_REQUIRED', { field }),
      },
    ];
  }

  const declared = explicitCode(issue);

  if (declared !== undefined) {
    return [{ code: declared, path, message: messageFor(declared, { value: quote(issue.input) }) }];
  }

  switch (issue.code) {
    case 'unrecognized_keys':
      return issue.keys.map((key) => ({
        code: 'MANIFEST_UNKNOWN_FIELD' as const,
        path: [...path, key],
        message: messageFor('MANIFEST_UNKNOWN_FIELD', { field: key }),
      }));

    case 'invalid_value': {
      const accepted = issue.values.map(String);
      const raw = valueAt(input, path);
      const hint = typeof raw === 'string' ? suggest(raw, accepted) : undefined;
      return [
        {
          code: 'MANIFEST_ENUM_UNKNOWN',
          path,
          message: messageFor('MANIFEST_ENUM_UNKNOWN', {
            value: quote(raw),
            expected: accepted.join(', '),
          }),
          ...(hint === undefined ? {} : { hint: `Vouliez-vous dire « ${hint} » ?` }),
        },
      ];
    }

    case 'invalid_format':
    case 'too_small':
    case 'too_big': {
      const code: ManifestIssueCode =
        path[0] === 'name' ? 'MANIFEST_NAME_INVALID' : 'MANIFEST_SLUG_INVALID';
      return [{ code, path, message: messageFor(code, { value: quote(valueAt(input, path)) }) }];
    }

    case 'invalid_type': {
      const raw = valueAt(input, path);
      if (raw === undefined) {
        const field = path.map(String).join('.');
        return [
          {
            code: 'MANIFEST_FIELD_REQUIRED',
            path,
            message: messageFor('MANIFEST_FIELD_REQUIRED', { field }),
          },
        ];
      }
      return [
        {
          code: 'MANIFEST_TYPE_MISMATCH',
          path,
          message: messageFor('MANIFEST_TYPE_MISMATCH', {
            field: path.map(String).join('.'),
            expected: String(issue.expected),
            actual: describe(raw),
          }),
        },
      ];
    }

    default:
      return [
        {
          code: 'MANIFEST_TYPE_MISMATCH',
          path,
          message: messageFor('MANIFEST_TYPE_MISMATCH', {
            field: path.map(String).join('.'),
            expected: 'une valeur valide',
            actual: describe(valueAt(input, path)),
          }),
        },
      ];
  }
}

export function parseManifest(input: unknown): ParseResult<Manifest> {
  if (!isPlainObject(input)) {
    return fail([
      {
        code: 'MANIFEST_NOT_AN_OBJECT',
        path: [],
        message: messageFor('MANIFEST_NOT_AN_OBJECT', { actual: describe(input) }),
      },
    ]);
  }

  // La version se contrôle avant le schéma. Un manifest d'une autre version
  // produirait sinon une avalanche d'erreurs de champs, alors que la seule
  // chose utile à dire à l'utilisateur est que le format n'est pas le bon.
  if (!('manifestVersion' in input)) {
    return fail([
      {
        code: 'MANIFEST_VERSION_MISSING',
        path: ['manifestVersion'],
        message: messageFor('MANIFEST_VERSION_MISSING', {}),
      },
    ]);
  }

  if (!isSupportedManifestVersion(input['manifestVersion'])) {
    return fail([
      {
        code: 'MANIFEST_VERSION_UNSUPPORTED',
        path: ['manifestVersion'],
        message: messageFor('MANIFEST_VERSION_UNSUPPORTED', {
          value: String(input['manifestVersion']),
          supported: String(MANIFEST_VERSION),
        }),
      },
    ]);
  }

  const result = manifestSchema.safeParse(input);
  if (result.success) {
    // Normalisation ici, et pas seulement à la sérialisation : l'invariant
    // « après parseManifest, un manifest est en forme canonique » rend
    // `parse → serialize → parse` idempotent et permet de comparer deux
    // manifests par égalité structurelle, sans passer par leur chaîne.
    return ok(canonicalizeManifest(result.data));
  }

  return fail(result.error.issues.flatMap((issue) => translate(issue, input)));
}

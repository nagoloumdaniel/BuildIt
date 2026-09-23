import {
  describeValue,
  fail,
  isPlainObject,
  type NormalizedIssue,
  normalizeZodIssues,
  ok,
  type ParseResult,
  quoteValue,
} from '@project-factory/validation';
import { type ManifestIssue, type ManifestIssueCode, messageFor, suggest } from './errors.js';
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

/**
 * Traduit un descripteur neutre en problème de manifest.
 *
 * La discrimination entre nom de projet et slug de technologie se fait sur le
 * chemin. Ce n'est pas fragile ici : le spec pose comme invariant que `name`
 * est le **seul** champ à contenu libre du manifest. Si cet invariant tombait
 * un jour, le test correspondant échouerait, ce qui est le comportement voulu.
 */
function toManifestIssue(issue: NormalizedIssue): ManifestIssue {
  const field = issue.path.map(String).join('.');

  switch (issue.kind) {
    case 'unknown-field': {
      const key = String(issue.path.at(-1));
      return {
        code: 'MANIFEST_UNKNOWN_FIELD',
        path: issue.path,
        message: messageFor('MANIFEST_UNKNOWN_FIELD', { field: key }),
      };
    }

    case 'required':
      return {
        code: 'MANIFEST_FIELD_REQUIRED',
        path: issue.path,
        message: messageFor('MANIFEST_FIELD_REQUIRED', { field }),
      };

    case 'custom': {
      const code = issue.declaredCode as ManifestIssueCode;
      return {
        code,
        path: issue.path,
        message: messageFor(code, { value: quoteValue(issue.value) }),
      };
    }

    case 'enum-unknown': {
      const accepted = issue.acceptedValues ?? [];
      const hint = typeof issue.value === 'string' ? suggest(issue.value, accepted) : undefined;
      return {
        code: 'MANIFEST_ENUM_UNKNOWN',
        path: issue.path,
        message: messageFor('MANIFEST_ENUM_UNKNOWN', {
          value: quoteValue(issue.value),
          expected: accepted.join(', '),
        }),
        ...(hint === undefined ? {} : { hint: `Vouliez-vous dire « ${hint} » ?` }),
      };
    }

    case 'format': {
      const code: ManifestIssueCode =
        issue.path[0] === 'name' ? 'MANIFEST_NAME_INVALID' : 'MANIFEST_SLUG_INVALID';
      return {
        code,
        path: issue.path,
        message: messageFor(code, { value: quoteValue(issue.value) }),
      };
    }

    case 'type-mismatch':
      return {
        code: 'MANIFEST_TYPE_MISMATCH',
        path: issue.path,
        message: messageFor('MANIFEST_TYPE_MISMATCH', {
          field,
          expected: issue.expectedType ?? 'une valeur valide',
          actual: describeValue(issue.value),
        }),
      };
  }
}

export function parseManifest(input: unknown): ParseResult<Manifest, ManifestIssueCode> {
  if (!isPlainObject(input)) {
    return fail([
      {
        code: 'MANIFEST_NOT_AN_OBJECT',
        path: [],
        message: messageFor('MANIFEST_NOT_AN_OBJECT', { actual: describeValue(input) }),
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

  return fail(normalizeZodIssues(result.error.issues, input).map(toManifestIssue));
}

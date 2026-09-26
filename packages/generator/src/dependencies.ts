import type { RegistryEntry } from '@project-factory/registry';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';
import semver from 'semver';

/**
 * Résolution des dépendances npm d'une stack (§22, Dependency Resolver).
 *
 * Aucun accès réseau. Les versions viennent du registry, pas de `npm view` :
 * la génération doit fonctionner hors-ligne, et deux générations du même
 * manifest à trois mois d'écart doivent produire le même `package.json`.
 */

export const DEPENDENCY_ISSUE_CODES = [
  'GEN_DEPENDENCY_CONFLICT',
  'GEN_PACKAGE_ROLE_CONFLICT',
  'GEN_UNPINNED_DEPENDENCY',
] as const;

export type DependencyIssueCode = (typeof DEPENDENCY_ISSUE_CODES)[number];
export type DependencyIssue = Issue<DependencyIssueCode>;

const MESSAGES: Readonly<Record<DependencyIssueCode, string>> = {
  GEN_DEPENDENCY_CONFLICT:
    '{package} est demandé en {firstRange} par {first} et en {secondRange} par {second}. Aucune version ne satisfait les deux.',
  GEN_PACKAGE_ROLE_CONFLICT:
    '{package} est une dépendance de production pour {first} et de développement pour {second}. Il faut trancher avant de générer.',
  GEN_UNPINNED_DEPENDENCY:
    'Aucune version connue pour {package}, demandé par {first}. Il sera installé en « * », donc à la dernière version publiée — la génération ne sera pas reproductible.',
};

const messageFor = createMessageFormatter(MESSAGES);

/**
 * Ce qui réclame des paquets : une fiche du registry, ou une recette.
 *
 * Le sous-ensemble utile d'une fiche, et rien de plus — une recette s'y
 * convertit, et ses plages entrent en conflit avec celles des fiches par le
 * même code, avec les mêmes messages.
 */
export type DependencySource = Pick<
  RegistryEntry,
  'id' | 'name' | 'packages' | 'devPackages' | 'packageRanges' | 'versionRange'
>;

export interface ResolvedDependencies {
  /** Clés triées : deux générations identiques produisent le même package.json. */
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly warnings: readonly DependencyIssue[];
}

type Role = 'runtime' | 'dev';

interface Claim {
  readonly entry: DependencySource;
  readonly role: Role;
  readonly range: string | undefined;
}

/**
 * Plage d'un paquet pour une fiche donnée.
 *
 * `packageRanges` prime. À défaut, le paquet qui porte le nom de la fiche
 * hérite de son `versionRange` — c'est le cas courant (`next` installe `next`).
 * Un paquet satellite sans plage propre n'hérite de rien : appliquer la version
 * de Next.js à React serait faux.
 */
function rangeFor(entry: DependencySource, packageName: string): string | undefined {
  const declared = entry.packageRanges?.[packageName];
  if (declared !== undefined) {
    return declared;
  }
  return packageName === entry.id ? entry.versionRange : undefined;
}

function claimsOf(entries: readonly DependencySource[]): Map<string, Claim[]> {
  const claims = new Map<string, Claim[]>();

  function add(entry: DependencySource, packageName: string, role: Role): void {
    const bucket = claims.get(packageName) ?? [];
    bucket.push({ entry, role, range: rangeFor(entry, packageName) });
    claims.set(packageName, bucket);
  }

  for (const entry of entries) {
    for (const name of entry.packages ?? []) {
      add(entry, name, 'runtime');
    }
    for (const name of entry.devPackages ?? []) {
      add(entry, name, 'dev');
    }
  }

  return claims;
}

/**
 * Combine les plages demandées pour un même paquet.
 *
 * Deux plages séparées par une espace forment un ET en semver : `^19.0.0
 * ^19.2.0` n'est satisfait que par les versions qui conviennent aux deux. En
 * revanche `validRange` accepte aussi une combinaison que rien ne satisfait —
 * c'est `intersects` qui répond à la vraie question.
 */
function combine(
  packageName: string,
  claims: readonly Claim[],
): { range: string | undefined; issue: DependencyIssue | undefined } {
  const ranges: string[] = [];

  for (const claim of claims) {
    if (claim.range === undefined || semver.validRange(claim.range) === null) {
      continue;
    }
    if (ranges.includes(claim.range)) {
      continue;
    }
    const conflicting = claims.find(
      (other) =>
        other.range !== undefined &&
        ranges.includes(other.range) &&
        !semver.intersects(other.range, claim.range as string),
    );
    if (conflicting?.range !== undefined) {
      return {
        range: undefined,
        issue: {
          code: 'GEN_DEPENDENCY_CONFLICT',
          path: [packageName],
          message: messageFor('GEN_DEPENDENCY_CONFLICT', {
            package: packageName,
            first: conflicting.entry.name,
            firstRange: conflicting.range,
            second: claim.entry.name,
            secondRange: claim.range,
          }),
        },
      };
    }
    ranges.push(claim.range);
  }

  return { range: ranges.length === 0 ? undefined : ranges.join(' '), issue: undefined };
}

export function resolveDependencies(
  entries: readonly DependencySource[],
): ParseResult<ResolvedDependencies, DependencyIssueCode> {
  const errors: DependencyIssue[] = [];
  const warnings: DependencyIssue[] = [];
  const runtime = new Map<string, string>();
  const development = new Map<string, string>();

  for (const [packageName, claims] of claimsOf(entries)) {
    const runtimeClaim = claims.find((claim) => claim.role === 'runtime');
    const devClaim = claims.find((claim) => claim.role === 'dev');

    // Deux fiches qui rangent le même paquet dans deux sections différentes :
    // le générateur ne peut pas trancher à leur place sans se tromper une fois
    // sur deux.
    if (runtimeClaim !== undefined && devClaim !== undefined) {
      errors.push({
        code: 'GEN_PACKAGE_ROLE_CONFLICT',
        path: [packageName],
        message: messageFor('GEN_PACKAGE_ROLE_CONFLICT', {
          package: packageName,
          first: runtimeClaim.entry.name,
          second: devClaim.entry.name,
        }),
      });
      continue;
    }

    const { range, issue } = combine(packageName, claims);
    if (issue !== undefined) {
      errors.push(issue);
      continue;
    }

    if (range === undefined) {
      // « Jamais de * en silence » : le paquet est tout de même installé, mais
      // l'utilisateur sait que sa génération n'est pas reproductible.
      warnings.push({
        code: 'GEN_UNPINNED_DEPENDENCY',
        path: [packageName],
        message: messageFor('GEN_UNPINNED_DEPENDENCY', {
          package: packageName,
          first: claims[0]?.entry.name ?? packageName,
        }),
      });
    }

    const target = runtimeClaim !== undefined ? runtime : development;
    target.set(packageName, range ?? '*');
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    dependencies: sorted(runtime),
    devDependencies: sorted(development),
    warnings,
  });
}

function sorted(entries: ReadonlyMap<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of [...entries.keys()].sort()) {
    result[name] = entries.get(name) as string;
  }
  return result;
}

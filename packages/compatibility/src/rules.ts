import type { Target } from '@project-factory/manifest';
import type { RegistryEntry } from '@project-factory/registry';
import semver from 'semver';
import { isExclusive } from './arity.js';
import { type CompatibilityIssue, messageFor, RESTRICTIVE_LICENSES } from './errors.js';

/**
 * Les règles du §12, une fonction par règle.
 *
 * Un gros `validate()` qui les enchaînerait rendrait chaque correction
 * risquée : on ne saurait plus laquelle a produit tel message, ni laquelle on
 * casse en touchant une autre. Ici chaque règle se lit, se teste et se corrige
 * isolément, et chacune a son test positif et son test négatif.
 */

function error(
  code: CompatibilityIssue['code'],
  params: Readonly<Record<string, string>>,
  path: readonly (string | number)[] = [],
): CompatibilityIssue {
  return { code, severity: 'error', path, message: messageFor(code, params) };
}

function warning(
  code: CompatibilityIssue['code'],
  params: Readonly<Record<string, string>>,
  path: readonly (string | number)[] = [],
): CompatibilityIssue {
  return { code, severity: 'warning', path, message: messageFor(code, params) };
}

/**
 * Deux technologies d'une catégorie **exclusive** ne peuvent pas coexister.
 *
 * C'est la « détection des doublons » du §12 : deux solutions qui remplissent
 * la même capacité. L'arité de la catégorie décide — voir `arity.ts`.
 */
export function checkExclusiveCategories(entries: readonly RegistryEntry[]): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const byCategory = new Map<string, RegistryEntry[]>();

  for (const entry of entries) {
    const bucket = byCategory.get(entry.category) ?? [];
    bucket.push(entry);
    byCategory.set(entry.category, bucket);
  }

  for (const [category, group] of byCategory) {
    if (group.length < 2 || !isExclusive(category as RegistryEntry['category'])) {
      continue;
    }
    // Chaque paire une seule fois : signaler « a contre b » puis « b contre a »
    // doublerait la liste sans rien apprendre.
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i];
        const second = group[j];
        if (first === undefined || second === undefined) {
          continue;
        }
        issues.push(
          error('COMPAT_EXCLUSIVE_CATEGORY', { first: first.name, second: second.name, category }, [
            first.id,
            second.id,
          ]),
        );
      }
    }
  }

  return issues;
}

/** Conflit explicitement déclaré par une fiche (`conflictsWith`). */
export function checkDeclaredConflicts(entries: readonly RegistryEntry[]): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();

  for (const entry of entries) {
    for (const conflicting of entry.conflictsWith ?? []) {
      const other = byId.get(conflicting);
      if (other === undefined) {
        continue;
      }
      // Un conflit déclaré des deux côtés reste un seul problème.
      const pair = [entry.id, other.id].sort().join('|');
      if (seen.has(pair)) {
        continue;
      }
      seen.add(pair);
      issues.push(
        error('COMPAT_DECLARED_CONFLICT', { first: entry.name, second: other.name }, [
          entry.id,
          other.id,
        ]),
      );
    }
  }

  return issues;
}

/** Chaque technologie doit couvrir au moins une des plateformes choisies. */
export function checkTargets(
  entries: readonly RegistryEntry[],
  targets: readonly Target[],
): CompatibilityIssue[] {
  if (targets.length === 0) {
    return [error('COMPAT_NO_TARGET', {})];
  }

  const issues: CompatibilityIssue[] = [];
  for (const entry of entries) {
    const covered = entry.targets.some((target) => targets.includes(target));
    if (!covered) {
      issues.push(
        error(
          'COMPAT_TARGET_UNSUPPORTED',
          {
            value: entry.name,
            supported: entry.targets.join(', '),
            selected: targets.join(', '),
          },
          [entry.id],
        ),
      );
    }
  }
  return issues;
}

/**
 * Contraintes de runtime entre technologies (§12).
 *
 * La question n'est pas « telle version satisfait-elle telle plage » mais
 * « ces deux plages ont-elles une intersection ». Si une technologie exige
 * `node >=22` et une autre `node <18`, aucune version n'existe qui convienne —
 * indépendamment de ce qui est installé sur la machine.
 */
export function checkEngines(entries: readonly RegistryEntry[]): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const byRuntime = new Map<string, { entry: RegistryEntry; range: string }[]>();

  for (const entry of entries) {
    for (const [runtime, range] of Object.entries(entry.engines ?? {})) {
      // Une plage illisible est un défaut de fiche, pas une incompatibilité.
      // Le registry la refusera un jour ; ici on ne bloque pas l'utilisateur.
      if (semver.validRange(range) === null) {
        continue;
      }
      const bucket = byRuntime.get(runtime) ?? [];
      bucket.push({ entry, range });
      byRuntime.set(runtime, bucket);
    }
  }

  for (const [runtime, constraints] of byRuntime) {
    for (let i = 0; i < constraints.length; i += 1) {
      for (let j = i + 1; j < constraints.length; j += 1) {
        const first = constraints[i];
        const second = constraints[j];
        if (first === undefined || second === undefined) {
          continue;
        }
        if (!semver.intersects(first.range, second.range)) {
          issues.push(
            error(
              'COMPAT_ENGINE_UNSATISFIABLE',
              {
                runtime,
                first: first.entry.name,
                firstRange: first.range,
                second: second.entry.name,
                secondRange: second.range,
              },
              [first.entry.id, second.entry.id],
            ),
          );
        }
      }
    }
  }

  return issues;
}

/** Une technologie dépréciée reste utilisable, mais le dit (§7). */
export function checkDeprecated(entries: readonly RegistryEntry[]): CompatibilityIssue[] {
  return entries
    .filter((entry) => entry.status === 'deprecated')
    .map((entry) => warning('COMPAT_DEPRECATED_TECHNOLOGY', { value: entry.name }, [entry.id]));
}

/** Alerte sur les licences à contrainte de redistribution (§11). */
export function checkLicenses(entries: readonly RegistryEntry[]): CompatibilityIssue[] {
  return entries
    .filter((entry) => RESTRICTIVE_LICENSES.includes(entry.license))
    .map((entry) =>
      warning('COMPAT_RESTRICTIVE_LICENSE', { value: entry.name, license: entry.license }, [
        entry.id,
      ]),
    );
}

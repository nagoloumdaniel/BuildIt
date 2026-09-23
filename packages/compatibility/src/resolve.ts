import type { Target } from '@project-factory/manifest';
import type { Category, Registry, RegistryEntry } from '@project-factory/registry';
import { fail, ok, type ParseResult } from '@project-factory/validation';
import { type CompatibilityCode, type CompatibilityIssue, messageFor } from './errors.js';
import {
  checkDeclaredConflicts,
  checkDeprecated,
  checkEngines,
  checkExclusiveCategories,
  checkLicenses,
  checkTargets,
} from './rules.js';

/**
 * Résolution d'une sélection de technologies.
 *
 * Le moteur **complète** la sélection — il ajoute les dépendances obligatoires —
 * et dit ce qu'il a ajouté, avec la raison. Compléter en silence ferait
 * découvrir à l'utilisateur, au moment du rapport de génération, des paquets
 * qu'il n'a jamais choisis.
 */

export interface Selection {
  readonly targets: readonly Target[];
  readonly technologies: readonly string[];
}

export interface Addition {
  /** Technologie ajoutée par le moteur. */
  readonly id: string;
  /** Technologie qui l'exigeait. */
  readonly requiredBy: string;
}

export interface Resolution {
  /** Choisies et ajoutées, triées — la sortie ne dépend pas de l'ordre de saisie. */
  readonly technologies: readonly string[];
  readonly additions: readonly Addition[];
  /** `certified` seulement si **toutes** les technologies le sont. */
  readonly status: 'certified' | 'experimental';
  readonly warnings: readonly CompatibilityIssue[];
}

function issue(
  code: CompatibilityCode,
  params: Readonly<Record<string, string>>,
  path: readonly (string | number)[] = [],
): CompatibilityIssue {
  return { code, severity: 'error', path, message: messageFor(code, params) };
}

interface Expansion {
  readonly entries: RegistryEntry[];
  readonly additions: Addition[];
  readonly issues: CompatibilityIssue[];
}

/**
 * Suit les `requires` de façon transitive.
 *
 * La détection de cycle protège d'une boucle infinie sur un registry mal
 * formé. Le contrôle d'intégrité du registry ne l'attrape pas : un cycle est
 * fait de références parfaitement résolues.
 */
function expand(selection: Selection, registry: Registry): Expansion {
  const entries = new Map<string, RegistryEntry>();
  const additions: Addition[] = [];
  const issues: CompatibilityIssue[] = [];
  const visiting = new Set<string>();

  function walk(id: string, requiredBy: string | undefined): void {
    if (entries.has(id)) {
      return;
    }
    if (visiting.has(id)) {
      issues.push(
        issue('COMPAT_CIRCULAR_DEPENDENCY', { value: [...visiting, id].join(' → ') }, [id]),
      );
      return;
    }

    const entry = registry.get(id);
    if (entry === undefined) {
      issues.push(issue('COMPAT_UNKNOWN_TECHNOLOGY', { value: id }, [id]));
      return;
    }

    visiting.add(id);
    for (const dependency of entry.requires ?? []) {
      walk(dependency, id);
    }
    visiting.delete(id);

    entries.set(id, entry);
    if (requiredBy !== undefined) {
      additions.push({ id, requiredBy });
    }
  }

  for (const id of selection.technologies) {
    walk(id, undefined);
  }

  return { entries: [...entries.values()], additions, issues };
}

function partition(issues: readonly CompatibilityIssue[]): {
  errors: CompatibilityIssue[];
  warnings: CompatibilityIssue[];
} {
  return {
    errors: issues.filter((item) => item.severity === 'error'),
    warnings: issues.filter((item) => item.severity === 'warning'),
  };
}

/** Applique toutes les règles du §12 à un ensemble résolu. */
function applyRules(
  entries: readonly RegistryEntry[],
  targets: readonly Target[],
): CompatibilityIssue[] {
  return [
    ...checkTargets(entries, targets),
    ...checkExclusiveCategories(entries),
    ...checkDeclaredConflicts(entries),
    ...checkEngines(entries),
    ...checkDeprecated(entries),
    ...checkLicenses(entries),
  ];
}

export function resolve(
  selection: Selection,
  registry: Registry,
): ParseResult<Resolution, CompatibilityCode> {
  const expansion = expand(selection, registry);
  if (expansion.issues.length > 0) {
    return fail(expansion.issues);
  }

  const { errors, warnings } = partition(applyRules(expansion.entries, selection.targets));
  if (errors.length > 0) {
    return fail(errors);
  }

  // Une combinaison n'est certifiée que si chacune de ses pièces l'est. Le
  // statut est déduit, jamais déclaré : une table de combinaisons certifiées
  // serait ingérable face à la combinatoire du catalogue (§12).
  const uncertified = expansion.entries.filter((entry) => entry.generation !== 'certified');
  const status = uncertified.length === 0 ? 'certified' : 'experimental';

  const allWarnings = [...warnings];
  if (status === 'experimental') {
    allWarnings.unshift({
      code: 'COMPAT_EXPERIMENTAL_COMBINATION',
      severity: 'warning',
      path: uncertified.map((entry) => entry.id),
      message: messageFor('COMPAT_EXPERIMENTAL_COMBINATION', {
        value: uncertified.map((entry) => entry.name).join(', '),
      }),
    });
  }

  return ok({
    technologies: expansion.entries.map((entry) => entry.id).sort(),
    additions: expansion.additions,
    status,
    warnings: allWarnings,
  });
}

export interface Option {
  readonly entry: RegistryEntry;
  readonly state: 'selected' | 'available' | 'blocked';
  /** Pourquoi l'option est bloquée. Toujours présent quand `state` vaut `blocked`. */
  readonly reason?: string;
}

/**
 * Les options d'une catégorie, chacune avec son état — la fonction qui alimente
 * l'écran Stack Builder (§5).
 *
 * Elle ne renvoie **jamais** une liste filtrée. Masquer une option laisse
 * croire qu'elle n'existe pas ; la griser en disant pourquoi apprend quelque
 * chose à l'utilisateur. C'est la différence entre un outil qui décide à sa
 * place et un outil qui l'aide à décider.
 */
export function optionsFor(category: Category, selection: Selection, registry: Registry): Option[] {
  const selected = new Set(selection.technologies);

  return registry.query({ category }).map((entry) => {
    if (selected.has(entry.id)) {
      return { entry, state: 'selected' as const };
    }

    // On simule l'ajout plutôt que de réimplémenter les règles : la raison
    // affichée est exactement celle qui bloquerait la génération.
    const probe = resolve(
      { targets: selection.targets, technologies: [...selection.technologies, entry.id] },
      registry,
    );

    if (probe.ok) {
      return { entry, state: 'available' as const };
    }

    const blocking = probe.issues.find((item) => item.path.includes(entry.id)) ?? probe.issues[0];
    return {
      entry,
      state: 'blocked' as const,
      reason: blocking?.message ?? 'Incompatible avec la sélection en cours.',
    };
  });
}

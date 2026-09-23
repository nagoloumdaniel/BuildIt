import { CATEGORIES } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { CUMULATIVE_CATEGORIES, EXCLUSIVE_CATEGORIES, isExclusive } from './arity.js';

describe('couverture', () => {
  it('chaque catégorie du registry a une arité — aucune n’est oubliée', () => {
    for (const category of CATEGORIES) {
      const declared =
        (EXCLUSIVE_CATEGORIES as readonly string[]).includes(category) ||
        (CUMULATIVE_CATEGORIES as readonly string[]).includes(category);
      expect(declared, `arité manquante : ${category}`).toBe(true);
    }
  });

  it('aucune catégorie n’est déclarée dans les deux ensembles', () => {
    const both = EXCLUSIVE_CATEGORIES.filter((category) =>
      (CUMULATIVE_CATEGORIES as readonly string[]).includes(category),
    );
    expect(both).toEqual([]);
  });

  it('les deux ensembles couvrent exactement le registry', () => {
    const total = EXCLUSIVE_CATEGORIES.length + CUMULATIVE_CATEGORIES.length;
    expect(total).toBe(CATEGORIES.length);
  });
});

describe('isExclusive', () => {
  it.each(['frontend', 'database', 'orm', 'authentication', 'linting', 'hosting'] as const)(
    '%s est exclusive — un seul choix a du sens',
    (category) => {
      expect(isExclusive(category)).toBe(true);
    },
  );

  it.each(['testing', 'security', 'observability', 'ai', 'storage', 'validation'] as const)(
    '%s est cumulative — plusieurs choix coexistent',
    (category) => {
      expect(isExclusive(category)).toBe(false);
    },
  );

  it('testing est cumulative — c’est le contre-exemple qui a invalidé l’hypothèse initiale', () => {
    // vitest, playwright et testing-library sont tous trois dans `testing` et
    // cohabitent parfaitement. Déduire un conflit de la catégorie seule, comme
    // prévu au départ, aurait rendu le preset SaaS ingénérable.
    expect(isExclusive('testing')).toBe(false);
  });
});

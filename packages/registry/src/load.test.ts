import { describe, expect, it } from 'vitest';
import { loadRegistry } from './load.js';

const TYPESCRIPT = {
  id: 'typescript',
  name: 'TypeScript',
  category: 'language',
  targets: ['web', 'mobile', 'api'],
  status: 'stable',
  generation: 'certified',
  template: 'language/typescript',
  license: 'Apache-2.0',
  lastReviewedAt: '2026-09-23',
};

const NEXT = {
  id: 'next',
  name: 'Next.js',
  category: 'frontend',
  targets: ['web'],
  status: 'stable',
  generation: 'certified',
  template: 'frontend/next',
  license: 'MIT',
  lastReviewedAt: '2026-09-23',
  requires: ['typescript'],
};

const VUE = {
  id: 'vue',
  name: 'Vue',
  category: 'frontend',
  targets: ['web'],
  status: 'stable',
  generation: 'declared',
  license: 'MIT',
  lastReviewedAt: '2026-09-23',
};

function codesOf(inputs: unknown[]): string[] {
  const result = loadRegistry(inputs);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('chargement réussi', () => {
  it('charge un registry cohérent', () => {
    expect(loadRegistry([TYPESCRIPT, NEXT, VUE]).ok).toBe(true);
  });

  it('charge un registry vide', () => {
    expect(loadRegistry([]).ok).toBe(true);
  });
});

describe('fiche invalide', () => {
  it('signale une fiche malformée', () => {
    expect(codesOf([{ ...NEXT, id: 'Next.js' }])).toContain('REGISTRY_ID_INVALID');
  });

  it('signale un champ obligatoire absent', () => {
    const { license: _removed, ...incomplete } = NEXT;
    expect(codesOf([TYPESCRIPT, incomplete])).toContain('REGISTRY_FIELD_REQUIRED');
  });

  it('signale une catégorie inconnue, avec un indice', () => {
    const result = loadRegistry([{ ...VUE, category: 'frontent' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('REGISTRY_ENUM_UNKNOWN');
      expect(result.issues[0]?.hint).toContain('frontend');
    }
  });

  it('accepte une fiche certifiée sans template', () => {
    const { template: _removed, ...noTemplate } = NEXT;
    expect(codesOf([TYPESCRIPT, noTemplate])).toEqual([]);
  });

  it('signale une fiche déclarée avec template', () => {
    expect(codesOf([{ ...VUE, template: 'frontend/vue' }])).toContain(
      'REGISTRY_DECLARED_WITH_TEMPLATE',
    );
  });

  it('signale un champ inconnu', () => {
    expect(codesOf([{ ...VUE, populaire: true }])).toContain('REGISTRY_UNKNOWN_FIELD');
  });

  it.each([null, 42, 'texte', []])('signale une fiche qui n’est pas un objet : %s', (input) => {
    expect(codesOf([input])).toContain('REGISTRY_ENTRY_NOT_AN_OBJECT');
  });

  it('ne lève jamais', () => {
    for (const input of [null, undefined, 42, 'x', [], {}, [[]]]) {
      expect(() => loadRegistry([input])).not.toThrow();
    }
  });

  it('rapporte les problèmes de plusieurs fiches d’un coup', () => {
    const codes = codesOf([
      { ...NEXT, id: 'BAD' },
      { ...VUE, category: 'inconnue' },
    ]);
    expect(codes.length).toBeGreaterThanOrEqual(2);
  });

  it('signale un type incorrect', () => {
    expect(codesOf([{ ...VUE, targets: 'web' }])).toContain('REGISTRY_TYPE_MISMATCH');
  });

  it('signale un slug invalide dans une liste de relations', () => {
    expect(codesOf([{ ...VUE, compatibleWith: ['Next.js'] }])).toContain('REGISTRY_SLUG_INVALID');
  });

  it('situe la fiche fautive par son rang dans le chemin', () => {
    const result = loadRegistry([TYPESCRIPT, { ...VUE, id: 'BAD' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path[0]).toBe(1);
    }
  });
});

describe('intégrité', () => {
  it('signale une référence inexistante', () => {
    expect(codesOf([NEXT])).toContain('REGISTRY_UNKNOWN_REFERENCE');
  });

  it('signale un identifiant en double', () => {
    expect(codesOf([VUE, { ...VUE, name: 'Vue 3' }])).toContain('REGISTRY_DUPLICATE_ID');
  });

  it('ne contrôle l’intégrité que si toutes les fiches sont valides', () => {
    // Une fiche invalide fausserait l'ensemble des références : mieux vaut
    // demander de corriger la forme avant de parler de cohérence.
    const codes = codesOf([{ ...NEXT, id: 'BAD' }]);
    expect(codes).not.toContain('REGISTRY_UNKNOWN_REFERENCE');
  });

  it('propose une correction quand la référence est proche d’un identifiant connu', () => {
    const result = loadRegistry([TYPESCRIPT, { ...NEXT, requires: ['typescrpit'] }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.hint).toContain('typescript');
    }
  });

  it('un avertissement de fraîcheur ne bloque pas le chargement', () => {
    expect(loadRegistry([{ ...VUE, lastReviewedAt: '2020-01-01' }]).ok).toBe(true);
  });
});

describe('registry chargé — interrogation', () => {
  const registry = (() => {
    const result = loadRegistry([TYPESCRIPT, NEXT, VUE]);
    if (!result.ok) {
      throw new Error('fixture invalide');
    }
    return result.value;
  })();

  it('rend toutes les fiches', () => {
    expect(registry.entries()).toHaveLength(3);
  });

  it('retrouve une fiche par identifiant', () => {
    expect(registry.get('next')?.name).toBe('Next.js');
  });

  it('rend undefined pour un identifiant inconnu', () => {
    expect(registry.get('inexistant')).toBeUndefined();
  });

  it('filtre par catégorie', () => {
    expect(registry.query({ category: 'frontend' }).map((e) => e.id)).toEqual(['next', 'vue']);
  });

  it('filtre par cible', () => {
    expect(registry.query({ target: 'mobile' }).map((e) => e.id)).toEqual(['typescript']);
  });

  it('filtre par capacité de génération', () => {
    expect(registry.query({ generation: 'declared' }).map((e) => e.id)).toEqual(['vue']);
  });

  it('filtre par statut de cycle de vie', () => {
    expect(registry.query({ status: 'deprecated' })).toEqual([]);
  });

  it('combine les filtres', () => {
    expect(
      registry.query({ category: 'frontend', generation: 'certified' }).map((e) => e.id),
    ).toEqual(['next']);
  });

  it('sans filtre, rend tout', () => {
    expect(registry.query({})).toHaveLength(3);
  });

  it('rend les fiches triées par identifiant — ordre stable quel que soit l’ordre de chargement', () => {
    const shuffled = loadRegistry([VUE, NEXT, TYPESCRIPT]);
    expect(shuffled.ok).toBe(true);
    if (shuffled.ok) {
      expect(shuffled.value.entries().map((e) => e.id)).toEqual(
        registry.entries().map((e) => e.id),
      );
    }
  });

  it('expose les avertissements sans bloquer', () => {
    const result = loadRegistry([{ ...VUE, lastReviewedAt: '2020-01-01' }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings().map((w) => w.code)).toContain('REGISTRY_STALE_ENTRY');
    }
  });
});

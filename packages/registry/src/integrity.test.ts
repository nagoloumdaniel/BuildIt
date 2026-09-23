import { describe, expect, it } from 'vitest';
import { checkIntegrity } from './integrity.js';
import type { RegistryEntry } from './schema/entry.js';

function entry(patch: Partial<RegistryEntry> & { id: string }): RegistryEntry {
  return {
    name: patch.id,
    category: 'frontend',
    targets: ['web'],
    status: 'stable',
    generation: 'declared',
    license: 'MIT',
    lastReviewedAt: '2026-09-23',
    ...patch,
  };
}

function codesOf(entries: RegistryEntry[]): string[] {
  return checkIntegrity(entries).map((issue) => issue.code);
}

describe('registry cohérent', () => {
  it('ne signale rien', () => {
    expect(
      codesOf([
        entry({ id: 'typescript', category: 'language' }),
        entry({ id: 'next', requires: ['typescript'], compatibleWith: ['tailwind'] }),
        entry({ id: 'tailwind', category: 'styling' }),
      ]),
    ).toEqual([]);
  });

  it('accepte un registry vide', () => {
    expect(codesOf([])).toEqual([]);
  });
});

describe('unicité des identifiants', () => {
  it('signale deux fiches partageant un id', () => {
    expect(codesOf([entry({ id: 'next' }), entry({ id: 'next', category: 'backend' })])).toContain(
      'REGISTRY_DUPLICATE_ID',
    );
  });

  it('ne signale le doublon qu’une fois', () => {
    const codes = codesOf([entry({ id: 'next' }), entry({ id: 'next' }), entry({ id: 'next' })]);
    expect(codes.filter((code) => code === 'REGISTRY_DUPLICATE_ID')).toHaveLength(1);
  });
});

describe('références résolues', () => {
  it.each(['requires', 'compatibleWith', 'conflictsWith'])(
    'signale une référence inexistante dans %s',
    (field) => {
      expect(codesOf([entry({ id: 'next', [field]: ['inexistant'] })])).toContain(
        'REGISTRY_UNKNOWN_REFERENCE',
      );
    },
  );

  it('accepte une référence vers une fiche existante', () => {
    expect(
      codesOf([
        entry({ id: 'typescript', category: 'language' }),
        entry({ id: 'next', requires: ['typescript'] }),
      ]),
    ).toEqual([]);
  });

  it('propose une correction quand la référence est une faute de frappe', () => {
    const issues = checkIntegrity([
      entry({ id: 'typescript', category: 'language' }),
      entry({ id: 'next', requires: ['typescrpit'] }),
    ]);
    expect(issues[0]?.hint).toContain('typescript');
  });
});

describe('auto-référence', () => {
  it.each(['requires', 'compatibleWith', 'conflictsWith'])(
    'signale une fiche qui se cite elle-même dans %s',
    (field) => {
      expect(codesOf([entry({ id: 'next', [field]: ['next'] })])).toContain(
        'REGISTRY_SELF_REFERENCE',
      );
    },
  );
});

describe('contradiction', () => {
  it('signale un identifiant à la fois compatible et en conflit', () => {
    expect(
      codesOf([
        entry({ id: 'prisma', category: 'orm' }),
        entry({ id: 'next', compatibleWith: ['prisma'], conflictsWith: ['prisma'] }),
      ]),
    ).toContain('REGISTRY_CONTRADICTORY_RELATION');
  });
});

describe('cohérence de cible', () => {
  it('signale une dépendance qui ne couvre aucune cible commune', () => {
    expect(
      codesOf([
        entry({ id: 'expo-router', targets: ['mobile'] }),
        entry({ id: 'next', targets: ['web'], requires: ['expo-router'] }),
      ]),
    ).toContain('REGISTRY_TARGET_MISMATCH');
  });

  it('accepte une dépendance partageant au moins une cible', () => {
    expect(
      codesOf([
        entry({ id: 'typescript', category: 'language', targets: ['web', 'mobile', 'api'] }),
        entry({ id: 'next', targets: ['web'], requires: ['typescript'] }),
      ]),
    ).toEqual([]);
  });

  it('ne contraint pas compatibleWith — deux technos de plateformes différentes peuvent coexister', () => {
    expect(
      codesOf([
        entry({ id: 'expo', targets: ['mobile'] }),
        entry({ id: 'next', targets: ['web'], compatibleWith: ['expo'] }),
      ]),
    ).toEqual([]);
  });
});

describe('fraîcheur — §7', () => {
  it('avertit sans bloquer sur une fiche non revue depuis plus d’un an', () => {
    const issues = checkIntegrity([entry({ id: 'next', lastReviewedAt: '2020-01-01' })]);
    expect(issues.map((issue) => issue.code)).toContain('REGISTRY_STALE_ENTRY');
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('ne dit rien d’une fiche revue récemment', () => {
    expect(codesOf([entry({ id: 'next', lastReviewedAt: '2026-09-01' })])).toEqual([]);
  });
});

describe('sévérité', () => {
  it('une référence inexistante est une erreur, pas un avertissement', () => {
    const issues = checkIntegrity([entry({ id: 'next', requires: ['inexistant'] })]);
    expect(issues[0]?.severity).toBe('error');
  });
});

describe('rapport complet', () => {
  it('signale tous les problèmes d’un coup plutôt que de s’arrêter au premier', () => {
    const codes = codesOf([
      entry({ id: 'next', requires: ['inexistant'], conflictsWith: ['next'] }),
      entry({ id: 'next' }),
    ]);
    expect(new Set(codes).size).toBeGreaterThanOrEqual(3);
  });
});

import type { RegistryEntry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import {
  checkDeclaredConflicts,
  checkDeprecated,
  checkEngines,
  checkExclusiveCategories,
  checkLicenses,
  checkTargets,
} from './rules.js';

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

const codes = (issues: { code: string }[]): string[] => issues.map((issue) => issue.code);

/**
 * §12 énumère les règles de compatibilité. Chacune a ici un test positif et un
 * test négatif : prouver qu'une règle accepte ne dit rien tant qu'on n'a pas
 * prouvé qu'elle refuse.
 */

describe('exclusivité de catégorie', () => {
  it('accepte deux technologies de catégories différentes', () => {
    expect(
      codes(
        checkExclusiveCategories([
          entry({ id: 'next', category: 'frontend' }),
          entry({ id: 'prisma', category: 'orm' }),
        ]),
      ),
    ).toEqual([]);
  });

  it('accepte plusieurs technologies d’une catégorie cumulative', () => {
    expect(
      codes(
        checkExclusiveCategories([
          entry({ id: 'vitest', category: 'testing' }),
          entry({ id: 'playwright', category: 'testing' }),
          entry({ id: 'testing-library', category: 'testing' }),
        ]),
      ),
    ).toEqual([]);
  });

  it('refuse deux technologies d’une catégorie exclusive', () => {
    expect(
      codes(
        checkExclusiveCategories([
          entry({ id: 'prisma', category: 'orm' }),
          entry({ id: 'drizzle', category: 'orm' }),
        ]),
      ),
    ).toContain('COMPAT_EXCLUSIVE_CATEGORY');
  });

  it('nomme les deux technologies en cause', () => {
    const [issue] = checkExclusiveCategories([
      entry({ id: 'prisma', category: 'orm' }),
      entry({ id: 'drizzle', category: 'orm' }),
    ]);
    expect(issue?.message).toContain('prisma');
    expect(issue?.message).toContain('drizzle');
  });

  it('signale chaque paire une seule fois', () => {
    const issues = checkExclusiveCategories([
      entry({ id: 'a', category: 'orm' }),
      entry({ id: 'b', category: 'orm' }),
      entry({ id: 'c', category: 'orm' }),
    ]);
    expect(issues).toHaveLength(3);
  });
});

describe('conflits déclarés', () => {
  it('accepte deux technologies sans conflit déclaré', () => {
    expect(
      codes(
        checkDeclaredConflicts([
          entry({ id: 'next' }),
          entry({ id: 'prisma', category: 'orm', compatibleWith: ['next'] }),
        ]),
      ),
    ).toEqual([]);
  });

  it('refuse un conflit déclaré', () => {
    expect(
      codes(
        checkDeclaredConflicts([
          entry({ id: 'next', conflictsWith: ['htmx'] }),
          entry({ id: 'htmx' }),
        ]),
      ),
    ).toContain('COMPAT_DECLARED_CONFLICT');
  });

  it('ne signale rien si la technologie en conflit n’est pas sélectionnée', () => {
    expect(codes(checkDeclaredConflicts([entry({ id: 'next', conflictsWith: ['htmx'] })]))).toEqual(
      [],
    );
  });

  it('ne signale un conflit réciproque qu’une fois', () => {
    const issues = checkDeclaredConflicts([
      entry({ id: 'a', conflictsWith: ['b'] }),
      entry({ id: 'b', conflictsWith: ['a'] }),
    ]);
    expect(issues).toHaveLength(1);
  });
});

describe('cibles', () => {
  it('accepte une technologie couvrant une cible choisie', () => {
    expect(codes(checkTargets([entry({ id: 'next', targets: ['web'] })], ['web']))).toEqual([]);
  });

  it('accepte une technologie couvrant une cible parmi plusieurs', () => {
    expect(
      codes(checkTargets([entry({ id: 'nestjs', targets: ['api'] })], ['web', 'api'])),
    ).toEqual([]);
  });

  it('refuse une technologie ne couvrant aucune cible choisie', () => {
    expect(codes(checkTargets([entry({ id: 'nestjs', targets: ['api'] })], ['web']))).toContain(
      'COMPAT_TARGET_UNSUPPORTED',
    );
  });

  it('dit quelles cibles la technologie couvre et lesquelles ont été choisies', () => {
    const [issue] = checkTargets([entry({ id: 'nestjs', targets: ['api'] })], ['web']);
    expect(issue?.message).toContain('api');
    expect(issue?.message).toContain('web');
  });

  it('refuse une sélection sans aucune cible', () => {
    expect(codes(checkTargets([entry({ id: 'next' })], []))).toContain('COMPAT_NO_TARGET');
  });
});

describe('contraintes de runtime', () => {
  it('accepte deux plages qui se recouvrent', () => {
    expect(
      codes(
        checkEngines([
          entry({ id: 'next', engines: { node: '>=18.18.0' } }),
          entry({ id: 'vitest', engines: { node: '>=20.0.0' } }),
        ]),
      ),
    ).toEqual([]);
  });

  it('accepte une technologie sans contrainte', () => {
    expect(
      codes(
        checkEngines([entry({ id: 'next', engines: { node: '>=18.18.0' } }), entry({ id: 'x' })]),
      ),
    ).toEqual([]);
  });

  it('refuse deux plages disjointes', () => {
    expect(
      codes(
        checkEngines([
          entry({ id: 'moderne', engines: { node: '>=22.0.0' } }),
          entry({ id: 'ancien', engines: { node: '<18.0.0' } }),
        ]),
      ),
    ).toContain('COMPAT_ENGINE_UNSATISFIABLE');
  });

  it('ne compare que les plages du même runtime', () => {
    expect(
      codes(
        checkEngines([
          entry({ id: 'a', engines: { node: '>=22.0.0' } }),
          entry({ id: 'b', engines: { bun: '<1.0.0' } }),
        ]),
      ),
    ).toEqual([]);
  });

  it('nomme le runtime et les deux plages', () => {
    const [issue] = checkEngines([
      entry({ id: 'moderne', engines: { node: '>=22.0.0' } }),
      entry({ id: 'ancien', engines: { node: '<18.0.0' } }),
    ]);
    expect(issue?.message).toContain('node');
    expect(issue?.message).toContain('>=22.0.0');
    expect(issue?.message).toContain('<18.0.0');
  });

  it('ignore une plage syntaxiquement invalide plutôt que de lever', () => {
    expect(() =>
      checkEngines([
        entry({ id: 'a', engines: { node: 'pas une plage' } }),
        entry({ id: 'b', engines: { node: '>=20.0.0' } }),
      ]),
    ).not.toThrow();
  });
});

describe('dépréciation', () => {
  it('ne dit rien d’une technologie stable', () => {
    expect(codes(checkDeprecated([entry({ id: 'next', status: 'stable' })]))).toEqual([]);
  });

  it('avertit sur une technologie dépréciée', () => {
    const issues = checkDeprecated([entry({ id: 'vieux', status: 'deprecated' })]);
    expect(codes(issues)).toContain('COMPAT_DEPRECATED_TECHNOLOGY');
    expect(issues[0]?.severity).toBe('warning');
  });
});

describe('licences — §11', () => {
  it('ne dit rien d’une licence permissive', () => {
    expect(codes(checkLicenses([entry({ id: 'next', license: 'MIT' })]))).toEqual([]);
  });

  it.each(['AGPL-3.0', 'SSPL-1.0', 'BSL-1.1', 'Elastic-2.0'] as const)(
    'avertit sur une licence %s',
    (license) => {
      const issues = checkLicenses([entry({ id: 'x', license })]);
      expect(codes(issues)).toContain('COMPAT_RESTRICTIVE_LICENSE');
      expect(issues[0]?.severity).toBe('warning');
    },
  );

  it('nomme la licence en cause', () => {
    const [issue] = checkLicenses([entry({ id: 'mongodb', license: 'SSPL-1.0' })]);
    expect(issue?.message).toContain('SSPL-1.0');
  });
});

describe('tous les messages sont exploitables', () => {
  it('aucun message vide ni marqueur non remplacé', () => {
    const issues = [
      ...checkExclusiveCategories([
        entry({ id: 'a', category: 'orm' }),
        entry({ id: 'b', category: 'orm' }),
      ]),
      ...checkDeclaredConflicts([entry({ id: 'a', conflictsWith: ['b'] }), entry({ id: 'b' })]),
      ...checkTargets([entry({ id: 'a', targets: ['api'] })], ['web']),
      ...checkEngines([
        entry({ id: 'a', engines: { node: '>=22.0.0' } }),
        entry({ id: 'b', engines: { node: '<18.0.0' } }),
      ]),
      ...checkDeprecated([entry({ id: 'a', status: 'deprecated' })]),
      ...checkLicenses([entry({ id: 'a', license: 'AGPL-3.0' })]),
    ];
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(0);
      expect(issue.message).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });
});

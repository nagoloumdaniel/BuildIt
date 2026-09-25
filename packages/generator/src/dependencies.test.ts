import type { RegistryEntry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { resolveDependencies } from './dependencies.js';

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

function resolved(entries: RegistryEntry[]) {
  const result = resolveDependencies(entries);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(' | '));
  }
  return result.value;
}

function codesOf(entries: RegistryEntry[]): string[] {
  const result = resolveDependencies(entries);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('répartition production / développement', () => {
  it('place les paquets de production dans dependencies', () => {
    const value = resolved([
      entry({ id: 'next', packages: ['next'], packageRanges: { next: '^15.0.0' } }),
    ]);
    expect(value.dependencies).toEqual({ next: '^15.0.0' });
    expect(value.devDependencies).toEqual({});
  });

  it('place les paquets de développement dans devDependencies', () => {
    const value = resolved([
      entry({
        id: 'vitest',
        category: 'testing',
        devPackages: ['vitest'],
        packageRanges: { vitest: '^3.0.0' },
      }),
    ]);
    expect(value.devDependencies).toEqual({ vitest: '^3.0.0' });
    expect(value.dependencies).toEqual({});
  });

  it('sépare les deux rôles d’une même fiche — le cas Prisma', () => {
    // `prisma` est la CLI, `@prisma/client` tourne à l'exécution. C'est ce cas
    // qui impose une distinction au paquet et non à la fiche.
    const value = resolved([
      entry({
        id: 'prisma',
        category: 'orm',
        packages: ['@prisma/client'],
        devPackages: ['prisma'],
        packageRanges: { prisma: '^6.0.0', '@prisma/client': '^6.0.0' },
      }),
    ]);
    expect(value.dependencies).toEqual({ '@prisma/client': '^6.0.0' });
    expect(value.devDependencies).toEqual({ prisma: '^6.0.0' });
  });

  it('agrège plusieurs fiches', () => {
    const value = resolved([
      entry({ id: 'next', packages: ['next'], packageRanges: { next: '^15.0.0' } }),
      entry({
        id: 'stripe',
        category: 'payments',
        packages: ['stripe'],
        packageRanges: { stripe: '^18.0.0' },
      }),
    ]);
    expect(Object.keys(value.dependencies)).toEqual(['next', 'stripe']);
  });

  it('trie les paquets par nom — un package.json reproductible', () => {
    const value = resolved([
      entry({
        id: 'x',
        packages: ['zod', 'axios', 'next'],
        packageRanges: { zod: '^4.0.0', axios: '^1.0.0', next: '^15.0.0' },
      }),
    ]);
    expect(Object.keys(value.dependencies)).toEqual(['axios', 'next', 'zod']);
  });

  it('rend des objets vides pour une stack sans paquet', () => {
    const value = resolved([entry({ id: 'postgresql', category: 'database' })]);
    expect(value.dependencies).toEqual({});
    expect(value.devDependencies).toEqual({});
  });
});

describe('origine de la plage de versions', () => {
  it('utilise packageRanges en priorité', () => {
    const value = resolved([
      entry({
        id: 'next',
        packages: ['next'],
        versionRange: '>=1.0.0',
        packageRanges: { next: '^15.0.0' },
      }),
    ]);
    expect(value.dependencies['next']).toBe('^15.0.0');
  });

  it('retombe sur versionRange pour le paquet homonyme de la fiche', () => {
    const value = resolved([entry({ id: 'next', packages: ['next'], versionRange: '^15.0.0' })]);
    expect(value.dependencies['next']).toBe('^15.0.0');
  });

  it('n’applique pas versionRange à un paquet qui ne porte pas le nom de la fiche', () => {
    const value = resolved([entry({ id: 'next', packages: ['react'], versionRange: '^15.0.0' })]);
    expect(value.dependencies['react']).toBe('*');
  });
});

/**
 * §22, décision du spec : « jamais de `*` en silence ». Une version non épinglée
 * rend la génération non reproductible — on l'écrit quand même, mais on le dit.
 */
describe('versions non épinglées', () => {
  it('avertit sur un paquet sans plage connue', () => {
    const value = resolved([entry({ id: 'next', packages: ['react'] })]);
    expect(value.warnings.map((warning) => warning.code)).toContain('GEN_UNPINNED_DEPENDENCY');
  });

  it('écrit tout de même le paquet, en plage ouverte', () => {
    const value = resolved([entry({ id: 'next', packages: ['react'] })]);
    expect(value.dependencies['react']).toBe('*');
  });

  it('nomme le paquet et la fiche fautive', () => {
    const value = resolved([entry({ id: 'next', packages: ['react'] })]);
    expect(value.warnings[0]?.message).toContain('react');
    expect(value.warnings[0]?.message).toContain('next');
  });

  it('ne dit rien quand tout est épinglé', () => {
    const value = resolved([
      entry({ id: 'next', packages: ['next'], packageRanges: { next: '^15.0.0' } }),
    ]);
    expect(value.warnings).toEqual([]);
  });
});

describe('un paquet déclaré par deux fiches', () => {
  it('combine deux plages compatibles', () => {
    const value = resolved([
      entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
      entry({ id: 'b', category: 'ui', packages: ['react'], packageRanges: { react: '^19.2.0' } }),
    ]);
    expect(value.dependencies['react']).toBe('^19.0.0 ^19.2.0');
  });

  it('ne duplique pas une plage identique', () => {
    const value = resolved([
      entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
      entry({ id: 'b', category: 'ui', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
    ]);
    expect(value.dependencies['react']).toBe('^19.0.0');
  });

  it('refuse deux plages sans version commune', () => {
    expect(
      codesOf([
        entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
        entry({
          id: 'b',
          category: 'ui',
          packages: ['react'],
          packageRanges: { react: '^18.0.0' },
        }),
      ]),
    ).toContain('GEN_DEPENDENCY_CONFLICT');
  });

  it('nomme les deux fiches et les deux plages', () => {
    const result = resolveDependencies([
      entry({ id: 'alpha', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
      entry({
        id: 'beta',
        category: 'ui',
        packages: ['react'],
        packageRanges: { react: '^18.0.0' },
      }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const message = result.issues[0]?.message ?? '';
      expect(message).toContain('alpha');
      expect(message).toContain('beta');
      expect(message).toContain('^19.0.0');
      expect(message).toContain('^18.0.0');
    }
  });

  it('refuse un paquet de production dans une fiche et de développement dans l’autre', () => {
    expect(
      codesOf([
        entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
        entry({
          id: 'b',
          category: 'ui',
          devPackages: ['react'],
          packageRanges: { react: '^19.0.0' },
        }),
      ]),
    ).toContain('GEN_PACKAGE_ROLE_CONFLICT');
  });

  it('ignore une plage syntaxiquement invalide plutôt que de lever', () => {
    expect(() =>
      resolveDependencies([
        entry({ id: 'a', packages: ['react'], packageRanges: { react: 'pas une plage' } }),
      ]),
    ).not.toThrow();
  });
});

describe('resolveDependencies ne lève jamais', () => {
  it('sur une stack vide', () => {
    expect(resolveDependencies([]).ok).toBe(true);
  });

  it('sur des fiches sans aucun champ de paquet', () => {
    expect(() => resolveDependencies([entry({ id: 'a' }), entry({ id: 'b' })])).not.toThrow();
  });
});

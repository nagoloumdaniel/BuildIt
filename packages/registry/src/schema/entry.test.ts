import { describe, expect, it } from 'vitest';
import { CATEGORIES, entrySchema, GENERATION_STATUSES, LIFECYCLE_STATUSES } from './entry.js';

/** Fiche minimale valide — base de tous les tests de rejet. */
const VALID = {
  id: 'better-auth',
  name: 'Better Auth',
  category: 'authentication',
  targets: ['web', 'api'],
  status: 'stable',
  generation: 'declared',
  license: 'MIT',
  lastReviewedAt: '2026-09-23',
};

function accepts(patch: Record<string, unknown>): boolean {
  return entrySchema.safeParse({ ...VALID, ...patch }).success;
}

describe('énumérations', () => {
  it('les catégories couvrent les familles du §7', () => {
    for (const expected of ['frontend', 'authentication', 'database', 'orm', 'ci-cd']) {
      expect(CATEGORIES).toContain(expected);
    }
  });

  it('les catégories sont uniques', () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
  });

  it('le cycle de vie suit le §7', () => {
    expect([...LIFECYCLE_STATUSES]).toEqual(['stable', 'beta', 'deprecated']);
  });

  it('le statut de génération n’a que deux valeurs', () => {
    expect([...GENERATION_STATUSES]).toEqual(['certified', 'declared']);
  });
});

describe('fiche valide', () => {
  it('accepte la fiche minimale', () => {
    expect(entrySchema.safeParse(VALID).success).toBe(true);
  });

  it('accepte une fiche complète', () => {
    expect(
      accepts({
        generation: 'certified',
        template: 'auth/better-auth',
        versionRange: '>=1.0.0 <2.0.0',
        requires: ['typescript'],
        compatibleWith: ['next', 'prisma'],
        conflictsWith: ['authjs'],
        packages: ['better-auth'],
        env: ['BETTER_AUTH_SECRET'],
        recipes: ['email-password', 'oauth'],
        docs: 'https://better-auth.com',
      }),
    ).toBe(true);
  });
});

describe('identifiant', () => {
  it.each(['Better-Auth', 'better_auth', 'better auth', '-better', 'better-', ''])(
    'refuse %s',
    (id) => {
      expect(accepts({ id })).toBe(false);
    },
  );

  it('accepte un slug kebab-case', () => {
    expect(accepts({ id: 'github-actions' })).toBe(true);
  });
});

describe('champs obligatoires', () => {
  it.each([
    'id',
    'name',
    'category',
    'targets',
    'status',
    'generation',
    'license',
    'lastReviewedAt',
  ])('refuse une fiche sans %s', (field) => {
    const input: Record<string, unknown> = { ...VALID };
    delete input[field];
    expect(entrySchema.safeParse(input).success).toBe(false);
  });
});

describe('cibles', () => {
  it('refuse une liste vide', () => {
    expect(accepts({ targets: [] })).toBe(false);
  });

  it('refuse un doublon', () => {
    expect(accepts({ targets: ['web', 'web'] })).toBe(false);
  });

  it('refuse une cible inconnue', () => {
    expect(accepts({ targets: ['ios'] })).toBe(false);
  });
});

describe('lien entre generation et template', () => {
  it('refuse une fiche certifiée sans template — elle promettrait ce qui n’existe pas', () => {
    expect(accepts({ generation: 'certified' })).toBe(false);
  });

  it('accepte une fiche certifiée avec template', () => {
    expect(accepts({ generation: 'certified', template: 'auth/better-auth' })).toBe(true);
  });

  it('refuse une fiche déclarée avec template — elle ment dans l’autre sens', () => {
    expect(accepts({ generation: 'declared', template: 'auth/better-auth' })).toBe(false);
  });
});

describe('date de revue', () => {
  it.each(['2026-13-01', '23/09/2026', '2026-9-3', 'hier', ''])('refuse %s', (date) => {
    expect(accepts({ lastReviewedAt: date })).toBe(false);
  });

  it('refuse une date dans le futur', () => {
    expect(accepts({ lastReviewedAt: '2099-01-01' })).toBe(false);
  });

  it('accepte une date passée', () => {
    expect(accepts({ lastReviewedAt: '2025-01-15' })).toBe(true);
  });
});

describe('variables d’environnement — §24', () => {
  it('accepte des noms de variables', () => {
    expect(accepts({ env: ['DATABASE_URL', 'BETTER_AUTH_SECRET'] })).toBe(true);
  });

  it.each([
    ['une affectation', 'DATABASE_URL=postgres://user:pass@host/db'],
    ['des minuscules', 'database_url'],
    ['un tiret', 'DATABASE-URL'],
    ['un espace', 'DATABASE URL'],
  ])('refuse %s — aucune valeur ne doit pouvoir entrer', (_label, value) => {
    expect(accepts({ env: [value] })).toBe(false);
  });
});

describe('licence', () => {
  it.each(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'AGPL-3.0', 'Proprietary'])(
    'accepte %s',
    (license) => {
      expect(accepts({ license })).toBe(true);
    },
  );

  it('refuse une licence inconnue — une licence mal orthographiée est une alerte juridique manquée', () => {
    expect(accepts({ license: 'MIT-ish' })).toBe(false);
  });
});

describe('champs libres', () => {
  it('refuse un champ inconnu', () => {
    expect(accepts({ populaire: true })).toBe(false);
  });

  it('refuse un nom vide', () => {
    expect(accepts({ name: '' })).toBe(false);
  });

  it('refuse une URL de documentation non http(s)', () => {
    expect(accepts({ docs: 'ftp://exemple.com' })).toBe(false);
  });
});

describe('paquets et plages de versions', () => {
  it('accepte des paquets de production et de développement distincts', () => {
    expect(
      accepts({
        packages: ['@prisma/client'],
        devPackages: ['prisma'],
        packageRanges: { prisma: '^6.0.0', '@prisma/client': '^6.0.0' },
      }),
    ).toBe(true);
  });

  it('refuse un paquet à la fois de production et de développement', () => {
    expect(accepts({ packages: ['prisma'], devPackages: ['prisma'] })).toBe(false);
  });

  it('refuse une plage pour un paquet que la fiche n’installe pas', () => {
    expect(accepts({ packages: ['prisma'], packageRanges: { autre: '^1.0.0' } })).toBe(false);
  });

  it('accepte une fiche sans aucun paquet', () => {
    expect(accepts({})).toBe(true);
  });

  it('refuse une plage vide', () => {
    expect(accepts({ packages: ['prisma'], packageRanges: { prisma: '' } })).toBe(false);
  });
});

import { CATEGORIES } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { CUMULATIVE_CATEGORIES, canCoexist, EXCLUSIVE_CATEGORIES, isExclusive } from './arity.js';

describe('couverture', () => {
  it('chaque catégorie du registry a une arité aucune n’est oubliée', () => {
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
  it.each(['frontend', 'backend', 'database', 'orm', 'authentication', 'formatting'] as const)(
    '%s est exclusive : un seul choix a du sens',
    (category) => {
      expect(isExclusive(category)).toBe(true);
    },
  );

  it.each([
    'testing',
    'security',
    'observability',
    'ai',
    'storage',
    'validation',
    // L'audit de compatibilité : ces catégories refusaient des paires standard.
    'language',
    'styling',
    'ui',
    'linting',
    'containers',
    'hosting',
    'payments',
    'package-manager',
  ] as const)('%s est cumulative : plusieurs choix coexistent', (category) => {
    expect(isExclusive(category)).toBe(false);
  });

  it('testing est cumulative c’est le contre-exemple qui a invalidé l’hypothèse initiale', () => {
    // vitest, playwright et testing-library sont tous trois dans `testing` et
    // cohabitent parfaitement. Déduire un conflit de la catégorie seule, comme
    // prévu au départ, aurait rendu le preset SaaS ingénérable.
    expect(isExclusive('testing')).toBe(false);
  });
});

describe('canCoexist la plateforme décide, pas la catégorie seule', () => {
  it('deux plateformes disjointes cohabitent : Next.js (web) et Expo (mobile)', () => {
    // C'est le cas rapporté : un projet web + mobile doit pouvoir choisir les
    // deux frameworks, une application chacun.
    expect(canCoexist(['web'], ['mobile'])).toBe(true);
  });

  it('la même plateforme reste une concurrence : React et Vue sur le web', () => {
    expect(canCoexist(['web'], ['web'])).toBe(false);
    // Un recoupement partiel suffit : les deux visent le web.
    expect(canCoexist(['web'], ['mobile', 'web'])).toBe(false);
  });

  it('des plateformes multiples se recoupent dès qu’un point commun existe', () => {
    // Deux backends visent `api` tous les deux, deux bases le web et l'API.
    expect(canCoexist(['api'], ['api'])).toBe(false);
    expect(canCoexist(['web', 'api'], ['api', 'library'])).toBe(false);
  });

  it('une fiche sans plateforme ne cohabite avec rien', () => {
    expect(canCoexist([], ['web'])).toBe(false);
  });
});

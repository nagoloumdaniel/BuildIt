import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadRecipeCatalogue, loadRecipes } from './load.js';

/** Une recette valide, que chaque test abîme d'une seule façon. */
const VALID = {
  id: 'better-auth-email-password',
  name: 'Better Auth — email et mot de passe',
  description: 'Connexion par email et mot de passe.',
  for: ['better-auth'],
  packages: { 'better-auth': '>=1.0.0 <2.0.0' },
  devPackages: { '@types/bcrypt': '^5.0.0' },
  env: ['BETTER_AUTH_SECRET'],
  files: [{ template: 'recipes/better-auth/auth.ts', target: 'lib/auth.ts' }],
};

function codes(raw: unknown[]): string[] {
  const result = loadRecipes(raw);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('schéma d’une recette', () => {
  it('accepte une recette complète', () => {
    expect(codes([VALID])).toEqual([]);
  });

  it('accepte une recette minimale, sans paquet ni fichier', () => {
    expect(codes([{ id: 'x', name: 'X', description: 'x', for: ['a'] }])).toEqual([]);
  });

  it('refuse un champ inconnu — une faute de frappe ne passe pas en silence', () => {
    expect(codes([{ ...VALID, pakages: {} }])).toEqual(['RECIPE_UNKNOWN_FIELD']);
  });

  it('refuse un champ obligatoire absent', () => {
    const { description: _omitted, ...rest } = VALID;
    expect(codes([rest])).toEqual(['RECIPE_FIELD_REQUIRED']);
  });

  it('refuse une recette qui ne s’applique à rien', () => {
    expect(codes([{ ...VALID, for: [] }])).toContain('RECIPE_FORMAT_INVALID');
  });

  it('accepte des technologies exigées, en plus de celles qui portent la recette', () => {
    expect(codes([{ ...VALID, requires: ['next', 'prisma'] }])).toEqual([]);
  });

  it('refuse une technologie exigée qui n’est pas un slug', () => {
    expect(codes([{ ...VALID, requires: ['Next JS'] }])).toEqual(['RECIPE_FORMAT_INVALID']);
  });

  it('refuse un identifiant qui n’est pas un slug', () => {
    expect(codes([{ ...VALID, id: 'Better Auth' }])).toEqual(['RECIPE_FORMAT_INVALID']);
  });

  it('refuse une variable d’environnement qui ressemble à une valeur', () => {
    expect(codes([{ ...VALID, env: ['AKIAIOSFODNN7EXAMPLE=secret'] }])).toEqual([
      'RECIPE_FORMAT_INVALID',
    ]);
  });

  it('refuse une plage de version vide', () => {
    expect(codes([{ ...VALID, packages: { 'better-auth': '' } }])).toEqual([
      'RECIPE_FORMAT_INVALID',
    ]);
  });

  it('refuse un nom de paquet invalide', () => {
    expect(codes([{ ...VALID, packages: { 'Pas Un Paquet': '^1.0.0' } }])).toEqual([
      'RECIPE_FORMAT_INVALID',
    ]);
  });

  it.each([
    '../../etc/passwd',
    '/etc/passwd',
    'lib/../../dehors.ts',
    'C:/Windows/x.ts',
    'lib\\auth.ts',
    './lib/auth.ts',
    '',
  ])('refuse un chemin cible qui pourrait sortir du projet : %s', (target) => {
    expect(codes([{ ...VALID, files: [{ template: 'a/b.ts', target }] }])).toContain(
      'RECIPE_PATH_UNSAFE',
    );
  });

  it('refuse un chemin de template qui remonte', () => {
    expect(codes([{ ...VALID, files: [{ template: '../hors.ts', target: 'a.ts' }] }])).toEqual([
      'RECIPE_PATH_UNSAFE',
    ]);
  });

  it('refuse deux fichiers de la même recette vers la même cible', () => {
    expect(
      codes([
        {
          ...VALID,
          files: [
            { template: 'a.ts', target: 'lib/auth.ts' },
            { template: 'b.ts', target: 'lib/auth.ts' },
          ],
        },
      ]),
    ).toEqual(['RECIPE_DUPLICATE_TARGET']);
  });

  it('refuse un type inattendu', () => {
    expect(codes([{ ...VALID, env: 'BETTER_AUTH_SECRET' }])).toEqual(['RECIPE_TYPE_MISMATCH']);
  });
});

describe('chargement', () => {
  it('refuse une recette qui n’est pas un objet', () => {
    expect(codes(['pas un objet'])).toEqual(['RECIPE_NOT_OBJECT']);
  });

  it('refuse deux recettes de même identifiant', () => {
    expect(codes([VALID, VALID])).toEqual(['RECIPE_DUPLICATE_ID']);
  });

  it('rassemble tous les problèmes d’un coup, avec la position de la recette', () => {
    const result = loadRecipes([VALID, 'x', { ...VALID, id: 'y', pakages: {} }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.path[0])).toEqual([1, 2]);
    }
  });

  it('chaque message nomme le champ ou la valeur en cause', () => {
    const result = loadRecipes([{ ...VALID, pakages: {} }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('pakages');
    }
  });
});

describe('interrogation', () => {
  const catalogue = (() => {
    const result = loadRecipes([
      VALID,
      { id: 'better-auth-oauth', name: 'OAuth', description: 'x', for: ['better-auth'] },
      { id: 'stripe-checkout', name: 'Checkout', description: 'x', for: ['stripe'] },
    ]);
    if (!result.ok) {
      throw new Error('fixture invalide');
    }
    return result.value;
  })();

  it('retrouve une recette par identifiant', () => {
    expect(catalogue.get('stripe-checkout')?.name).toBe('Checkout');
    expect(catalogue.get('inconnue')).toBeUndefined();
  });

  it('liste les recettes applicables à une technologie, triées', () => {
    expect(catalogue.recipesFor('better-auth').map((recipe) => recipe.id)).toEqual([
      'better-auth-email-password',
      'better-auth-oauth',
    ]);
    expect(catalogue.recipesFor('prisma')).toEqual([]);
  });

  it('liste tout, trié', () => {
    expect(catalogue.all().map((recipe) => recipe.id)).toEqual([
      'better-auth-email-password',
      'better-auth-oauth',
      'stripe-checkout',
    ]);
  });
});

describe('catalogue officiel', () => {
  it('se charge sans erreur', () => {
    const result = loadRecipeCatalogue();
    expect(result.ok, result.ok ? '' : result.issues.map((i) => i.message).join(' | ')).toBe(true);
  });

  it('l’index engendré n’a pas dérivé de data/', () => {
    expect(() =>
      execFileSync('node', ['scripts/build-index.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});

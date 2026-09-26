import { loadRecipes, type RecipeCatalogue } from '@project-factory/recipes';
import type { RegistryEntry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { recipeAsDependencySource, resolveRecipes } from './recipes.js';

function entry(id: string): RegistryEntry {
  return {
    id,
    name: id,
    category: 'authentication',
    targets: ['web'],
    status: 'stable',
    generation: 'declared',
    license: 'MIT',
    lastReviewedAt: '2026-09-23',
  };
}

const CATALOGUE: RecipeCatalogue = (() => {
  const result = loadRecipes([
    {
      id: 'better-auth-email-password',
      name: 'Email',
      description: 'x',
      for: ['better-auth'],
      packages: { 'better-auth': '^1.0.0' },
      devPackages: { '@types/node': '^24.0.0' },
    },
    { id: 'stripe-checkout', name: 'Checkout', description: 'x', for: ['stripe'] },
  ]);
  if (!result.ok) {
    throw new Error('fixture invalide');
  }
  return result.value;
})();

const STACK = [entry('better-auth'), entry('stripe')];

function codes(requested: string[], stack: RegistryEntry[] = STACK): string[] {
  const result = resolveRecipes(requested, stack, CATALOGUE);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('resolveRecipes — Recipe Resolver (§22)', () => {
  it('aucune recette demandée : aucune appliquée', () => {
    const result = resolveRecipes([], STACK, CATALOGUE);
    expect(result.ok && result.value).toEqual([]);
  });

  it('rend les recettes demandées, triées et dédoublonnées', () => {
    const result = resolveRecipes(
      ['stripe-checkout', 'better-auth-email-password', 'stripe-checkout'],
      STACK,
      CATALOGUE,
    );
    expect(result.ok && result.value.map((recipe) => recipe.id)).toEqual([
      'better-auth-email-password',
      'stripe-checkout',
    ]);
  });

  it('refuse une recette inconnue, avec une suggestion', () => {
    const result = resolveRecipes(['stripe-chekout'], STACK, CATALOGUE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('GEN_RECIPE_UNKNOWN');
      expect(result.issues[0]?.hint).toContain('stripe-checkout');
    }
  });

  it('refuse une recette qu’aucune technologie de la stack ne porte', () => {
    expect(codes(['stripe-checkout'], [entry('better-auth')])).toEqual([
      'GEN_RECIPE_NOT_APPLICABLE',
    ]);
  });

  it('le refus nomme la technologie qui manque', () => {
    const result = resolveRecipes(['stripe-checkout'], [entry('better-auth')], CATALOGUE);
    expect(!result.ok && result.issues[0]?.message).toContain('stripe');
  });

  it('rapporte tous les problèmes d’un coup', () => {
    expect(codes(['inconnue', 'stripe-checkout'], [entry('better-auth')])).toEqual([
      'GEN_RECIPE_UNKNOWN',
      'GEN_RECIPE_NOT_APPLICABLE',
    ]);
  });
});

describe('recipeAsDependencySource', () => {
  it('expose paquets, paquets de dev et plages', () => {
    const recipe = CATALOGUE.get('better-auth-email-password');
    if (recipe === undefined) {
      throw new Error('fixture absente');
    }
    expect(recipeAsDependencySource(recipe)).toEqual({
      id: 'recipe:better-auth-email-password',
      name: 'Email',
      packages: ['better-auth'],
      devPackages: ['@types/node'],
      packageRanges: { 'better-auth': '^1.0.0', '@types/node': '^24.0.0' },
    });
  });

  it('une recette sans paquet n’en réclame aucun', () => {
    const recipe = CATALOGUE.get('stripe-checkout');
    if (recipe === undefined) {
      throw new Error('fixture absente');
    }
    expect(recipeAsDependencySource(recipe)).toEqual({
      id: 'recipe:stripe-checkout',
      name: 'Checkout',
      packages: [],
      devPackages: [],
      packageRanges: {},
    });
  });
});

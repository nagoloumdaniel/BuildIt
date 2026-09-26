import type { Recipe, RecipeCatalogue } from '@project-factory/recipes';
import type { RegistryEntry } from '@project-factory/registry';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
  suggest,
} from '@project-factory/validation';
import type { DependencySource } from './dependencies.js';

/**
 * Recipe Resolver (§22).
 *
 * Les recettes sont choisies **explicitement** — jamais déduites de la stack.
 * Better Auth sait faire email, OAuth et passkeys ; appliquer toutes ses
 * recettes parce qu'il est dans la stack livrerait trois systèmes de connexion
 * à qui en voulait un.
 */

export const RECIPE_RESOLUTION_CODES = ['GEN_RECIPE_UNKNOWN', 'GEN_RECIPE_NOT_APPLICABLE'] as const;

export type RecipeResolutionCode = (typeof RECIPE_RESOLUTION_CODES)[number];
export type RecipeResolutionIssue = Issue<RecipeResolutionCode>;

const MESSAGES: Readonly<Record<RecipeResolutionCode, string>> = {
  GEN_RECIPE_UNKNOWN: 'La recette « {value} » n’existe pas.',
  GEN_RECIPE_NOT_APPLICABLE:
    'La recette « {value} » s’applique à {expected}, et aucune de ces technologies n’est dans la stack. Ajoutez-en une, ou retirez la recette.',
};

const messageFor = createMessageFormatter(MESSAGES);

export function resolveRecipes(
  requested: readonly string[],
  stack: readonly RegistryEntry[],
  catalogue: RecipeCatalogue,
): ParseResult<Recipe[], RecipeResolutionCode> {
  const inStack = new Set(stack.map((entry) => entry.id));
  const known = catalogue.all().map((recipe) => recipe.id);
  const issues: RecipeResolutionIssue[] = [];
  const resolved: Recipe[] = [];

  for (const id of [...new Set(requested)].sort()) {
    const recipe = catalogue.get(id);
    if (recipe === undefined) {
      const hint = suggest(id, known);
      issues.push({
        code: 'GEN_RECIPE_UNKNOWN',
        path: ['recipes', id],
        message: messageFor('GEN_RECIPE_UNKNOWN', { value: id }),
        ...(hint === undefined ? {} : { hint: `Vouliez-vous dire « ${hint} » ?` }),
      });
      continue;
    }
    if (!recipe.for.some((entryId) => inStack.has(entryId))) {
      issues.push({
        code: 'GEN_RECIPE_NOT_APPLICABLE',
        path: ['recipes', id],
        message: messageFor('GEN_RECIPE_NOT_APPLICABLE', {
          value: id,
          expected: recipe.for.join(', '),
        }),
      });
      continue;
    }
    resolved.push(recipe);
  }

  return issues.length > 0 ? fail(issues) : ok(resolved);
}

/**
 * Une recette vue comme source de dépendances.
 *
 * Ses plages rejoignent celles des fiches dans le même résolveur : un conflit
 * entre une recette et une fiche est détecté et formulé comme un conflit entre
 * deux fiches.
 */
export function recipeAsDependencySource(recipe: Recipe): DependencySource {
  return {
    id: `recipe:${recipe.id}`,
    name: recipe.name,
    packages: Object.keys(recipe.packages ?? {}),
    devPackages: Object.keys(recipe.devPackages ?? {}),
    packageRanges: { ...recipe.packages, ...recipe.devPackages },
  };
}

/**
 * Recettes — capacités câblées qu'une technologie sait apporter à un projet
 * (§22, Recipe Resolver) : « Better Auth en email + mot de passe », « Stripe
 * Checkout ».
 *
 * Même philosophie que le registry : de la donnée JSON, un schéma strict, un
 * chargement validé. Le paquet ne connaît aucune technologie ; il sait
 * seulement qu'une recette s'applique à des identifiants de fiches.
 */

export type { RecipeCatalogue, RecipeIssue, RecipeIssueCode } from './load.js';
export { loadRecipeCatalogue, loadRecipes, RECIPE_ISSUE_CODES } from './load.js';
export type { Recipe, RecipeFile } from './schema.js';
export { isSafeRelativePath, recipeSchema } from './schema.js';

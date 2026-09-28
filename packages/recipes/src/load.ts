import {
  createMessageFormatter,
  describeValue,
  fail,
  type Issue,
  isPlainObject,
  type NormalizedIssue,
  normalizeZodIssues,
  ok,
  type ParseResult,
  quoteValue,
} from '@project-factory/validation';
import { RAW_RECIPES } from './generated/recipes.js';
import { type Recipe, recipeSchema } from './schema.js';

export const RECIPE_ISSUE_CODES = [
  'RECIPE_NOT_OBJECT',
  'RECIPE_UNKNOWN_FIELD',
  'RECIPE_FIELD_REQUIRED',
  'RECIPE_TYPE_MISMATCH',
  'RECIPE_FORMAT_INVALID',
  'RECIPE_PATH_UNSAFE',
  'RECIPE_DUPLICATE_TARGET',
  'RECIPE_DUPLICATE_ID',
] as const;

export type RecipeIssueCode = (typeof RECIPE_ISSUE_CODES)[number];
export type RecipeIssue = Issue<RecipeIssueCode>;

const MESSAGES: Readonly<Record<RecipeIssueCode, string>> = {
  RECIPE_NOT_OBJECT: 'Une recette doit être un objet JSON ; reçu {value}.',
  RECIPE_UNKNOWN_FIELD:
    'Champ « {field} » inconnu. Les champs d’une recette sont : id, name, description, for, requires, packages, devPackages, env, files.',
  RECIPE_FIELD_REQUIRED: 'Le champ « {field} » est obligatoire.',
  RECIPE_TYPE_MISMATCH: 'Le champ « {field} » a le mauvais type : reçu {value}.',
  RECIPE_FORMAT_INVALID: 'Valeur {value} invalide pour « {field} ».',
  RECIPE_PATH_UNSAFE:
    'Le chemin {value} peut sortir du projet ou n’est pas portable. Un chemin de recette est relatif, en « / », sans « . » ni « .. ».',
  RECIPE_DUPLICATE_TARGET:
    'Deux fichiers de la recette visent la même cible : l’un écraserait l’autre.',
  RECIPE_DUPLICATE_ID: 'L’identifiant {value} est déjà pris par une autre recette.',
};

const messageFor = createMessageFormatter(MESSAGES);

function toIssue(issue: NormalizedIssue, index: number): RecipeIssue {
  const path = [index, ...issue.path];
  const field = issue.path.map(String).join('.');

  switch (issue.kind) {
    case 'unknown-field':
      return {
        code: 'RECIPE_UNKNOWN_FIELD',
        path,
        message: messageFor('RECIPE_UNKNOWN_FIELD', { field: String(issue.path.at(-1)) }),
      };
    case 'required':
      return {
        code: 'RECIPE_FIELD_REQUIRED',
        path,
        message: messageFor('RECIPE_FIELD_REQUIRED', { field }),
      };
    case 'custom': {
      const code = issue.declaredCode as RecipeIssueCode;
      return {
        code,
        path,
        message: messageFor(code, { field, value: quoteValue(issue.value) }),
      };
    }
    case 'type-mismatch':
      return {
        code: 'RECIPE_TYPE_MISMATCH',
        path,
        message: messageFor('RECIPE_TYPE_MISMATCH', { field, value: describeValue(issue.value) }),
      };
    default:
      return {
        code: 'RECIPE_FORMAT_INVALID',
        path,
        message: messageFor('RECIPE_FORMAT_INVALID', { field, value: quoteValue(issue.value) }),
      };
  }
}

export interface RecipeCatalogue {
  /** Toutes les recettes, triées par identifiant. */
  all(): Recipe[];
  get(id: string): Recipe | undefined;
  /** Recettes qu'une technologie porte, triées par identifiant. */
  recipesFor(entryId: string): Recipe[];
}

/**
 * Valide des recettes brutes et construit le catalogue.
 *
 * Tous les problèmes sont rapportés d'un coup, avec la position de la recette
 * en tête de chemin : corriger une recette à la fois, en relançant entre
 * chaque, serait une perte de temps pour le contributeur.
 */
export function loadRecipes(
  raw: readonly unknown[],
): ParseResult<RecipeCatalogue, RecipeIssueCode> {
  const issues: RecipeIssue[] = [];
  const byId = new Map<string, Recipe>();

  raw.forEach((candidate, index) => {
    if (!isPlainObject(candidate)) {
      issues.push({
        code: 'RECIPE_NOT_OBJECT',
        path: [index],
        message: messageFor('RECIPE_NOT_OBJECT', { value: describeValue(candidate) }),
      });
      return;
    }

    const parsed = recipeSchema.safeParse(candidate);
    if (!parsed.success) {
      issues.push(
        ...normalizeZodIssues(parsed.error.issues, candidate).map((issue) => toIssue(issue, index)),
      );
      return;
    }

    if (byId.has(parsed.data.id)) {
      issues.push({
        code: 'RECIPE_DUPLICATE_ID',
        path: [index, 'id'],
        message: messageFor('RECIPE_DUPLICATE_ID', { value: quoteValue(parsed.data.id) }),
      });
      return;
    }
    byId.set(parsed.data.id, parsed.data);
  });

  if (issues.length > 0) {
    return fail(issues);
  }

  const sorted = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  return ok({
    all: () => [...sorted],
    get: (id) => byId.get(id),
    recipesFor: (entryId) => sorted.filter((recipe) => recipe.for.includes(entryId)),
  });
}

/** Charge les recettes officielles, embarquées depuis `data/`. */
export function loadRecipeCatalogue(): ParseResult<RecipeCatalogue, RecipeIssueCode> {
  return loadRecipes(RAW_RECIPES);
}

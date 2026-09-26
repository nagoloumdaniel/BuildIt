import { z } from 'zod';

/**
 * Schéma d'une recette : une capacité câblée — « auth email + mot de passe »,
 * « paiement Checkout » — que le generator ajoute au projet sur demande
 * explicite.
 *
 * Une recette est de la **donnée**, jamais du code : des paquets, des noms de
 * variables d'environnement, des fichiers à rendre depuis des templates. Le
 * rendu lui-même appartient au generator, qui ne sait que substituer.
 */

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

/**
 * Chemin relatif sûr : segments POSIX, sans `.` ni `..`, sans racine ni lecteur.
 *
 * Contrôlé ici **et** au moment de l'écriture (generator). Ici, pour qu'une
 * recette dangereuse soit refusée dès sa contribution ; là-bas, parce qu'un
 * catalogue tiers ne passera pas forcément par ce schéma.
 */
export function isSafeRelativePath(path: string): boolean {
  if (path.length === 0 || path.includes('\\') || path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return false;
  }
  return path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

const safePath = z
  .string()
  .refine(isSafeRelativePath, { params: { pfCode: 'RECIPE_PATH_UNSAFE' } });

const FORMAT = { params: { pfCode: 'RECIPE_FORMAT_INVALID' } };

// Les noms de paquets sont vérifiés par un `refine` plutôt que par le schéma de
// clé du record : une clé refusée remonte de Zod sans code exploitable, et le
// contributeur lirait « mauvais type » au lieu de « nom de paquet invalide ».
const packageRanges = z
  .record(z.string(), z.string().min(1))
  .refine((ranges) => Object.keys(ranges).every((name) => PACKAGE_NAME.test(name)), FORMAT);

const uniqueList = <T extends z.ZodType>(item: T) =>
  z.array(item).refine((values) => new Set(values).size === values.length, FORMAT);

export const recipeSchema: z.ZodType<Recipe> = z
  .object({
    id: z.string().regex(SLUG),
    name: z.string().min(1),
    description: z.string().min(1),
    for: uniqueList(z.string().regex(SLUG)).refine((values) => values.length > 0, FORMAT),
    packages: packageRanges.optional(),
    devPackages: packageRanges.optional(),
    env: uniqueList(z.string().regex(ENV_NAME)).optional(),
    files: z
      .array(z.object({ template: safePath, target: safePath }).strict())
      .refine((files) => new Set(files.map((file) => file.target)).size === files.length, {
        params: { pfCode: 'RECIPE_DUPLICATE_TARGET' },
      })
      .optional(),
  })
  .strict() as unknown as z.ZodType<Recipe>;

export interface RecipeFile {
  /** Chemin du template, relatif à la racine des templates du generator. */
  readonly template: string;
  /** Chemin du fichier produit, relatif à la racine du projet généré. */
  readonly target: string;
}

export interface Recipe {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /**
   * Technologies qui portent la recette. Au moins une doit être dans la stack :
   * c'est la frontière qui empêche d'appliquer une recette Stripe à un projet
   * sans Stripe.
   */
  readonly for: readonly string[];
  /** Paquet → plage de version. Toujours épinglé : une recette n'a pas de `*`. */
  readonly packages?: Readonly<Record<string, string>>;
  readonly devPackages?: Readonly<Record<string, string>>;
  /** Noms de variables d'environnement, jamais de valeurs. */
  readonly env?: readonly string[];
  readonly files?: readonly RecipeFile[];
}

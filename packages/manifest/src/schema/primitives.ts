import { z } from 'zod';

/**
 * Grammaires de base du manifest.
 *
 * Ce fichier ne connaît aucun nom de technologie : il valide des **formes**.
 * Savoir que « next » désigne Next.js est le travail du registry (Phase 3).
 */

/**
 * Nom de projet, aligné sur la grammaire des noms de paquets npm.
 *
 * C'est le seul champ du manifest dont le contenu est choisi librement par
 * l'utilisateur. Le contraindre ici est ce qui garantit, structurellement,
 * qu'aucune valeur sensible ne peut se loger dans un manifest partagé (§24).
 */
export const PROJECT_NAME_PATTERN: RegExp = /^(?![._])[a-z0-9._-]+$/;

export const projectNameSchema: z.ZodString = z
  .string()
  .min(1)
  .max(214)
  .regex(PROJECT_NAME_PATTERN);

/**
 * Identifiant de technologie : minuscules et chiffres séparés par des tirets
 * simples. Correspond à la clé `id` des fiches du registry (§11).
 */
export const TECH_SLUG_PATTERN: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const techSlugSchema: z.ZodString = z.string().regex(TECH_SLUG_PATTERN);

/**
 * Tableau sans doublon.
 *
 * Un doublon est signalé, jamais dédupliqué en silence : il révèle presque
 * toujours une erreur en amont — un manifest édité à la main, ou une façade
 * qui ajoute deux fois la même capacité. Le corriger discrètement masquerait
 * le vrai problème.
 *
 * Le code est attaché en `params.pfCode` pour que la traduction des erreurs
 * n'ait pas à déduire l'intention d'une vérification personnalisée.
 */
export function uniqueArray<T extends z.ZodType<string>>(
  item: T,
): z.ZodType<z.output<T>[], z.input<T>[]> {
  return z.array(item).refine((values) => new Set(values).size === values.length, {
    params: { pfCode: 'MANIFEST_DUPLICATE_ENTRY' },
    error: 'doublon',
  }) as unknown as z.ZodType<z.output<T>[], z.input<T>[]>;
}

/**
 * Variante non vide, pour les champs où un ensemble vide n'a pas de sens.
 *
 * Le code d'erreur est passé explicitement plutôt que déduit du chemin :
 * « aucune cible sélectionnée » et « aucun service sélectionné » n'appellent
 * pas la même phrase, et le chemin n'est pas un support fiable pour le deviner.
 */
export function nonEmptyUniqueArray<T extends z.ZodType<string>>(
  item: T,
  emptyCode: string,
): z.ZodType<z.output<T>[], z.input<T>[]> {
  return z
    .array(item)
    .refine((values) => values.length > 0, {
      params: { pfCode: emptyCode },
      error: 'ensemble vide',
    })
    .refine((values) => new Set(values).size === values.length, {
      params: { pfCode: 'MANIFEST_DUPLICATE_ENTRY' },
      error: 'doublon',
    }) as unknown as z.ZodType<z.output<T>[], z.input<T>[]>;
}

import { TARGETS, type Target } from '@project-factory/manifest';
import { z } from 'zod';

/**
 * Fiche d'une technologie du catalogue (cahier des charges §7, §11).
 *
 * Le registry est la seule source de vérité sur ce qu'est une technologie.
 * Aucun écran, aucune commande ne code en dur une liste de technologies (§11).
 */

/** Familles du §7. Fermée : ajouter une catégorie est une décision d'architecture. */
export const CATEGORIES = [
  'frontend',
  'language',
  'styling',
  'ui',
  'backend',
  'database',
  'orm',
  'authentication',
  'authorization',
  'state',
  'data-fetching',
  'forms',
  'validation',
  'api',
  'build',
  'package-manager',
  'monorepo',
  'testing',
  'linting',
  'formatting',
  'git-hooks',
  'containers',
  'ci-cd',
  'hosting',
  'storage',
  'cache',
  'queue',
  'search',
  'email',
  'payments',
  'observability',
  'analytics',
  'security',
  'ai',
  'cms',
  'ecommerce',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Cycle de vie d'une technologie (§7, politique de fraîcheur). */
export const LIFECYCLE_STATUSES = ['stable', 'beta', 'deprecated'] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

/**
 * Capacité de génération.
 *
 * `certified` : un template existe et un test de génération tourne en CI.
 * `declared`  : le registry connaît la technologie, rien ne la génère encore.
 *
 * C'est ce qui permet au catalogue d'être large (§7 en liste ~250) sans mentir
 * (§24 : « ne pas générer de combinaisons non testées »).
 */
export const GENERATION_STATUSES = ['certified', 'declared'] as const;

export type GenerationStatus = (typeof GENERATION_STATUSES)[number];

/** Licences reconnues. Fermée, pour que l'alerte « usage commercial » du §11 soit fiable. */
export const LICENSES = [
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  // Licence propre à PostgreSQL, proche d'une BSD. Ajoutée en écrivant les
  // premières vraies fiches : une liste fermée ne vaut que si elle couvre
  // réellement le catalogue, sinon on est tenté d'approximer — et une licence
  // approximée rend l'alerte « usage commercial » du §11 inutile.
  'PostgreSQL',
  'MPL-2.0',
  'LGPL-3.0',
  'GPL-3.0',
  'AGPL-3.0',
  'BSL-1.1',
  'Elastic-2.0',
  'Proprietary',
] as const;

export type License = (typeof LICENSES)[number];

export interface RegistryEntry {
  id: string;
  name: string;
  category: Category;
  targets: Target[];
  status: LifecycleStatus;
  generation: GenerationStatus;
  license: License;
  lastReviewedAt: string;
  versionRange?: string | undefined;
  requires?: string[] | undefined;
  compatibleWith?: string[] | undefined;
  conflictsWith?: string[] | undefined;
  packages?: string[] | undefined;
  env?: string[] | undefined;
  recipes?: string[] | undefined;
  template?: string | undefined;
  docs?: string | undefined;
}

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Nom de variable d'environnement : majuscules, chiffres, tirets bas.
 *
 * La grammaire interdit le signe `=`, donc une affectation complète ne peut
 * pas entrer. §24 devient une propriété de forme plutôt qu'une consigne qu'on
 * oublie d'appliquer.
 */
const envNameSchema = z.string().regex(/^[A-Z][A-Z0-9_]*$/);

/** Date ISO `AAAA-MM-JJ`, réellement existante et pas dans le futur. */
const pastIsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && value === parsed.toISOString().slice(0, 10);
  }, 'date inexistante')
  .refine((value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(), 'date future');

const uniqueTargets = z
  .array(z.enum(TARGETS))
  .min(1)
  .refine((values) => new Set(values).size === values.length, 'doublon');

function uniqueSlugs(): z.ZodType<string[], string[]> {
  return z
    .array(slugSchema)
    .refine((values) => new Set(values).size === values.length, 'doublon') as unknown as z.ZodType<
    string[],
    string[]
  >;
}

/**
 * Schéma d'une fiche.
 *
 * La contrainte croisée entre `generation` et `template` est portée par le
 * schéma, pas par une vérification séparée qu'on oublierait d'appeler : une
 * fiche certifiée sans template promet ce qui n'existe pas, une fiche déclarée
 * avec template ment dans l'autre sens. Les deux doivent être impossibles à
 * écrire.
 */
export const entrySchema: z.ZodType<RegistryEntry, unknown> = z
  .object({
    id: slugSchema,
    name: z.string().min(1).max(60),
    category: z.enum(CATEGORIES),
    targets: uniqueTargets,
    status: z.enum(LIFECYCLE_STATUSES),
    generation: z.enum(GENERATION_STATUSES),
    license: z.enum(LICENSES),
    lastReviewedAt: pastIsoDateSchema,
    versionRange: z.string().min(1).optional(),
    requires: uniqueSlugs().optional(),
    compatibleWith: uniqueSlugs().optional(),
    conflictsWith: uniqueSlugs().optional(),
    packages: z.array(z.string().min(1)).optional(),
    env: z.array(envNameSchema).optional(),
    recipes: uniqueSlugs().optional(),
    template: z
      .string()
      .regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/)
      .optional(),
    docs: z.url({ protocol: /^https?$/ }).optional(),
  })
  .strict()
  .refine((entry) => (entry.generation === 'certified' ? entry.template !== undefined : true), {
    params: { pfCode: 'REGISTRY_CERTIFIED_WITHOUT_TEMPLATE' },
    error: 'template manquant',
  })
  .refine((entry) => (entry.generation === 'declared' ? entry.template === undefined : true), {
    params: { pfCode: 'REGISTRY_DECLARED_WITH_TEMPLATE' },
    error: 'template interdit',
  }) as unknown as z.ZodType<RegistryEntry, unknown>;

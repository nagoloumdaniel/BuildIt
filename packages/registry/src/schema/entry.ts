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
  'dev-environment',
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
  'GPL-2.0',
  'Artistic-2.0',
  'Public-Domain',
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
  'SSPL-1.0',
  'EPL-2.0',
  'Unlicense',
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
  /** Paquets npm installés en dépendances de production. */
  packages?: string[] | undefined;
  /**
   * Paquets npm installés en dépendances de développement.
   *
   * Séparé de `packages` parce que le rôle se joue au **paquet**, pas à la
   * fiche : Prisma installe `prisma` (la CLI, en développement) et
   * `@prisma/client` (à l'exécution). Une règle déduite de la catégorie ne
   * pourrait pas exprimer ça.
   */
  devPackages?: string[] | undefined;
  /** Plage de versions par paquet. Sans elle, la version n'est pas épinglée. */
  packageRanges?: Readonly<Record<string, string>> | undefined;
  env?: string[] | undefined;
  recipes?: string[] | undefined;
  engines?: Readonly<Record<string, string>> | undefined;
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
    devPackages: z.array(z.string().min(1)).optional(),
    packageRanges: z.record(z.string().min(1), z.string().min(1)).optional(),
    env: z.array(envNameSchema).optional(),
    recipes: uniqueSlugs().optional(),
    // Contraintes de runtime (§12) : « next 15 exige node >=18.18 ». La cle est
    // un runtime (node, bun, deno), la valeur une plage semver.
    engines: z.record(z.enum(['node', 'bun', 'deno']), z.string().min(1)).optional(),
    template: z
      .string()
      .regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*$/)
      .optional(),
    docs: z.url({ protocol: /^https?$/ }).optional(),
  })
  .strict()
  // Une fiche certifiée n'a pas forcément de template. La règle initiale
  // l'exigeait, et elle confondait deux choses : apporter du **code
  // applicatif** et être couverte par un **test de génération**. TypeScript,
  // Biome et Vitest n'apportent aucun fichier d'application — leur
  // configuration vient de la couche d'intégration — mais ils doivent être
  // certifiés pour que la combinaison qui les contient le soit.
  //
  // La vraie garantie est ailleurs : un test compare l'ensemble des fiches
  // certifiées à celles que le test de fumée génère réellement. Une fiche
  // certifiée sans test le fait échouer.
  .refine((entry) => (entry.generation === 'declared' ? entry.template === undefined : true), {
    params: { pfCode: 'REGISTRY_DECLARED_WITH_TEMPLATE' },
    error: 'template interdit',
  })
  // Un paquet ne peut pas être à la fois de production et de développement :
  // le générateur ne saurait pas dans quelle section du package.json l'écrire.
  .refine(
    (entry) => {
      const dev = new Set(entry.devPackages ?? []);
      return (entry.packages ?? []).every((name) => !dev.has(name));
    },
    { params: { pfCode: 'REGISTRY_PACKAGE_ROLE_CONFLICT' }, error: 'paquet en double rôle' },
  )
  // Une plage pour un paquet que la fiche n'installe pas est du bruit : soit
  // le paquet a été renommé et la plage est morte, soit il manque à la liste.
  .refine(
    (entry) => {
      const declared = new Set([...(entry.packages ?? []), ...(entry.devPackages ?? [])]);
      return Object.keys(entry.packageRanges ?? {}).every((name) => declared.has(name));
    },
    { params: { pfCode: 'REGISTRY_ORPHAN_PACKAGE_RANGE' }, error: 'plage orpheline' },
  ) as unknown as z.ZodType<RegistryEntry, unknown>;

import { z } from 'zod';
import { MANIFEST_VERSION, type ManifestVersion } from '../version.js';
import { type Architecture, architectureSchema, type Target, targetSchema } from './enums.js';
import {
  nonEmptyUniqueArray,
  projectNameSchema,
  techSlugSchema,
  uniqueArray,
} from './primitives.js';

/**
 * Le Project Manifest (§10) : le contrat que produisent l'UI et le CLI, et que
 * consomme le pipeline (§9).
 *
 * L'interface est écrite à la main plutôt qu'inférée du schéma. Deux raisons :
 * c'est le contrat public du produit, il mérite d'être lisible sans dérouler
 * des génériques ; et l'annotation du schéma par cette interface transforme
 * toute divergence entre les deux en **erreur de compilation**.
 *
 * Aucun nom de technologie n'apparaît dans ce fichier. Les valeurs comme
 * « next » ou « drizzle » sont des slugs opaques ici ; c'est le registry
 * (Phase 3) qui sait ce qu'ils désignent.
 */

export interface ManifestFrontend {
  framework: string;
  language: string;
  styling?: string | undefined;
  ui?: string | undefined;
}

export interface ManifestMobile {
  framework: string;
  language: string;
  styling?: string | undefined;
}

export interface ManifestDesktop {
  framework: string;
}

export interface ManifestBackend {
  framework: string;
  language?: string | undefined;
}

export interface ManifestDatabase {
  engine: string;
  orm?: string | undefined;
}

export interface ManifestAuth {
  provider: string;
}

/**
 * Partage en lecture seule (§20).
 *
 * Ne contient qu'une intention, jamais un jeton ni une URL : l'identifiant du
 * lien est produit au moment du partage et vit en dehors du manifest.
 */
export interface ManifestShareLink {
  enabled: boolean;
  readOnly: boolean;
}

export interface Manifest {
  manifestVersion: ManifestVersion;
  name: string;
  targets: Target[];
  architecture: Architecture;
  apps?: string[] | undefined;
  frontend?: ManifestFrontend | undefined;
  mobile?: ManifestMobile | undefined;
  desktop?: ManifestDesktop | undefined;
  backend?: ManifestBackend | undefined;
  database?: ManifestDatabase | undefined;
  auth?: ManifestAuth | undefined;
  services?: string[] | undefined;
  quality?: string[] | undefined;
  infra?: string[] | undefined;
  shareLink?: ManifestShareLink | undefined;
}

const frontendSchema = z
  .object({
    framework: techSlugSchema,
    language: techSlugSchema,
    styling: techSlugSchema.optional(),
    ui: techSlugSchema.optional(),
  })
  .strict();

const mobileSchema = z
  .object({
    framework: techSlugSchema,
    language: techSlugSchema,
    styling: techSlugSchema.optional(),
  })
  .strict();

const desktopSchema = z.object({ framework: techSlugSchema }).strict();

const backendSchema = z
  .object({
    framework: techSlugSchema,
    language: techSlugSchema.optional(),
  })
  .strict();

const databaseSchema = z
  .object({
    engine: techSlugSchema,
    orm: techSlugSchema.optional(),
  })
  .strict();

const authSchema = z.object({ provider: techSlugSchema }).strict();

const shareLinkSchema = z
  .object({
    enabled: z.boolean(),
    readOnly: z.boolean(),
  })
  .strict();

/**
 * Schéma strict : une clé inconnue est une erreur, pas un champ ignoré.
 *
 * Une faute de frappe dans un manifest écrit à la main doit se voir. Les
 * manifests produits par une version plus récente sont interceptés en amont
 * par le contrôle de `manifestVersion`, donc la strictitude ne coûte aucune
 * compatibilité ascendante.
 */
export const manifestSchema: z.ZodType<Manifest, unknown> = z
  .object({
    manifestVersion: z.literal(MANIFEST_VERSION),
    name: projectNameSchema,
    targets: nonEmptyUniqueArray(targetSchema, 'MANIFEST_TARGETS_EMPTY'),
    architecture: architectureSchema,
    apps: uniqueArray(techSlugSchema).optional(),
    frontend: frontendSchema.optional(),
    mobile: mobileSchema.optional(),
    desktop: desktopSchema.optional(),
    backend: backendSchema.optional(),
    database: databaseSchema.optional(),
    auth: authSchema.optional(),
    services: uniqueArray(techSlugSchema).optional(),
    quality: uniqueArray(techSlugSchema).optional(),
    infra: uniqueArray(techSlugSchema).optional(),
    shareLink: shareLinkSchema.optional(),
  })
  .strict() as unknown as z.ZodType<Manifest, unknown>;

/**
 * Ordre canonique des clés pour la sérialisation (voir `serialize.ts`).
 *
 * Déclaré plutôt qu'alphabétique : un manifest posé dans un dépôt généré est
 * lu par des humains, et « name » avant « targets » avant les détails de stack
 * suit l'ordre dans lequel les choix sont faits (§3).
 */
export const MANIFEST_KEY_ORDER: readonly (keyof Manifest)[] = [
  'manifestVersion',
  'name',
  'targets',
  'architecture',
  'apps',
  'frontend',
  'mobile',
  'desktop',
  'backend',
  'database',
  'auth',
  'services',
  'quality',
  'infra',
  'shareLink',
];

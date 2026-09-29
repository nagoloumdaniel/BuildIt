import type { Manifest } from '@project-factory/manifest';

/**
 * Les presets certifiés du §8 : un manifest et des recettes, rien d'autre.
 *
 * Le CLI et l'UI les lisent au même endroit : deux listes finiraient par
 * diverger, et « le même preset » ne donnerait plus le même projet.
 */

export const PRESET_IDS = ['saas', 'dashboard', 'api', 'fullstack'] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export interface Preset {
  readonly id: PresetId;
  readonly name: string;
  /** Une phrase : à quoi il sert. */
  readonly description: string;
  /** Recettes appliquées avec le preset. */
  readonly recipes: readonly string[];
  /** Le manifest du preset, pour un nom de projet donné. */
  manifest(name: string): Manifest;
}

const SAAS: Preset = {
  id: 'saas',
  name: 'SaaS Web',
  description:
    'Application web avec comptes, paiement Stripe, emails transactionnels, suivi des erreurs et mesure d’audience.',
  recipes: ['resend-transactional', 'stripe-checkout'],
  manifest: (name) => ({
    manifestVersion: 1,
    name,
    targets: ['web'],
    architecture: 'single-app',
    frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
    database: { engine: 'postgresql', orm: 'prisma' },
    auth: { provider: 'better-auth' },
    services: ['stripe', 'resend', 'sentry', 'posthog'],
    quality: ['biome', 'vitest', 'playwright'],
    infra: ['vercel', 'github-actions', 'docker'],
  }),
};

const DASHBOARD: Preset = {
  id: 'dashboard',
  name: 'Dashboard',
  description:
    'Espace d’administration protégé : indicateurs, graphique, tableau des utilisateurs, paramètres — sur des données réelles.',
  recipes: ['dashboard-admin'],
  manifest: (name) => ({
    manifestVersion: 1,
    name,
    targets: ['web'],
    architecture: 'single-app',
    frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
    database: { engine: 'postgresql', orm: 'prisma' },
    auth: { provider: 'better-auth' },
    quality: ['biome', 'vitest', 'playwright'],
    infra: ['docker', 'github-actions'],
  }),
};

const API: Preset = {
  id: 'api',
  name: 'API',
  description:
    'API Hono documentée (OpenAPI) et validée (Zod), avec PostgreSQL, Redis et une image Docker.',
  recipes: [],
  manifest: (name) => ({
    manifestVersion: 1,
    name,
    targets: ['api'],
    architecture: 'single-app',
    backend: { framework: 'hono', language: 'typescript' },
    database: { engine: 'postgresql', orm: 'prisma' },
    services: ['redis'],
    quality: ['biome', 'vitest'],
    infra: ['docker', 'github-actions'],
  }),
};

const FULLSTACK: Preset = {
  id: 'fullstack',
  name: 'Full-stack Monorepo',
  description:
    'Monorepo Turborepo : application Next.js, API Hono, et le contrat partagé entre les deux.',
  recipes: [],
  manifest: (name) => ({
    manifestVersion: 1,
    name,
    targets: ['web', 'api'],
    architecture: 'monorepo',
    frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
    backend: { framework: 'hono', language: 'typescript' },
    database: { engine: 'postgresql', orm: 'prisma' },
    auth: { provider: 'better-auth' },
    services: ['redis', 'zod'],
    quality: ['biome', 'vitest', 'playwright'],
    infra: ['turborepo', 'docker', 'github-actions'],
  }),
};

export const PRESETS: readonly Preset[] = [SAAS, DASHBOARD, API, FULLSTACK];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

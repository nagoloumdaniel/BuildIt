import type { Category } from '@project-factory/registry';

/**
 * Où va chaque technologie dans un monorepo (spec 2026-09-28).
 *
 * - `web`, `api` : l'application de ce nom ;
 * - `data` : l'application web si elle existe — Better Auth y vit —, sinon l'API ;
 * - `both` : chaque application (TypeScript, Zod, Vitest) ;
 * - `root` : le dépôt entier (Biome, Turborepo, Docker, CI).
 *
 * Le type `Record<Category, …>` oblige à décider pour toute nouvelle catégorie :
 * le compilateur refuse une catégorie oubliée.
 */
export type Role = 'web' | 'api' | 'data' | 'both' | 'root';

export const ROLE_BY_CATEGORY: Readonly<Record<Category, Role>> = {
  frontend: 'web',
  styling: 'web',
  ui: 'web',
  authentication: 'web',
  authorization: 'web',
  state: 'web',
  'data-fetching': 'web',
  forms: 'web',
  analytics: 'web',
  observability: 'web',
  payments: 'web',
  email: 'web',
  cms: 'web',
  ecommerce: 'web',
  build: 'web',
  ai: 'web',
  backend: 'api',
  api: 'api',
  cache: 'api',
  queue: 'api',
  search: 'api',
  storage: 'api',
  database: 'data',
  orm: 'data',
  language: 'both',
  validation: 'both',
  testing: 'both',
  linting: 'root',
  formatting: 'root',
  monorepo: 'root',
  'package-manager': 'root',
  'git-hooks': 'root',
  containers: 'root',
  'dev-environment': 'root',
  'ci-cd': 'root',
  hosting: 'root',
  security: 'root',
};

/** Exceptions à la règle par catégorie. */
export const ROLE_BY_ID: Readonly<Record<string, Role>> = {
  // Tests de bout en bout d'une interface : l'API n'en a pas.
  playwright: 'web',
};

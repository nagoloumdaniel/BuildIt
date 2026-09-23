import { z } from 'zod';

/**
 * Les deux seules énumérations fermées du manifest.
 *
 * « Fermée par nature » veut dire qu'ajouter une valeur est une décision de
 * produit, pas une entrée de catalogue. Les plateformes cibles et les formes
 * d'architecture changent à l'échelle d'une version majeure ; les technologies
 * changent toutes les semaines — c'est pourquoi elles vivent dans le registry
 * et non ici.
 */

/** Plateformes cibles (§4). */
export const TARGETS = ['web', 'mobile', 'desktop', 'api', 'library'] as const;

export type Target = (typeof TARGETS)[number];

export const targetSchema: z.ZodEnum<{
  web: 'web';
  mobile: 'mobile';
  desktop: 'desktop';
  api: 'api';
  library: 'library';
}> = z.enum(TARGETS);

/** Formes d'architecture retenues pour le manifest (§7.23). */
export const ARCHITECTURES = [
  'single-app',
  'monorepo',
  'modular-monolith',
  'microservices',
  'serverless',
  'event-driven',
] as const;

export type Architecture = (typeof ARCHITECTURES)[number];

export const architectureSchema: z.ZodEnum<{
  'single-app': 'single-app';
  monorepo: 'monorepo';
  'modular-monolith': 'modular-monolith';
  microservices: 'microservices';
  serverless: 'serverless';
  'event-driven': 'event-driven';
}> = z.enum(ARCHITECTURES);

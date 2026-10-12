import type { Widen } from './widen';

/**
 * Les textes des six dernières étapes : environnement, infrastructure,
 * blueprint, aperçu, génération, rapport. Voir `messages.ts`.
 */

export const FR_BUILD = {
  build: {
    generating: 'Génération en cours…',
  },
} as const;

export const EN_BUILD: Widen<typeof FR_BUILD> = {
  build: {
    generating: 'Generating…',
  },
};

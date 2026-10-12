import type { Widen } from './widen';

/**
 * Les textes du compte GitHub, du dépôt et du graphe de dépendances.
 * Voir `messages.ts` pour la composition.
 */

export const FR_ACCOUNT = {
  account: {
    connected: 'Connecté',
  },
} as const;

export const EN_ACCOUNT: Widen<typeof FR_ACCOUNT> = {
  account: {
    connected: 'Connected',
  },
};

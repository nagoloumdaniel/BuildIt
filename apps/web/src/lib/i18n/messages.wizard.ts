import type { Widen } from './widen';

/**
 * Les textes des six premières étapes du parcours : nom, plateformes, type,
 * architecture, stack, capacités. Voir `messages.ts` pour la composition.
 */

export const FR_WIZARD = {
  wizard: {
    /** Les titres et descriptions des écrans de choix. */
    namePlaceholder: 'mon-projet',
  },
} as const;

export const EN_WIZARD: Widen<typeof FR_WIZARD> = {
  wizard: {
    namePlaceholder: 'my-project',
  },
};

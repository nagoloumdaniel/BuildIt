import type { Widen } from './widen';

/**
 * Le parcours : stepper, transitions entre étapes, annulation, titres.
 *
 * Voir `messages.ts` pour la composition. Le français fait foi : une clé
 * ajoutée d'un côté sans l'autre fait échouer `pnpm typecheck`.
 */

export const FR_JOURNEY = {
  journey: {
    cancel: {
      /** Le libellé visible, court : il tient à droite du titre. */
      button: 'Annuler',
      /**
       * Le nom accessible dit **quoi** est annulé : « Annuler » seul se
       * confondrait avec l'arrêt d'une installation ou d'une génération.
       */
      label: 'Annuler la création du projet',
      title: 'Annuler la création de ce projet ?',
      body: 'Les choix faits jusqu’ici seront effacés : nom, plateformes, technologies, réglages. Rien n’a encore été écrit sur votre disque.',
      confirm: 'Effacer et quitter',
      keep: 'Garder mes choix',
    },
  },
} as const;

export const EN_JOURNEY: Widen<typeof FR_JOURNEY> = {
  journey: {
    cancel: {
      button: 'Cancel',
      label: 'Cancel project creation',
      title: 'Cancel creating this project?',
      body: 'The choices made so far will be erased: name, platforms, technologies, settings. Nothing has been written to your disk yet.',
      confirm: 'Erase and leave',
      keep: 'Keep my choices',
    },
  },
};

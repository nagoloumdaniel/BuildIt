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
    /**
     * Dit au lecteur d'écran pourquoi l'écran demandé n'apparaît pas : le
     * projet est généré, le parcours repart vers sa fin.
     */
    locked:
      'Ce projet est déjà généré : ses choix ne se modifient plus. Retour à la fin du parcours.',

    /**
     * Pourquoi le bouton « Continuer » est grisé, dit à côté de lui.
     *
     * Une phrase par cause : le nom, la plateforme, la compatibilité du moteur,
     * et les **minimums** qu'un écran exige (`lib/requirements.ts`). Aucune ne
     * nomme de technologie : elles nomment des plateformes, des architectures
     * et des catégories, dont les libellés vivent dans ce même dictionnaire.
     */
    blocked: {
      name: 'Choisissez un nom : minuscules, chiffres, points, tirets ou soulignés.',
      platform: 'Choisissez au moins une plateforme.',
      platformRefused: (refused: string, offered: string, plural: boolean) =>
        `Le catalogue n’offre aucun framework pour ${refused} : ${
          plural ? 'ces plateformes ne peuvent' : 'cette plateforme ne peut'
        } pas produire de manifest (§10). Plateformes proposées : ${offered}.`,
      compatibility: 'La compatibilité de la sélection n’a pas encore été vérifiée.',
      framework: (platform: string) =>
        `La plateforme « ${platform} » exige un framework : choisissez une technologie « Frontend » ou « Backend » qui la sert.`,
      serverPlatform: (architecture: string) =>
        `L’architecture « ${architecture} » exige une application serveur : ajoutez la plateforme « API » à l’étape Plateformes, puis un framework « Backend ».`,
      backend: (architecture: string) =>
        `L’architecture « ${architecture} » exige un framework « Backend ».`,
      application: (architecture: string) =>
        `L’architecture « ${architecture} » exige au moins une application : ajoutez une plateforme (Web, API, Mobile ou Ordinateur).`,
      database:
        'Un ORM sans base de données ne produit pas de manifest : choisissez un moteur dans « Base de données ».',
      capability: (category: string, architecture: string) =>
        `L’architecture « ${architecture} » exige « ${category} » : choisissez au moins une option à l’écran Capacités.`,
      infrastructure: (category: string, architecture: string) =>
        `L’architecture « ${architecture} » exige « ${category} » : choisissez au moins une option à l’écran Infrastructure.`,
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
    locked:
      'This project has already been generated: its choices can no longer change. Going back to the end of the journey.',
    blocked: {
      name: 'Choose a name: lowercase letters, digits, dots, dashes or underscores.',
      platform: 'Choose at least one platform.',
      platformRefused: (refused: string, offered: string, plural: boolean) =>
        `The catalogue offers no framework for ${refused}: ${
          plural ? 'these platforms cannot' : 'this platform cannot'
        } produce a manifest (§10). Offered platforms: ${offered}.`,
      compatibility: 'The compatibility of the selection has not been checked yet.',
      framework: (platform: string) =>
        `The “${platform}” platform requires a framework: pick a “Frontend” or “Backend” technology that serves it.`,
      serverPlatform: (architecture: string) =>
        `The “${architecture}” architecture requires a server application: add the “API” platform on the Platforms step, then a “Backend” framework.`,
      backend: (architecture: string) =>
        `The “${architecture}” architecture requires a “Backend” framework.`,
      application: (architecture: string) =>
        `The “${architecture}” architecture requires at least one application: add a platform (Web, API, Mobile or Desktop).`,
      database:
        'An ORM without a database produces no manifest: choose an engine under “Database”.',
      capability: (category: string, architecture: string) =>
        `The “${architecture}” architecture requires “${category}”: choose at least one option on the Capabilities step.`,
      infrastructure: (category: string, architecture: string) =>
        `The “${architecture}” architecture requires “${category}”: choose at least one option on the Infrastructure step.`,
    },
  },
};

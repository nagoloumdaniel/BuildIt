import type { Architecture, Target } from '@buildit/manifest';
import type { Widen } from './widen';

/**
 * Les textes des six dernières étapes : environnement, infrastructure,
 * blueprint, aperçu, génération, rapport. Voir `messages.ts`.
 *
 * Même règle que `messages.wizard.ts` : un groupe par écran, les identifiants
 * techniques comme clés (`docker`, `plan`, `apps`…), et une fonction dès que la
 * phrase porte une valeur (`${count} fichier${count > 1 ? 's' : ''}`).
 *
 * Les refus du moteur (`report.issues`, les messages de `draftToManifest`) ne
 * sont **pas** ici : ce sont les mêmes phrases que le CLI affiche, et les
 * chercher dans un moteur de recherche doit donner le même résultat depuis les
 * deux interfaces. Ce qui est traduit, c'est le cadre autour.
 */
export const FR_BUILD = {
  build: {
    /** Le statut d'une génération en cours, partagé par la page et la barre. */

    /**
     * Écran 7 — Environment & Secrets : noms de variables uniquement, où poser
     * les valeurs, et ce que le brouillon a le droit de retenir.
     */
    env: {
      title: 'Environnement & secrets',
      description:
        'Les variables que vos choix réclament. Cette page n’affiche et ne stocke que des noms : aucune valeur ne transite par l’interface.',
      requiredLegend: 'Variables requises',
      requiredTitle: 'Variables requises',
      loading: 'Chargement des variables…',
      engineDownTitle: 'Les variables n’ont pas pu être lues',
      engineDown: 'Le moteur n’a pas répondu.',
      empty:
        'Aucune variable pour l’instant : les choix faits aux écrans précédents n’en réclament aucune.',
      requiredBy: (who: string) => `Réclamée par : ${who}`,
      engineRequirement: 'une exigence du moteur',
      engineAdded: 'Ajoutée par le moteur',
      whereLegend: 'Où mettre les valeurs',
      whereTitle: 'Où mettre les valeurs',
      /** Le chemin technique reste au milieu, en chasse fixe, posé par l'écran. */
      envFileBefore: 'Chaque valeur se met dans',
      envFileAfter: ', à la racine du projet.',
      gitignoreBefore: 'Ce fichier n’est jamais commité : il figure dans le',
      gitignoreAfter: 'engendré par le projet.',
      namesOnly:
        'Le brouillon ne retient que les noms : aucune valeur ne transite par l’interface, ni par le lien de partage.',
      engineMarked:
        'Les valeurs ajoutées par le moteur sont marquées : elles viennent d’une exigence tirée par vos choix, pas d’une ligne saisie ici.',
      customTitle: 'Variables ajoutées à la main',
      customLabel: 'Nom de la variable',
      customPlaceholder: 'MA_VARIABLE',
      customAdd: 'Ajouter',
      customRemove: (name: string) => `Retirer ${name}`,
      customHint:
        'Le nom seulement : il est écrit vide (NOM=) dans .env.example. Renseignez la valeur plus tard, dans .env.local.',
      customInvalid: 'Majuscules, chiffres et soulignés, une lettre en tête (ex. API_URL).',
      customDuplicate: 'Cette variable est déjà listée.',
      customEmpty: 'Aucune variable ajoutée.',
    },

    /**
     * Écran 8 — Infrastructure : les deux booléens (Docker, CI), le cloud cible
     * et la traduction assumée dans le champ `infra` du manifest.
     */
    infrastructure: {
      title: 'Infrastructure',
      description:
        'Ce qui fait tourner et livrer le projet : conteneurs, intégration continue et hébergement. Ces choix rejoignent le champ infra du manifest.',
      legend: 'Ce que le projet embarque',
      docker: 'Docker',
      dockerNote: 'Un Dockerfile et un environnement de développement reproductible.',
      ci: 'Intégration continue',
      ciNote: 'Un workflow GitHub Actions : lint, types et tests à chaque poussée.',
      cloudLegend: 'Cloud cible',
      cloudTitle: 'Cloud cible',
      cloudHintBefore: 'L’hébergeur est un choix de la catégorie',
      cloudHintMid: ': le brouillon n’a pas de champ dédié, et cet identifiant rejoint',
      cloudHintAfter: '. Un seul cloud cible à la fois.',
      loading: 'Chargement des hébergeurs…',
      engineDownTitle: 'Les hébergeurs n’ont pas pu être lus',
      engineDown: 'Le moteur n’a pas répondu.',
      empty: 'Aucun hébergeur pour cette sélection.',
      chosenBadge: 'Choisi',
    },

    /**
     * Écran 9 — Project Blueprint : le manifest canonique dit en clair. Les
     * rôles et les libellés de plateforme/architecture y vivent, parce que le
     * résumé est un texte avant d'être une donnée.
     */
    blueprint: {
      title: 'Plan du projet',
      description:
        'Le résumé de ce qui sera généré. Les mêmes choix qu’en ligne de commande produisent le même projet, octet pour octet.',
      descriptionIncomplete: 'Le résumé de ce qui sera généré, construit à partir de vos choix.',
      incompleteTitle: 'Le plan ne peut pas être construit',
      incompleteBody:
        'Le brouillon est incomplet : il manque un choix à un écran précédent. Complétez-le, puis revenez sur cette page. Rien n’a été écrit.',
      fixStack: 'Corriger mes choix',
      backHome: 'Retour au tableau de bord',
      catalogueIssue:
        'Le catalogue n’a pas pu être lu : les technologies restent affichées par leur identifiant.',
      statusChecking: 'Vérification de la sélection…',
      statusCertified: 'Sélection certifiée : le moteur connaît cette combinaison.',
      statusValid: 'Sélection valide : le moteur accepte cette combinaison.',
      graphLink: 'Voir le graphe de dépendances',
      roles: {
        targets: 'Plateformes',
        architecture: 'Architecture',
        web: 'Application web',
        mobile: 'Application mobile',
        desktop: 'Application de bureau',
        backend: 'Backend',
        database: 'Base de données',
        auth: 'Authentification',
        services: 'Services',
        quality: 'Qualité',
        infra: 'Infrastructure',
      },
      targetLabels: {
        web: 'Web',
        mobile: 'Mobile',
        desktop: 'Ordinateur',
        api: 'API',
        library: 'Bibliothèque',
      } satisfies Record<Target, string>,
      architectureLabels: {
        'single-app': 'Application unique',
        monorepo: 'Monorepo',
        'modular-monolith': 'Monolithe modulaire',
        microservices: 'Microservices',
        serverless: 'Serverless',
        'event-driven': 'Événementiel',
      } satisfies Record<Architecture, string>,
    },

    /**
     * Écran 11 — Generation Progress : le dossier montré avant d'écrire, le
     * lancement, le refus, et le vocabulaire des étapes du pipeline.
     */
    generate: {
      title: 'Générer le projet',
      incompleteTitle: 'Rien ne sera écrit',
      incompleteBody:
        'Le brouillon est incomplet : le moteur n’a pas de projet à écrire. Complétez vos choix, puis revenez. Aucun fichier n’a été touché.',
      fixStack: 'Corriger mes choix',
    },

    /**
     * Écran 12 — Generation Report : le verdict, ce qui a été écrit, les
     * avertissements, les refus, et la marche à suivre pour reprendre le projet.
     */
    report: {
      title: 'Rapport de génération',
      description:
        'Ce qui a été écrit, les étapes terminées, les avertissements et les erreurs éventuelles.',
      loading: 'Lecture du rapport…',
      missing: 'Aucun rapport de génération dans cette session.',
      missingAction: 'Aller à la génération',
      okBadge: 'Réussi',
      refusedBadge: 'Refusé',
      refusalTitle: 'La génération a été refusée',
      refusalBody:
        'Rien n’a été écrit. Corrigez les technologies ci-dessous, puis relancez la génération. Le brouillon et les choix sont conservés.',
      fixStack: 'Modifier les technologies',
      technologiesTitle: 'Technologies choisies',
      none: 'Aucune technologie choisie.',
      filesCount: 'Fichiers écrits',
      weight: 'Poids',
      commandWhat: 'la commande',
      warningsTitle: 'Avertissements',
      issuesTitle: 'Problèmes',
      installationTitle: 'Installation',
      installationNote:
        'Le projet est terminé : ces écrans ne le modifient plus. Pour le reprendre, suivez les commandes ci-dessous.',
      download: 'Télécharger à nouveau',
      connectGithub: 'Connecter à GitHub',
    },
  },
} as const;

export const EN_BUILD: Widen<typeof FR_BUILD> = {
  build: {
    env: {
      title: 'Environment & secrets',
      description:
        'The variables your choices require. This page shows and stores names only: no value ever goes through the interface.',
      requiredLegend: 'Required variables',
      requiredTitle: 'Required variables',
      loading: 'Loading variables…',
      engineDownTitle: 'The variables could not be read',
      engineDown: 'The engine did not answer.',
      empty: 'No variable yet: the choices made on the previous screens require none.',
      requiredBy: (who: string) => `Required by: ${who}`,
      engineRequirement: 'an engine requirement',
      engineAdded: 'Added by the engine',
      whereLegend: 'Where to put the values',
      whereTitle: 'Where to put the values',
      envFileBefore: 'Each value goes into',
      envFileAfter: ', at the root of the project.',
      gitignoreBefore: 'This file is never committed: it is listed in the',
      gitignoreAfter: 'generated with the project.',
      namesOnly:
        'The draft keeps the names only: no value goes through the interface, nor through the share link.',
      engineMarked:
        'Values added by the engine are marked: they come from a requirement pulled in by your choices, not from a line typed here.',
      customTitle: 'Variables added by hand',
      customLabel: 'Variable name',
      customPlaceholder: 'MY_VARIABLE',
      customAdd: 'Add',
      customRemove: (name: string) => `Remove ${name}`,
      customHint:
        'The name only: it is written empty (NAME=) in .env.example. Fill in the value later, in .env.local.',
      customInvalid:
        'Uppercase letters, digits and underscores, starting with a letter (e.g. API_URL).',
      customDuplicate: 'This variable is already listed.',
      customEmpty: 'No variable added.',
    },

    infrastructure: {
      title: 'Infrastructure',
      description:
        'What runs and ships the project: containers, continuous integration and hosting. These choices join the infra field of the manifest.',
      legend: 'What the project ships with',
      docker: 'Docker',
      dockerNote: 'A Dockerfile and a reproducible development environment.',
      ci: 'Continuous integration',
      ciNote: 'A GitHub Actions workflow: lint, types and tests on every push.',
      cloudLegend: 'Target cloud',
      cloudTitle: 'Target cloud',
      cloudHintBefore: 'The host is a choice in the',
      cloudHintMid: 'category: the draft has no dedicated field, and this identifier joins',
      cloudHintAfter: '. One target cloud at a time.',
      loading: 'Loading hosts…',
      engineDownTitle: 'The hosts could not be read',
      engineDown: 'The engine did not answer.',
      empty: 'No host for this selection.',
      chosenBadge: 'Chosen',
    },

    blueprint: {
      title: 'Project blueprint',
      description:
        'The summary of what will be generated. The same choices as on the command line produce the same project, byte for byte.',
      descriptionIncomplete: 'The summary of what will be generated, built from your choices.',
      incompleteTitle: 'The blueprint cannot be built',
      incompleteBody:
        'The draft is incomplete: a choice is missing on an earlier screen. Complete it, then come back to this page. Nothing has been written.',
      fixStack: 'Fix my choices',
      backHome: 'Back to the dashboard',
      catalogueIssue:
        'The catalogue could not be read: technologies stay displayed by their identifier.',
      statusChecking: 'Checking the selection…',
      statusCertified: 'Certified selection: the engine knows this combination.',
      statusValid: 'Valid selection: the engine accepts this combination.',
      graphLink: 'See the dependency graph',
      roles: {
        targets: 'Platforms',
        architecture: 'Architecture',
        web: 'Web application',
        mobile: 'Mobile application',
        desktop: 'Desktop application',
        backend: 'Backend',
        database: 'Database',
        auth: 'Authentication',
        services: 'Services',
        quality: 'Quality',
        infra: 'Infrastructure',
      },
      targetLabels: {
        web: 'Web',
        mobile: 'Mobile',
        desktop: 'Desktop',
        api: 'API',
        library: 'Library',
      },
      architectureLabels: {
        'single-app': 'Single application',
        monorepo: 'Monorepo',
        'modular-monolith': 'Modular monolith',
        microservices: 'Microservices',
        serverless: 'Serverless',
        'event-driven': 'Event-driven',
      },
    },

    generate: {
      title: 'Generate the project',
      incompleteTitle: 'Nothing will be written',
      incompleteBody:
        'The draft is incomplete: the engine has no project to write. Complete your choices, then come back. No file has been touched.',
      fixStack: 'Fix my choices',
    },

    report: {
      title: 'Generation report',
      description: 'What was written, the completed steps, the warnings and any errors.',
      loading: 'Reading the report…',
      missing: 'No generation report in this session.',
      missingAction: 'Go to generation',
      okBadge: 'Succeeded',
      refusedBadge: 'Refused',
      refusalTitle: 'The generation was refused',
      refusalBody:
        'Nothing was written. Fix the technologies below, then run the generation again. The draft and your choices are kept.',
      fixStack: 'Change the technologies',
      technologiesTitle: 'Chosen technologies',
      none: 'No technology chosen.',
      filesCount: 'Files written',
      weight: 'Size',
      commandWhat: 'the command',
      warningsTitle: 'Warnings',
      issuesTitle: 'Problems',
      installationTitle: 'Installation',
      installationNote:
        'The project is finished: these screens no longer change it. To pick it up, follow the commands below.',
      download: 'Download again',
      connectGithub: 'Connect to GitHub',
    },
  },
};

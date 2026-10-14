import type { Architecture, Target } from '@buildit/manifest';
import type { Category } from '@buildit/registry';
import type { Widen } from './widen';

/**
 * Les textes des six premières étapes du parcours : nom, plateformes, type,
 * architecture, stack, capacités. Voir `messages.ts` pour la composition.
 *
 * Un groupe par écran, et les **identifiants techniques comme clés** (`web`,
 * `single-app`, `payments`…) : ce sont eux qui viennent du catalogue et de la
 * fiche produit, donc eux qui se traduisent jamais eux qui se renomment. Le
 * poste de recherche, les commandes et les slugs (`next`, `pnpm install`)
 * restent hors du dictionnaire : ils sont les mêmes dans un terminal.
 *
 * Le texte variable passe par une fonction, jamais par un gabarit `{n}` : le
 * pluriel, l'accord et l'ordre des mots diffèrent d'une langue à l'autre, et
 * une fonction le dit dans la langue concernée.
 */
export const FR_WIZARD = {
  wizard: {
    /**
     * Écran 1 Create Project : le nom et la mémoire du brouillon.
     * `namePlaceholder` est le gabarit du champ. Le mode de configuration se
     * choisit au Stack Builder, pas ici.
     */
    namePlaceholder: 'mon-projet',
    name: {
      title: 'Créer un projet',
      description: 'Nommez le projet. Tout est conservé au fur et à mesure.',
      label: 'Nom du projet',
      hint: 'Minuscules, chiffres, points, tirets et soulignés. Ce nom devient le dossier et l’identifiant du projet.',
    },

    /**
     * Écran 2 Target Selection : les plateformes que le catalogue peut
     * honorer, chacune avec sa phrase, plus ce qui est retenu et pourquoi.
     */
    targets: {
      title: 'Plateformes cibles',
      description:
        'Ce choix détermine les technologies que les écrans suivants vous proposeront. Web, mobile et ordinateur peuvent se combiner : chacun devient une application du même monorepo.',
      empty: 'Aucune plateforme choisie pour l’instant.',
      count: (count: number, list: string) =>
        `${count} plateforme${count > 1 ? 's' : ''} : ${list}.`,
      labels: {
        web: { label: 'Web', note: 'Site, SPA, SSR, full-stack ou PWA.' },
        mobile: { label: 'Mobile', note: 'Android et iOS depuis une base de code unique.' },
        desktop: { label: 'Ordinateur', note: 'Windows, macOS et Linux.' },
        api: { label: 'API', note: 'Backend partagé, sans interface.' },
        library: { label: 'Bibliothèque', note: 'Paquet interne ou publiable.' },
      } satisfies Record<Target, { label: string; note: string }>,
    },

    /**
     * Écran 3 Project Type : le profil, sa phrase, et ce qu'il fait
     * recommander aux écrans suivants. `label` sert aussi de badge.
     */
    types: {
      title: 'Profil du projet',
      description:
        'Le profil oriente l’architecture et la stack proposées ensuite. Il n’entre pas dans le manifest : c’est une aide au choix, pas une contrainte du moteur.',
      legend: 'Profils disponibles',
      chosenBadge: 'Choisi',
      none: 'Aucun profil choisi pour l’instant.',
      summary: (label: string, guides: string) => `${label} : ${guides}`,
      labels: {
        saas: {
          label: 'SaaS',
          note: 'Un abonnement, des comptes clients, une facturation récurrente.',
          guides:
            'Oriente vers une authentification, une base relationnelle et un paiement par abonnement.',
        },
        marketplace: {
          label: 'Marketplace',
          note: 'Des vendeurs, des acheteurs, des transactions entre eux.',
          guides: 'Oriente vers plusieurs applications séparées et un stockage de fichiers.',
        },
        ecommerce: {
          label: 'E-commerce',
          note: 'Un catalogue, un panier, des commandes.',
          guides:
            'Oriente vers un catalogue, un paiement, le suivi des commandes et l’envoi d’e-mails.',
        },
        dashboard: {
          label: 'Dashboard',
          note: 'Des indicateurs et des tableaux de données à consulter.',
          guides: 'Oriente vers des graphiques, des tableaux triables et un accès protégé.',
        },
        blog: {
          label: 'Blog',
          note: 'Des articles, des pages publiques, une bonne visibilité.',
          guides:
            'Oriente vers un contenu éditorial, un référencement soigné et un rendu statique.',
        },
        ai: {
          label: 'IA',
          note: 'Un produit dont le cœur est un modèle de langage.',
          guides:
            'Oriente vers des appels de modèle, une recherche vectorielle et un suivi d’usage.',
        },
        api: {
          label: 'API',
          note: 'Un service partagé, sans interface à livrer.',
          guides:
            'Oriente vers une spécification ouverte, une validation stricte et un déploiement conteneurisé.',
        },
        business: {
          label: 'Application métier',
          note: 'Des processus internes, des rôles, des règles maison.',
          guides:
            'Oriente vers des rôles et permissions, des formulaires validés et un journal d’audit.',
        },
      },
    },

    /**
     * Écran 4 Architecture Builder : la forme du projet, sa description et
     * son **impact** (complexité, coût d'exploitation) c'est ce qui décide.
     */
    architecture: {
      title: 'Architecture',
      description:
        'La forme la plus souple n’est pas la moins chère à exploiter. L’architecture choisie part dans le manifest.',
      legend: 'Formes d’architecture disponibles',
      chosenBadge: 'Choisie',
      impact: (complexity: string, cost: string) =>
        `Complexité : ${complexity} · Coût d’exploitation : ${cost}`,
      none: 'Aucune architecture choisie pour l’instant.',
      summary: (label: string, complexity: string, cost: string) =>
        `${label} : complexité ${complexity}, coût ${cost}`,
      runtimeLabel: 'Exécution',
      labels: {
        'single-app': {
          label: 'Application unique',
          note: 'Une seule application, un seul dépôt, un seul déploiement.',
          complexity: 'faible',
          cost: 'minimal : un seul service à héberger et à surveiller.',
          runtime: 'un seul processus déployé.',
        },
        monorepo: {
          label: 'Monorepo',
          note: 'Plusieurs applications et paquets partagés dans un même dépôt.',
          complexity: 'moyenne',
          cost: 'modéré : la CI doit être outillée pour ne construire que ce qui change.',
          runtime: 'chaque application se déploie séparément.',
        },
        'modular-monolith': {
          label: 'Monolithe modulaire',
          note: 'Un seul déploiement, des modules internes aux frontières nettes.',
          complexity: 'moyenne',
          cost: 'faible : un seul déployable, mais une discipline de modules à tenir.',
          runtime: 'un seul déployable, des frontières internes strictes.',
        },
        microservices: {
          label: 'Microservices',
          note: 'Des services indépendants, déployés et mis à l’échelle séparément.',
          complexity: 'élevée',
          cost: 'élevé : réseau, orchestration et observabilité à financer.',
          runtime: 'un processus par service, chacun propriétaire de ses données.',
        },
        serverless: {
          label: 'Serverless',
          note: 'Des fonctions exécutées à la demande, sans serveur à administrer.',
          complexity: 'moyenne',
          cost: 'variable : à l’usage, avec un plafond de facturation à surveiller.',
          runtime: 'des fonctions à la demande, sans état.',
        },
        'event-driven': {
          label: 'Orienté événements',
          note: 'Des flux d’événements découplent producteurs et consommateurs.',
          complexity: 'élevée',
          cost: 'élevé : une file et une supervision de bout en bout.',
          runtime: 'une file ou un bus de messages entre producteurs et consommateurs.',
        },
      } satisfies Record<
        Architecture,
        {
          label: string;
          note: string;
          complexity: string;
          cost: string;
          runtime: string;
        }
      >,
    },

    /**
     * Écran 5 Stack Builder : modes, comptes, états de compatibilité,
     * recherche globale et **libellés des 37 catégories** du catalogue.
     */
    stack: {
      title: 'Stack Builder',
      description:
        'Choisissez vos technologies par catégorie. La compatibilité est revérifiée à chaque changement, et ce qui bloque est expliqué.',
      modeLegend: 'Mode de configuration',
      modeGuided: 'Guidé',
      modeGuidedNote: 'Deux à quatre choix recommandés par catégorie, marqués d’une étoile.',
      modeExpert: 'Expert',
      modeExpertNote: 'Tout le catalogue, recherche globale et filtre de compatibilité.',
      checking: 'Compatibilité en cours',
      valid: 'Combinaison valide',
      issues: (count: number) => `${count} point${count > 1 ? 's' : ''} à corriger`,
      issuesTitle: 'Ces choix ne peuvent pas être générés tels quels',
      issuesBody:
        'Corrigez les points ci-dessous : la sélection est revérifiée à chaque changement, et rien n’est écrit avant la génération.',
      chosenNone: 'Aucune technologie choisie : le mode guidé propose les plus courantes.',
      chosenCount: (count: number) =>
        `${count} technologie${count > 1 ? 's' : ''} choisie${count > 1 ? 's' : ''}`,
      loading: 'Chargement du catalogue…',
      emptyCatalogue:
        'Le catalogue ne contient aucune fiche exploitable : il n’y a rien à choisir pour l’instant.',
      resultsLabel: 'Résultats de recherche',
      resultsFor: (query: string) => `Résultats pour « ${query} »`,
      noMatch: 'Aucune technologie ne correspond à cette recherche.',
      hiddenByFilter: (count: number) =>
        `${count} option${count > 1 ? 's' : ''} incompatible${count > 1 ? 's' : ''} masquée${count > 1 ? 's' : ''} par le filtre « compatible seulement ».`,
      expertNote: 'Tout le catalogue de cette catégorie, incompatibles comprises.',
      guidedNote:
        'Les recommandations portent l’étoile ; tout le catalogue de la catégorie est affiché.',
      chosenBadge: 'Choisi',
      blockedBadge: 'Incompatible',
      blockedFallback: 'Incompatible avec la sélection en cours.',
      navLabel: 'Catégories du catalogue',
      navEyebrow: 'Catégories',
      files: (count: number) => `${count} fiche${count > 1 ? 's' : ''}`,
      searchLabel: 'Rechercher une technologie',
      searchPlaceholder: 'react, postgres, drizzle…',
      back: 'Retour aux catégories',
      chosenTitle: 'Technologies choisies',
      removeChosen: (label: string) => `Retirer ${label}`,
      compatibleOnly: 'Compatible seulement : les options bloquées sont comptées, pas oubliées.',
      categories: {
        frontend: 'Frontend',
        language: 'Langage',
        styling: 'Styles',
        ui: 'Bibliothèque d’interface',
        backend: 'Backend',
        database: 'Base de données',
        orm: 'ORM / ODM',
        authentication: 'Authentification',
        authorization: 'Autorisation',
        state: 'État client',
        'data-fetching': 'Récupération de données',
        forms: 'Formulaires',
        validation: 'Validation',
        api: 'API',
        build: 'Outils de build',
        'package-manager': 'Gestionnaire de paquets',
        monorepo: 'Monorepo',
        testing: 'Tests',
        linting: 'Lint',
        formatting: 'Formatage',
        'git-hooks': 'Crochets Git',
        containers: 'Conteneurs',
        'dev-environment': 'Environnement de développement',
        'ci-cd': 'CI/CD',
        hosting: 'Hébergement',
        storage: 'Stockage',
        cache: 'Cache',
        queue: 'File d’attente',
        search: 'Recherche',
        email: 'E-mail',
        payments: 'Paiements',
        observability: 'Observabilité',
        analytics: 'Analytique',
        security: 'Sécurité',
        ai: 'IA',
        cms: 'CMS',
        ecommerce: 'E-commerce',
      } satisfies Record<Category, string>,
    },

    /**
     * Écran 6 Capabilities : les familles de capacités du §6.7 et leur
     * phrase. C'est l'ordre de cette table qui fait la liste de l'écran :
     * `capabilities.ts` en dérive ses catégories, donc une famille ajoutée ici
     * a son libellé dans les deux langues par construction.
     */
    capabilities: {
      title: 'Capacités',
      description:
        'Ce que le projet sait faire : paiements, stockage, recherche, IA… Ces choix rejoignent le champ services du manifest. Il n’a pas de champ par famille, et c’est ce qui évite de le faire migrer à chaque capacité nouvelle. Tout est conservé dans le brouillon au fur et à mesure.',
      familiesLegend: 'Familles de capacités',
      optionsLabel: 'Options de la famille choisie',
      loading: 'Chargement des options…',
      engineDownTitle: 'Les options n’ont pas pu être chargées',
      engineDown: 'Le moteur n’a pas répondu.',
      kept: 'Capacités retenues',
      none: 'Aucune capacité choisie pour l’instant.',
      remove: (id: string) => `Retirer ${id}`,
      back: 'Retour aux familles',
      searchLabel: 'Rechercher une capacité',
      searchPlaceholder: 'stripe, s3, meilisearch…',
      searchHint: 'La recherche parcourt toutes les familles.',
      resultsLabel: 'Résultats de recherche',
      resultsFor: (query: string) => `Résultats pour « ${query} »`,
      noMatch: 'Aucune capacité ne correspond à cette recherche.',
      /** Le jeton technique reste au milieu, en chasse fixe, posé par l'écran. */
      servicesNoteBefore: 'Ces identifiants partent dans',
      servicesNoteAfter: ': le manifest ne porte aucune valeur, seulement des choix.',
      emptyFamily: 'Aucune option dans cette famille pour l’instant.',
      chosenBadge: 'Choisie',
      blockedBadge: 'Indisponible',
      families: {
        authorization: {
          label: 'Autorisations',
          note: 'Qui a le droit de faire quoi, au-delà de l’authentification.',
        },
        state: { label: 'État de l’application', note: 'Où vit l’état côté client.' },
        'data-fetching': {
          label: 'Récupération de données',
          note: 'Comment le client lit et met en cache les données du serveur.',
        },
        forms: {
          label: 'Formulaires',
          note: 'Saisie, soumission et erreurs de formulaire.',
        },
        validation: { label: 'Validation', note: 'Vérifier les données aux frontières.' },
        api: { label: 'API', note: 'Le style d’interface exposée par le backend.' },
        build: { label: 'Outils de build', note: 'Compiler et empaqueter le projet.' },
        storage: {
          label: 'Stockage de fichiers',
          note: 'Images, documents et fichiers envoyés par les utilisateurs.',
        },
        cache: { label: 'Cache', note: 'Servir plus vite ce qui est redemandé.' },
        queue: { label: 'Files d’attente', note: 'Traiter en différé ce qui est lent.' },
        search: { label: 'Recherche', note: 'Chercher dans les données du projet.' },
        email: { label: 'E-mail', note: 'Envoyer des messages transactionnels.' },
        payments: { label: 'Paiements', note: 'Encaisser, facturer, gérer les abonnements.' },
        observability: {
          label: 'Observabilité',
          note: 'Voir ce qui se passe en production : erreurs, traces, métriques.',
        },
        analytics: { label: 'Analytics', note: 'Mesurer l’usage du produit.' },
        security: { label: 'Sécurité', note: 'Analyser et durcir le projet.' },
        ai: {
          label: 'Intelligence artificielle',
          note: 'Modèles, agents et recherche vectorielle.',
        },
        cms: { label: 'CMS', note: 'Contenu éditorial géré hors du code.' },
        ecommerce: { label: 'E-commerce', note: 'Catalogue, panier et commandes.' },
      } satisfies Partial<Record<Category, { label: string; note: string }>>,
    },
  },
} as const;

export const EN_WIZARD: Widen<typeof FR_WIZARD> = {
  wizard: {
    namePlaceholder: 'my-project',
    name: {
      title: 'Create a project',
      description: 'Name the project. Everything is kept as you go.',
      label: 'Project name',
      hint: 'Lowercase letters, digits, dots, hyphens and underscores. This name becomes the folder and the project identifier.',
    },

    targets: {
      title: 'Target platforms',
      description:
        'This choice determines the technologies the next screens will offer. Web, mobile and desktop can be combined: each becomes an app of the same monorepo.',
      empty: 'No platform chosen yet.',
      count: (count: number, list: string) => `${count} platform${count > 1 ? 's' : ''}: ${list}.`,
      labels: {
        web: { label: 'Web', note: 'Site, SPA, SSR, full-stack or PWA.' },
        mobile: { label: 'Mobile', note: 'Android and iOS from a single codebase.' },
        desktop: { label: 'Desktop', note: 'Windows, macOS and Linux.' },
        api: { label: 'API', note: 'Shared backend, with no interface.' },
        library: { label: 'Library', note: 'Internal or publishable package.' },
      },
    },

    types: {
      title: 'Project profile',
      description:
        'The profile steers the architecture and stack offered next. It never enters the manifest: it is an aid to choice, not an engine constraint.',
      legend: 'Available profiles',
      chosenBadge: 'Chosen',
      none: 'No profile chosen yet.',
      summary: (label: string, guides: string) => `${label}: ${guides}`,
      labels: {
        saas: {
          label: 'SaaS',
          note: 'A subscription, customer accounts, recurring billing.',
          guides: 'Steers towards authentication, a relational database and subscription payments.',
        },
        marketplace: {
          label: 'Marketplace',
          note: 'Sellers, buyers, transactions between them.',
          guides: 'Steers towards several separate applications and file storage.',
        },
        ecommerce: {
          label: 'E-commerce',
          note: 'A catalogue, a cart, orders.',
          guides: 'Steers towards a catalogue, payments, order tracking and transactional email.',
        },
        dashboard: {
          label: 'Dashboard',
          note: 'Metrics and data tables to consult.',
          guides: 'Steers towards charts, sortable tables and protected access.',
        },
        blog: {
          label: 'Blog',
          note: 'Articles, public pages, good visibility.',
          guides: 'Steers towards editorial content, careful SEO and static rendering.',
        },
        ai: {
          label: 'AI',
          note: 'A product whose core is a language model.',
          guides: 'Steers towards model calls, vector search and usage tracking.',
        },
        api: {
          label: 'API',
          note: 'A shared service, with no interface to ship.',
          guides:
            'Steers towards an open specification, strict validation and containerised deployment.',
        },
        business: {
          label: 'Business application',
          note: 'Internal processes, roles, in-house rules.',
          guides: 'Steers towards roles and permissions, validated forms and an audit log.',
        },
      },
    },

    architecture: {
      title: 'Architecture',
      description:
        'The most flexible shape is not the cheapest to run. The chosen architecture goes into the manifest.',
      legend: 'Available architecture shapes',
      chosenBadge: 'Chosen',
      impact: (complexity: string, cost: string) =>
        `Complexity: ${complexity} · Operating cost: ${cost}`,
      none: 'No architecture chosen yet.',
      summary: (label: string, complexity: string, cost: string) =>
        `${label} : ${complexity} complexity, ${cost} cost`,
      runtimeLabel: 'Runtime',
      labels: {
        'single-app': {
          label: 'Single application',
          note: 'One application, one repository, one deployment.',
          complexity: 'low',
          cost: 'minimal: a single service to host and watch.',
          runtime: 'a single deployed process.',
        },
        monorepo: {
          label: 'Monorepo',
          note: 'Several applications and shared packages in one repository.',
          complexity: 'medium',
          cost: 'moderate: CI must be tooled to build only what changed.',
          runtime: 'each application deploys on its own.',
        },
        'modular-monolith': {
          label: 'Modular monolith',
          note: 'One deployment, internal modules with clear boundaries.',
          complexity: 'medium',
          cost: 'low: a single deployable, but module discipline to hold.',
          runtime: 'one deployable, strict internal boundaries.',
        },
        microservices: {
          label: 'Microservices',
          note: 'Independent services, deployed and scaled separately.',
          complexity: 'high',
          cost: 'high: network, orchestration and observability to fund.',
          runtime: 'one process per service, each owning its data.',
        },
        serverless: {
          label: 'Serverless',
          note: 'Functions run on demand, with no server to administer.',
          complexity: 'medium',
          cost: 'variable: pay as you go, with a billing cap to watch.',
          runtime: 'stateless on-demand functions.',
        },
        'event-driven': {
          label: 'Event-driven',
          note: 'Event streams decouple producers and consumers.',
          complexity: 'high',
          cost: 'high: a queue and end-to-end supervision.',
          runtime: 'a queue or message bus between producers and consumers.',
        },
      },
    },

    stack: {
      title: 'Stack Builder',
      description:
        'Pick your technologies category by category. Compatibility is rechecked on every change, and what blocks is explained.',
      modeLegend: 'Configuration mode',
      modeGuided: 'Guided',
      modeGuidedNote: 'Two to four recommended choices per category, marked with a star.',
      modeExpert: 'Expert',
      modeExpertNote: 'The whole catalogue, global search and a compatibility filter.',
      checking: 'Checking compatibility',
      valid: 'Valid combination',
      issues: (count: number) => `${count} point${count > 1 ? 's' : ''} to fix`,
      issuesTitle: 'These choices cannot be generated as they are',
      issuesBody:
        'Fix the points below: the selection is rechecked on every change, and nothing is written before generation.',
      chosenNone: 'No technology chosen: guided mode offers the most common ones.',
      chosenCount: (count: number) => `${count} technolog${count > 1 ? 'ies' : 'y'} chosen`,
      loading: 'Loading the catalogue…',
      emptyCatalogue: 'The catalogue holds no usable entry: there is nothing to choose yet.',
      resultsLabel: 'Search results',
      resultsFor: (query: string) => `Results for “${query}”`,
      noMatch: 'No technology matches this search.',
      hiddenByFilter: (count: number) =>
        `${count} incompatible option${count > 1 ? 's' : ''} hidden by the “compatible only” filter.`,
      expertNote: 'The whole catalogue for this category, incompatibilities included.',
      guidedNote: 'Recommendations carry the star; the whole category catalogue is shown.',
      chosenBadge: 'Chosen',
      blockedBadge: 'Incompatible',
      blockedFallback: 'Incompatible with the current selection.',
      navLabel: 'Catalogue categories',
      navEyebrow: 'Categories',
      files: (count: number) => `${count} entr${count > 1 ? 'ies' : 'y'}`,
      searchLabel: 'Search for a technology',
      searchPlaceholder: 'react, postgres, drizzle…',
      back: 'Back to categories',
      chosenTitle: 'Chosen technologies',
      removeChosen: (label: string) => `Remove ${label}`,
      compatibleOnly: 'Compatible only: blocked options are counted, not forgotten.',
      categories: {
        frontend: 'Frontend',
        language: 'Language',
        styling: 'Styling',
        ui: 'UI library',
        backend: 'Backend',
        database: 'Database',
        orm: 'ORM / ODM',
        authentication: 'Authentication',
        authorization: 'Authorization',
        state: 'Client state',
        'data-fetching': 'Data fetching',
        forms: 'Forms',
        validation: 'Validation',
        api: 'API',
        build: 'Build tools',
        'package-manager': 'Package manager',
        monorepo: 'Monorepo',
        testing: 'Testing',
        linting: 'Lint',
        formatting: 'Formatting',
        'git-hooks': 'Git hooks',
        containers: 'Containers',
        'dev-environment': 'Development environment',
        'ci-cd': 'CI/CD',
        hosting: 'Hosting',
        storage: 'Storage',
        cache: 'Cache',
        queue: 'Queue',
        search: 'Search',
        email: 'Email',
        payments: 'Payments',
        observability: 'Observability',
        analytics: 'Analytics',
        security: 'Security',
        ai: 'AI',
        cms: 'CMS',
        ecommerce: 'E-commerce',
      },
    },

    capabilities: {
      title: 'Capabilities',
      description:
        'What the project can do: payments, storage, search, AI… These choices join the services field of the manifest. It has no per-family field, which is what keeps it from migrating for every new capability. Everything is kept in the draft as you go.',
      familiesLegend: 'Capability families',
      optionsLabel: 'Options in the chosen family',
      loading: 'Loading options…',
      engineDownTitle: 'The options could not be loaded',
      engineDown: 'The engine did not answer.',
      kept: 'Chosen capabilities',
      none: 'No capability chosen yet.',
      remove: (id: string) => `Remove ${id}`,
      back: 'Back to families',
      searchLabel: 'Search for a capability',
      searchPlaceholder: 'stripe, s3, meilisearch…',
      searchHint: 'The search walks every family.',
      resultsLabel: 'Search results',
      resultsFor: (query: string) => `Results for “${query}”`,
      noMatch: 'No capability matches this search.',
      servicesNoteBefore: 'These identifiers go into',
      servicesNoteAfter: ': the manifest carries no value, only choices.',
      emptyFamily: 'No option in this family yet.',
      chosenBadge: 'Chosen',
      blockedBadge: 'Unavailable',
      families: {
        authorization: {
          label: 'Authorization',
          note: 'Who may do what, beyond authentication.',
        },
        state: { label: 'Application state', note: 'Where client-side state lives.' },
        'data-fetching': {
          label: 'Data fetching',
          note: 'How the client reads and caches server data.',
        },
        forms: { label: 'Forms', note: 'Input, submission and form errors.' },
        validation: { label: 'Validation', note: 'Check data at the boundaries.' },
        api: { label: 'API', note: 'The style of interface the backend exposes.' },
        build: { label: 'Build tools', note: 'Compile and bundle the project.' },
        storage: {
          label: 'File storage',
          note: 'Images, documents and files uploaded by users.',
        },
        cache: { label: 'Cache', note: 'Serve what is asked for again, faster.' },
        queue: { label: 'Queues', note: 'Process slow work later.' },
        search: { label: 'Search', note: 'Search the project’s data.' },
        email: { label: 'Email', note: 'Send transactional messages.' },
        payments: { label: 'Payments', note: 'Charge, invoice, manage subscriptions.' },
        observability: {
          label: 'Observability',
          note: 'See what happens in production: errors, traces, metrics.',
        },
        analytics: { label: 'Analytics', note: 'Measure how the product is used.' },
        security: { label: 'Security', note: 'Scan and harden the project.' },
        ai: { label: 'Artificial intelligence', note: 'Models, agents and vector search.' },
        cms: { label: 'CMS', note: 'Editorial content managed outside the code.' },
        ecommerce: { label: 'E-commerce', note: 'Catalogue, cart and orders.' },
      },
    },
  },
};

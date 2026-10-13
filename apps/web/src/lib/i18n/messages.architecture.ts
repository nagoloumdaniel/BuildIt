import type { Widen } from './widen';

/**
 * L'architecture d'un projet : l'arbre des fichiers générés et le rôle de chacun.
 *
 * Voir `messages.ts` pour la composition. Le français fait foi : une clé
 * ajoutée d'un côté sans l'autre fait échouer `pnpm typecheck`.
 *
 * `notes` est la **base de connaissance** des chemins : chaque phrase dit à
 * quoi sert un dossier ou un fichier et ce qu'on y range. Le choix de la phrase
 * pour un chemin donné (motifs, spécificité, condition sur la stack) vit dans
 * `lib/architecture-notes.ts` ; ici, il n'y a que le texte. Une phrase n'est
 * écrite que pour ce que le générateur produit vraiment : relire les gabarits
 * avant d'en ajouter une.
 */

export const FR_ARCHITECTURE = {
  architecture: {
    title: 'Architecture du projet',
    description:
      'Les dossiers et fichiers que vos choix vont produire, et le rôle de chacun. Rien n’est écrit sur le disque.',
    descriptionIncomplete: 'Les dossiers et fichiers que vos choix vont produire.',
    incompleteTitle: 'Pas encore d’architecture à montrer',
    incompleteBody:
      'Le brouillon est incomplet : le moteur ne peut pas encore dire quels fichiers il produira. Complétez vos choix, puis revenez.',
    fixStack: 'Corriger mes choix',
    backHome: 'Retour au tableau de bord',
    loading: 'Calcul de l’architecture par le moteur…',
    dryRun: 'Dry-run',
    files: (count: number) => `${count} fichier${count > 1 ? 's' : ''}`,
    warningsTitle: 'Avertissements du plan',
    treeLabel: 'Architecture du projet : dossiers et fichiers générés',
    expandAll: 'Tout déplier',
    collapseAll: 'Tout replier',
    failedTitle: 'L’architecture n’a pas pu être calculée',
    failedBody: 'Le moteur n’a pas répondu. Rien n’a été écrit ; vous pouvez relancer le calcul.',
    retry: 'Réessayer',
    refusedTitle: 'Le moteur refuse ces choix',
    refusedBody: 'Aucun fichier ne serait produit. Les raisons du moteur, telles quelles :',
    emptyTitle: 'Aucun fichier à générer',
    emptyBody: 'Le plan est vide pour ces choix : il n’y a pas d’architecture à décrire.',

    /** La page `/projects/architecture` : l'architecture d'un projet déjà généré. */
    project: {
      title: (name: string) => `Architecture de ${name}`,
      description:
        'Les dossiers et fichiers que le moteur produit pour les choix de ce projet, recalculés à partir de son manifest.',
      fallbackTitle: 'Architecture d’un projet',
      back: 'Tous les projets',
      loading: 'Lecture du projet dans ce navigateur…',
      unknownTitle: 'Projet introuvable',
      unknownBody:
        'Ce projet n’est pas dans la liste de ce navigateur : il a peut-être été retiré, ou généré ailleurs.',
      legacyTitle: 'Architecture indisponible pour ce projet',
      legacyBody:
        'Ce projet a été généré avant que BuildIt ne conserve ses choix : sans eux, le moteur ne peut pas recalculer son architecture. Le dossier sur le disque, lui, est intact.',
      backToProjects: 'Retour aux projets',
    },

    notes: {
      // Racine
      readme:
        'Le point d’entrée du dépôt : ce que fait le projet, comment l’installer et le lancer, et la stack retenue.',
      packageJson:
        'Les dépendances, leurs versions et les scripts (dev, build, test, lint) que lance pnpm.',
      packageJsonMonorepo:
        'Les scripts qui pilotent tout le dépôt. Les dépendances de chaque application vivent dans son propre package.json.',
      gitignore:
        'Ce que Git ne versionne pas : dépendances installées, builds, et le .env qui porte vos vraies valeurs.',
      envExample:
        'Les variables d’environnement que le projet lit, sans valeur secrète. Copiez-le en .env et remplissez-le.',
      envDts:
        'Le type de chaque variable d’environnement pour TypeScript : une faute de frappe dans process.env ne compile pas.',
      tsconfig:
        'Les règles du compilateur TypeScript (mode strict) et l’alias @/ qui évite les imports en ../../.',
      biome: 'La configuration de Biome, qui formate et vérifie le code en une seule passe.',
      pnpmWorkspace:
        'Les paquets autorisés à exécuter un script d’installation (Prisma, par exemple) : pnpm refuse les autres.',
      pnpmWorkspaceMonorepo:
        'Déclare les paquets du dépôt (apps/*, packages/*) et les scripts d’installation autorisés.',
      turbo:
        'L’ordre des tâches entre les paquets : build, test et lint s’enchaînent dans le bon ordre et sont mis en cache.',
      dockerfile:
        'Construit l’image de production en étapes : dépendances, build, puis une image d’exécution qui lance pnpm start.',
      dockerignore:
        'Ce que Docker n’envoie pas au build (node_modules, .env, historique Git) : une image plus petite et sans secret.',
      compose:
        'Les services locaux de la stack (base de données, cache…) lancés par docker compose up, avec des identifiants de développement.',
      devcontainer:
        'Un environnement de développement prêt dans un conteneur (VS Code, Codespaces), avec les ports du projet ouverts.',
      github: 'Ce que GitHub exécute pour ce dépôt.',
      ci: 'L’intégration continue : à chaque push sur main et à chaque pull request, installe puis lance les vérifications du projet.',
      nextConfig: 'La configuration de Next.js : options de build, en-têtes, domaines d’images.',
      prismaConfig: 'Dit à Prisma où lire le schéma et quelle base viser (DATABASE_URL).',
      playwrightConfig:
        'Configure Playwright : l’application à démarrer avant les tests de bout en bout et le navigateur utilisé.',
      instrumentation:
        'Chargé par Next.js au démarrage du serveur : initialise Sentry pour remonter les erreurs côté serveur.',
      instrumentationClient:
        'Chargé dans le navigateur avant l’application : importe le client de chaque outil de suivi de lib/observability.',

      // Next.js
      appRouter:
        'Les routes de Next.js (App Router) : un dossier par URL, page.tsx pour l’écran, layout.tsx pour ce qui l’entoure, route.ts pour une API.',
      appStyles: 'Les fichiers communs à toute l’application, à commencer par sa feuille de style.',
      rootLayout:
        'La mise en page racine, autour de toutes les pages : balise html, métadonnées, styles globaux.',
      homePage:
        'La page d’accueil (/). Elle liste ce qui est déjà câblé : remplacez-la par la vôtre.',
      globalsCss:
        'Les styles globaux : import de Tailwind et jetons de couleur, en clair et en sombre.',
      apiRoutes: 'Les routes HTTP servies par Next.js lui-même, sous /api.',
      authRoute:
        'L’authentification Better Auth : connexion, inscription et session passent par /api/auth.',
      catchAll:
        'Un segment attrape-tout : chaque URL sous /api/auth arrive ici et part chez Better Auth.',
      statusPage: 'La page /status : interroge l’API par lib/api.ts et dit si elle répond.',
      dashboard:
        'L’espace d’administration. Son layout vérifie la session côté serveur : sans compte connecté, rien n’est envoyé.',
      dashboardUsers: 'Le tableau des utilisateurs inscrits.',
      dashboardSettings: 'Les paramètres du compte connecté.',
      signIn: 'La page de connexion, vers laquelle renvoie l’espace protégé.',
      components: 'Les composants React réutilisés par plusieurs pages.',
      componentsUi:
        'Les composants de base de shadcn/ui, copiés dans le projet : ils vous appartiennent, modifiez-les directement.',
      componentsDashboard:
        'Les composants propres à l’espace d’administration : navigation, graphique, tableau.',

      // Code partagé de l'application
      lib: 'Le code non visuel : accès à la base, authentification, clients des services externes.',
      db: 'Le client Prisma, créé une fois et réutilisé : toutes les requêtes à la base passent par lui.',
      auth: 'La configuration serveur de Better Auth : la base utilisée et les méthodes de connexion.',
      authClient:
        'Le client Better Auth des composants du navigateur : connexion, déconnexion, session.',
      utils:
        'cn(), qui fusionne les classes Tailwind ; les composants de components/ui s’en servent.',
      redis: 'Le client Redis partagé. La connexion s’ouvre au premier appel, jamais à l’import.',
      apiClient:
        'Le client de l’API vu de l’application web, construit sur le contrat partagé ; API_URL dit où la joindre.',
      observability:
        'Les clients des outils de suivi chargés dans le navigateur, un fichier par outil.',
      sentryClient: 'Remonte à Sentry les erreurs survenues dans le navigateur.',
      posthogClient: 'Mesure l’audience avec PostHog.',
      email: 'L’envoi des emails transactionnels par Resend.',
      stripe: 'Le paiement Stripe.',
      checkout: 'Crée une session Stripe Checkout et renvoie l’adresse de paiement.',
      dashboardData:
        'Les indicateurs de la vue d’ensemble, calculés sur les tables de Better Auth.',
      signups: 'Regroupe les inscriptions par jour pour le graphique.',

      // Base de données
      prisma:
        'Le schéma de la base, un fichier par domaine. Prisma en tire le client typé et les migrations (pnpm db:migrate).',
      schemaPrisma:
        'La connexion à la base et le générateur du client. Ajoutez vos modèles à côté.',
      authPrisma: 'Les tables de Better Auth : utilisateurs, sessions, comptes, vérifications.',

      // Tests
      unitTest: 'Un test Vitest, rangé à côté du code qu’il vérifie.',
      e2e: 'Les tests de bout en bout : Playwright ouvre l’application dans un vrai navigateur et la parcourt.',
      homeE2e: 'Vérifie que la page d’accueil s’affiche.',

      // Serveur Hono
      honoSrc: 'Le code du serveur Hono.',
      honoApp:
        'Les routes et leurs schémas Zod, qui valident l’entrée et produisent la documentation /openapi.json. Sans port ouvert : les tests l’appellent directement.',
      honoIndex: 'Démarre le serveur HTTP (port 3001 par défaut, PORT pour le changer).',
      honoTest:
        'Appelle l’API en mémoire : /health répond, la documentation OpenAPI décrit ses routes.',
      contractTest: 'Vérifie que les réponses de l’API respectent le contrat de packages/shared.',

      // Monorepo
      apps: 'Les applications déployables, une par cible. Chacune a ses dépendances et ses variables, et se lance seule.',
      appWeb: 'L’application web : ses pages, ses composants et son accès aux données.',
      appApi:
        'L’API : ses routes, sa logique serveur et ses tests. Elle tourne dans son propre processus.',
      packages:
        'Le code partagé entre les applications, sous forme de paquets internes du workspace.',
      shared:
        'Le contrat entre apps/web et apps/api : schémas et client typé importés des deux côtés. Un changement d’API casse la compilation, pas la production.',
    },
  },
} as const;

export const EN_ARCHITECTURE: Widen<typeof FR_ARCHITECTURE> = {
  architecture: {
    title: 'Project architecture',
    description:
      'The folders and files your choices will produce, and what each one is for. Nothing is written to disk.',
    descriptionIncomplete: 'The folders and files your choices will produce.',
    incompleteTitle: 'No architecture to show yet',
    incompleteBody:
      'The draft is incomplete: the engine cannot tell yet which files it will produce. Complete your choices, then come back.',
    fixStack: 'Fix my choices',
    backHome: 'Back to the dashboard',
    loading: 'The engine is computing the architecture…',
    dryRun: 'Dry-run',
    files: (count: number) => `${count} file${count === 1 ? '' : 's'}`,
    warningsTitle: 'Plan warnings',
    treeLabel: 'Project architecture: generated folders and files',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    failedTitle: 'The architecture could not be computed',
    failedBody:
      'The engine did not answer. Nothing was written; you can run the computation again.',
    retry: 'Try again',
    refusedTitle: 'The engine refuses these choices',
    refusedBody: 'No file would be produced. The engine’s reasons, as is:',
    emptyTitle: 'No file to generate',
    emptyBody: 'The plan is empty for these choices: there is no architecture to describe.',

    project: {
      title: (name: string) => `${name} architecture`,
      description:
        'The folders and files the engine produces for this project’s choices, recomputed from its manifest.',
      fallbackTitle: 'Project architecture',
      back: 'All projects',
      loading: 'Reading the project in this browser…',
      unknownTitle: 'Project not found',
      unknownBody:
        'This project is not in this browser’s list: it may have been removed, or generated elsewhere.',
      legacyTitle: 'Architecture unavailable for this project',
      legacyBody:
        'This project was generated before BuildIt kept its choices: without them, the engine cannot recompute its architecture. The folder on disk is untouched.',
      backToProjects: 'Back to projects',
    },

    notes: {
      readme:
        'The entry point of the repository: what the project does, how to install and run it, and the chosen stack.',
      packageJson:
        'Dependencies, their versions and the scripts (dev, build, test, lint) that pnpm runs.',
      packageJsonMonorepo:
        'The scripts that drive the whole repository. Each application keeps its dependencies in its own package.json.',
      gitignore:
        'What Git does not track: installed dependencies, builds, and the .env holding your real values.',
      envExample:
        'The environment variables the project reads, with no secret value. Copy it to .env and fill it in.',
      envDts:
        'The type of each environment variable for TypeScript: a typo in process.env does not compile.',
      tsconfig:
        'The TypeScript compiler rules (strict mode) and the @/ alias that avoids ../../ imports.',
      biome: 'The Biome configuration, which formats and checks the code in a single pass.',
      pnpmWorkspace:
        'The packages allowed to run an install script (Prisma, for instance): pnpm refuses the others.',
      pnpmWorkspaceMonorepo:
        'Declares the repository packages (apps/*, packages/*) and the allowed install scripts.',
      turbo:
        'The task order across packages: build, test and lint run in the right order and are cached.',
      dockerfile:
        'Builds the production image in stages: dependencies, build, then a runtime image that runs pnpm start.',
      dockerignore:
        'What Docker leaves out of the build (node_modules, .env, Git history): a smaller image with no secret.',
      compose:
        'The stack’s local services (database, cache…) started by docker compose up, with development credentials.',
      devcontainer:
        'A ready development environment in a container (VS Code, Codespaces), with the project ports open.',
      github: 'What GitHub runs for this repository.',
      ci: 'Continuous integration: on every push to main and every pull request, installs then runs the project checks.',
      nextConfig: 'The Next.js configuration: build options, headers, image domains.',
      prismaConfig:
        'Tells Prisma where to read the schema and which database to target (DATABASE_URL).',
      playwrightConfig:
        'Configures Playwright: the application to start before end-to-end tests and the browser used.',
      instrumentation:
        'Loaded by Next.js when the server starts: sets up Sentry to report server-side errors.',
      instrumentationClient:
        'Loaded in the browser before the application: imports the client of each tracking tool in lib/observability.',

      appRouter:
        'The Next.js routes (App Router): one folder per URL, page.tsx for the screen, layout.tsx for what surrounds it, route.ts for an API.',
      appStyles: 'Files shared by the whole application, starting with its stylesheet.',
      rootLayout: 'The root layout around every page: html tag, metadata, global styles.',
      homePage: 'The home page (/). It lists what is already wired: replace it with your own.',
      globalsCss: 'Global styles: the Tailwind import and the colour tokens, light and dark.',
      apiRoutes: 'HTTP routes served by Next.js itself, under /api.',
      authRoute: 'Better Auth authentication: sign-in, sign-up and session go through /api/auth.',
      catchAll:
        'A catch-all segment: every URL under /api/auth lands here and goes to Better Auth.',
      statusPage:
        'The /status page: queries the API through lib/api.ts and says whether it answers.',
      dashboard:
        'The admin area. Its layout checks the session on the server: without a signed-in account, nothing is sent.',
      dashboardUsers: 'The table of registered users.',
      dashboardSettings: 'The signed-in account settings.',
      signIn: 'The sign-in page the protected area redirects to.',
      components: 'React components reused by several pages.',
      componentsUi:
        'The shadcn/ui base components, copied into the project: you own them, edit them directly.',
      componentsDashboard: 'Components specific to the admin area: navigation, chart, table.',

      lib: 'Non-visual code: database access, authentication, clients for external services.',
      db: 'The Prisma client, created once and reused: every database query goes through it.',
      auth: 'The Better Auth server configuration: the database used and the sign-in methods.',
      authClient: 'The Better Auth client for browser components: sign-in, sign-out, session.',
      utils: 'cn(), which merges Tailwind classes; the components in components/ui use it.',
      redis: 'The shared Redis client. The connection opens on first call, never on import.',
      apiClient:
        'The API client as seen from the web application, built on the shared contract; API_URL says where to reach it.',
      observability: 'Clients of the tracking tools loaded in the browser, one file per tool.',
      sentryClient: 'Reports errors raised in the browser to Sentry.',
      posthogClient: 'Measures the audience with PostHog.',
      email: 'Sends transactional emails through Resend.',
      stripe: 'Stripe payments.',
      checkout: 'Creates a Stripe Checkout session and returns the payment URL.',
      dashboardData: 'The overview metrics, computed on the Better Auth tables.',
      signups: 'Groups sign-ups by day for the chart.',

      prisma:
        'The database schema, one file per domain. Prisma derives the typed client and migrations from it (pnpm db:migrate).',
      schemaPrisma: 'The database connection and the client generator. Add your models next to it.',
      authPrisma: 'The Better Auth tables: users, sessions, accounts, verifications.',

      unitTest: 'A Vitest test, placed next to the code it checks.',
      e2e: 'End-to-end tests: Playwright opens the application in a real browser and walks through it.',
      homeE2e: 'Checks that the home page renders.',

      honoSrc: 'The Hono server code.',
      honoApp:
        'The routes and their Zod schemas, which validate input and produce the /openapi.json documentation. No port opened: tests call it directly.',
      honoIndex: 'Starts the HTTP server (port 3001 by default, PORT to change it).',
      honoTest:
        'Calls the API in memory: /health answers, the OpenAPI documentation lists its routes.',
      contractTest: 'Checks that the API responses honour the packages/shared contract.',

      apps: 'The deployable applications, one per target. Each has its own dependencies and variables, and runs on its own.',
      appWeb: 'The web application: its pages, components and data access.',
      appApi: 'The API: its routes, server logic and tests. It runs in its own process.',
      packages: 'Code shared between applications, as internal workspace packages.',
      shared:
        'The contract between apps/web and apps/api: schemas and a typed client imported on both sides. An API change breaks the build, not production.',
    },
  },
};

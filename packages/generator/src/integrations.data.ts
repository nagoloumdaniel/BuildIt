/**
 * Ce que chaque technologie apporte au projet généré, au-delà de ses paquets.
 *
 * Le registry dit ce qu'**est** une technologie : catégorie, licence, paquets,
 * relations. Il ne dit pas ce qu'elle **fait** dans un projet — quels scripts
 * npm elle installe, quel service Docker elle demande. C'est une couche
 * d'intégration, pas d'identité, et la mélanger au registry brouillerait une
 * frontière qui tient depuis la Phase 3.
 *
 * Données en TypeScript plutôt qu'en JSON : contrairement au registry, ce
 * fichier n'a pas vocation à recevoir des contributions externes ni à être
 * publié. Un module typé évite tout l'appareillage de chargement pour un
 * bénéfice nul.
 */

/**
 * Service à lancer en local pour développer contre cette technologie (§15).
 *
 * Volontairement minimal : image, port, variables, volume. Tout ce qui relève
 * du déploiement — répliques, réseaux, secrets managés — sort du périmètre du
 * MVP et alourdirait un fichier que l'utilisateur doit pouvoir relire.
 */
export interface DockerService {
  /** Nom du service dans docker-compose.yml. */
  readonly name: string;
  readonly image: string;
  /** Port hôte → port conteneur. */
  readonly ports?: readonly string[];
  /**
   * Variables d'environnement du conteneur.
   *
   * Uniquement des valeurs de développement local, jamais un secret : ce
   * fichier est versionné (§24).
   */
  readonly environment?: Readonly<Record<string, string>>;
  /**
   * Volume nommé et point de montage.
   *
   * Le chemin doit venir de la donnee, jamais etre derive du nom du service :
   * PostgreSQL ecrit dans /var/lib/postgresql/data, Redis dans /data, MySQL
   * dans /var/lib/mysql. Une regle generique monterait le volume a cote des
   * donnees, et rien ne serait persiste — sans erreur visible.
   */
  readonly volume?: { readonly name: string; readonly path: string };
  /** Commande de vérification de démarrage. */
  readonly healthcheck?: string;
}

/** Ce qu'un fichier de configuration peut savoir du projet qu'il configure. */
export interface IntegrationContext {
  /** Noms des variables d'environnement, triés — les mêmes que `.env.example`. */
  readonly env: readonly string[];
}

/**
 * Fichier de configuration qu'une technologie exige pour fonctionner.
 *
 * Un script `typecheck` sans `tsconfig.json`, un `biome check` sans
 * `biome.json` : le script existe, l'outil échoue. Le fichier voyage donc avec
 * l'intégration qui le rend nécessaire, jamais séparément.
 */
export interface IntegrationFile {
  readonly path: string;
  readonly contents: string | ((context: IntegrationContext) => string);
}

export interface Integration {
  /** Identifiant d'une fiche du registry. */
  readonly id: string;
  /** Scripts npm à ajouter au package.json généré. */
  readonly scripts?: Readonly<Record<string, string>>;
  /**
   * Scripts qui opèrent sur le code de l'application : `dev`, `build`,
   * `prisma generate`…
   *
   * Ils ne sont émis que pour une fiche `certified`, c'est-à-dire quand un
   * template pose réellement ce code. Sur une fiche seulement déclarée,
   * `next build` échouerait faute d'application — et la CI générée avec lui.
   */
  readonly appScripts?: Readonly<Record<string, string>>;
  /**
   * Paquets dont le script d'installation doit pouvoir s'exécuter.
   *
   * pnpm 11 bloque ces scripts par défaut et fait **échouer** l'installation
   * s'il en rencontre un non approuvé. Liste minimale : chaque entrée est une
   * autorisation d'exécuter du code sur la machine de l'utilisateur.
   */
  readonly allowBuilds?: readonly string[];
  /** Fichiers de configuration sans lesquels les scripts échouent. */
  readonly files?: readonly IntegrationFile[];
  /** Service local à ajouter à docker-compose.yml. */
  readonly docker?: DockerService;
}

/**
 * `strict` et `noEmit` : le projet généré vérifie ses types, il ne compile pas
 * avec tsc — c'est le travail du framework ou du bundler.
 */
const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules", "dist"]
}
`;

/**
 * Types de `process.env`, alignés sur `.env.example`.
 *
 * Ce fichier a une seconde raison d'exister : sans lui, un socle TypeScript
 * n'a aucun fichier d'entrée, et `tsc` échoue (TS18003) avant d'avoir vérifié
 * quoi que ce soit. Plutôt qu'un fichier factice, un fichier qui sert.
 *
 * Les variables sont optionnelles : rien ne garantit qu'elles soient
 * renseignées, et un type qui l'affirmerait mentirait.
 */
function envDeclaration(context: IntegrationContext): string {
  const header = [
    '// Variables d’environnement de ce projet, typées pour `process.env`.',
    '// Gardez ce fichier aligné sur .env.example.',
    '',
  ];
  if (context.env.length === 0) {
    // Une interface vide serait signalée par le linter : le fichier reste un
    // module vide, qui suffit à donner une entrée à tsc.
    return `${[...header, 'export {};'].join('\n')}\n`;
  }
  return `${[
    ...header,
    'declare namespace NodeJS {',
    '  interface ProcessEnv {',
    ...context.env.map((name) => `    readonly ${name}?: string;`),
    '  }',
    '}',
  ].join('\n')}\n`;
}

/**
 * Configuration Biome du projet généré.
 *
 * L'indentation en espaces n'est pas un goût : c'est celle de tous les fichiers
 * que le générateur écrit. Sans ce fichier, Biome formate en tabulations et
 * refuse le package.json généré au premier `pnpm lint`.
 */
const BIOME_JSON = `{
  "files": {
    "ignoreUnknown": true,
    "includes": ["**", "!**/dist", "!**/.next", "!**/coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single" }
  }
}
`;

export const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'typescript',
    scripts: { typecheck: 'tsc --noEmit' },
    files: [
      { path: 'tsconfig.json', contents: TSCONFIG },
      { path: 'env.d.ts', contents: envDeclaration },
    ],
  },
  {
    id: 'biome',
    scripts: { lint: 'biome check .', 'lint:fix': 'biome check --write .' },
    files: [{ path: 'biome.json', contents: BIOME_JSON }],
  },
  {
    id: 'vitest',
    // Un socle neuf n'a pas encore de test : sans ce drapeau, le premier
    // `pnpm test` échoue, et la CI générée avec lui.
    scripts: { test: 'vitest run --passWithNoTests' },
  },
  {
    id: 'playwright',
    scripts: { 'test:e2e': 'playwright test' },
  },
  {
    id: 'next',
    appScripts: { dev: 'next dev', build: 'next build', start: 'next start' },
  },
  {
    id: 'prisma',
    appScripts: { 'db:generate': 'prisma generate', 'db:migrate': 'prisma migrate dev' },
    // Prisma 7 : prisma et @prisma/engines (constaté par le test de fumée).
    // Prisma 6, encore dans la plage de la fiche, y ajoute @prisma/client.
    allowBuilds: ['@prisma/client', '@prisma/engines', 'prisma'],
  },
  {
    id: 'eslint',
    scripts: { lint: 'eslint .' },
  },
  {
    id: 'prettier',
    scripts: { format: 'prettier --write .' },
  },
  {
    id: 'jest',
    scripts: { test: 'jest --passWithNoTests' },
  },
  {
    id: 'cypress',
    scripts: { 'test:e2e': 'cypress run' },
  },
  {
    id: 'vite',
    appScripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    // esbuild télécharge son binaire natif à l'installation.
    allowBuilds: ['esbuild'],
  },

  // --- services locaux (§15) ---
  // Les identifiants et mots de passe ci-dessous sont des valeurs de
  // développement local, destinées à un conteneur éphémère sur la machine du
  // développeur. Ce ne sont pas des secrets : ils n'ouvrent l'accès à rien
  // d'autre qu'une base vide créée à l'instant. §24 interdit les secrets dans
  // un fichier généré, pas les identifiants de bac à sable.
  {
    id: 'postgresql',
    docker: {
      name: 'postgres',
      image: 'postgres:17-alpine',
      ports: ['5432:5432'],
      environment: {
        POSTGRES_USER: 'postgres',
        POSTGRES_PASSWORD: 'postgres',
        POSTGRES_DB: 'app',
      },
      volume: { name: 'postgres-data', path: '/var/lib/postgresql/data' },
      healthcheck: 'pg_isready -U postgres',
    },
  },
  {
    id: 'mysql',
    docker: {
      name: 'mysql',
      image: 'mysql:8',
      ports: ['3306:3306'],
      environment: { MYSQL_ROOT_PASSWORD: 'mysql', MYSQL_DATABASE: 'app' },
      volume: { name: 'mysql-data', path: '/var/lib/mysql' },
      healthcheck: 'mysqladmin ping -h localhost',
    },
  },
  {
    id: 'redis',
    docker: {
      name: 'redis',
      image: 'redis:8-alpine',
      ports: ['6379:6379'],
      volume: { name: 'redis-data', path: '/data' },
      healthcheck: 'redis-cli ping',
    },
  },
  {
    id: 'minio',
    docker: {
      name: 'minio',
      image: 'minio/minio:latest',
      ports: ['9000:9000', '9001:9001'],
      environment: { MINIO_ROOT_USER: 'minio', MINIO_ROOT_PASSWORD: 'minio123' },
      volume: { name: 'minio-data', path: '/data' },
    },
  },
  {
    id: 'meilisearch',
    docker: {
      name: 'meilisearch',
      image: 'getmeili/meilisearch:latest',
      ports: ['7700:7700'],
      environment: { MEILI_ENV: 'development' },
      volume: { name: 'meilisearch-data', path: '/meili_data' },
    },
  },
  {
    id: 'mongodb',
    docker: {
      name: 'mongo',
      image: 'mongo:8',
      ports: ['27017:27017'],
      volume: { name: 'mongo-data', path: '/data/db' },
    },
  },
];

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
  /**
   * Variable d'environnement et URL qui joignent ce service en local.
   *
   * Écrite en **commentaire** dans docker-compose.yml, à côté des identifiants
   * de bac à sable qu'elle reprend — jamais dans `.env.example`, qui ne porte
   * aucune valeur (§24).
   */
  readonly connection?: { readonly env: string; readonly url: string };
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
  /**
   * Fiche qui doit **aussi** être dans la stack pour que l'intégration
   * s'applique.
   *
   * Certains fichiers dépendent d'une combinaison, pas d'une technologie :
   * le client Prisma n'est pas le même sur PostgreSQL et sur MySQL. Poser le
   * code PostgreSQL pour Prisma seul livrerait un projet faux dès qu'on change
   * de base. Une combinaison sans intégration ne reçoit rien — et reste
   * `experimental` tant qu'une de ses fiches l'est.
   */
  readonly when?: string | readonly string[];
  /** Paquets que l'intégration ajoute, avec leur plage — jamais de `*`. */
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
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
    "noUncheckedIndexedAccess": true,
    "jsx": "preserve",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "paths": { "@/*": ["./*"] }
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
    "includes": ["**", "!**/dist", "!**/.next", "!**/coverage", "!**/generated"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": { "preset": "recommended" }
  },
  "javascript": {
    "formatter": { "quoteStyle": "single" }
  },
  "css": {
    "parser": { "tailwindDirectives": true }
  }
}
`;

/**
 * Configuration Prisma 7.
 *
 * `process.env` et non `env('DATABASE_URL')` de prisma/config : ce dernier
 * **lève** quand la variable manque, et `prisma generate` — qui n'a pas besoin
 * de base — échouerait en CI et à l'installation. Schéma en dossier : chaque
 * intégration (Better Auth, notamment) y ajoute son fichier sans réécrire
 * celui des autres.
 */
const PRISMA_CONFIG = `import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema',
  datasource: { url: process.env.DATABASE_URL },
});
`;

const PRISMA_SCHEMA_POSTGRESQL = `// Schéma Prisma. Ajoutez vos modèles dans ce dossier, un fichier par domaine.
// Après modification : pnpm db:migrate

generator client {
  provider = "prisma-client"
  output   = "../../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
`;

const PRISMA_CLIENT_POSTGRESQL = `import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Client de base de données, partagé par toute l'application.
 *
 * En développement, le rechargement à chaud réévalue les modules : sans ce
 * cache, chaque modification ouvrirait un nouveau pool de connexions.
 */
const cache = globalThis as unknown as { db?: PrismaClient };

export const db: PrismaClient =
  cache.db ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

if (process.env.NODE_ENV !== 'production') {
  cache.db = db;
}
`;

/**
 * Tests de bout en bout en `*.e2e.ts` : Vitest ramasse tout `*.test.*` et
 * `*.spec.*`, et exécuterait un spec Playwright sans navigateur. Un suffixe à
 * part sépare les deux sans configuration croisée.
 *
 * Le serveur testé est l'application construite (`build` puis `start`), pas le
 * serveur de développement : c'est elle qui part en production.
 */
const PLAYWRIGHT_CONFIG_NEXT = `import { defineConfig, devices } from '@playwright/test';

const port = 3000;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  forbidOnly: process.env.CI !== undefined,
  use: { baseURL: \`http://localhost:\${port}\` },
  webServer: {
    command: 'pnpm build && pnpm start',
    url: \`http://localhost:\${port}\`,
    reuseExistingServer: process.env.CI === undefined,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
`;

const PLAYWRIGHT_HOME_TEST = `import { expect, test } from '@playwright/test';

test('la page d’accueil répond et affiche son titre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
`;

/**
 * Tables de Better Auth, telles que les produit son CLI officiel (1.7.6,
 * `auth generate`) — reprises sans retouche, sauf le générateur et la source
 * de données, que le schéma en dossier déclare déjà une fois.
 */
const BETTER_AUTH_PRISMA_MODELS = `// Tables de Better Auth. Produites par son CLI ; pour les régénérer après
// l'ajout d'un plugin : npx auth generate, puis pnpm db:migrate.

model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]

  @@unique([email])
  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([token])
  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
  @@map("verification")
}
`;

const BETTER_AUTH_SERVER = `import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from './db';

/**
 * Authentification : email et mot de passe, sessions en base.
 *
 * BETTER_AUTH_SECRET et BETTER_AUTH_URL viennent de l'environnement (voir
 * .env.example). Les tables sont déclarées dans prisma/schema/auth.prisma.
 */
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
});
`;

const BETTER_AUTH_CLIENT = `import { createAuthClient } from 'better-auth/react';

/** Côté navigateur : signIn, signUp, signOut, useSession… */
export const authClient = createAuthClient();
`;

const BETTER_AUTH_NEXT_ROUTE = `import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

/** Toutes les routes de Better Auth : /api/auth/sign-in/email, /api/auth/session… */
export const { GET, POST } = toNextJsHandler(auth);
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
    // Better Auth câblé de bout en bout : tables Prisma, adaptateur, route
    // Next.js. Chacun des trois dépend d'un autre choix — d'où une combinaison
    // entière, la seule que le test de fumée vérifie (jusqu'à une inscription
    // réelle en base). Email et mot de passe : la méthode qui ne demande
    // aucun compte tiers.
    id: 'better-auth',
    when: ['next', 'prisma', 'postgresql'],
    files: [
      { path: 'prisma/schema/auth.prisma', contents: BETTER_AUTH_PRISMA_MODELS },
      { path: 'lib/auth.ts', contents: BETTER_AUTH_SERVER },
      { path: 'lib/auth-client.ts', contents: BETTER_AUTH_CLIENT },
      { path: 'app/api/auth/[...all]/route.ts', contents: BETTER_AUTH_NEXT_ROUTE },
    ],
  },
  {
    // Playwright contre une application Next.js : l'URL et la commande de
    // démarrage dépendent du framework, d'où une combinaison.
    id: 'playwright',
    when: 'next',
    // playwright.config.ts lit process.env.CI.
    devDependencies: { '@types/node': '^24.0.0' },
    files: [
      { path: 'playwright.config.ts', contents: PLAYWRIGHT_CONFIG_NEXT },
      { path: 'e2e/home.e2e.ts', contents: PLAYWRIGHT_HOME_TEST },
    ],
  },
  {
    id: 'next',
    appScripts: { dev: 'next dev', build: 'next build', start: 'next start' },
  },
  {
    id: 'prisma',
    // Prisma 7 : prisma et @prisma/engines (constaté par le test de fumée).
    // @prisma/client en avait besoin jusqu'à Prisma 6 ; gardé tant que des
    // projets générés avant la restriction de plage existent.
    allowBuilds: ['@prisma/client', '@prisma/engines', 'prisma'],
  },
  {
    // Prisma câblé sur PostgreSQL : la seule combinaison vérifiée par le test
    // de fumée (installation, génération du client, typecheck, build, et
    // aller-retour avec une vraie base quand Docker est disponible).
    id: 'prisma',
    when: 'postgresql',
    scripts: {
      // Le client Prisma 7 est engendré dans le projet (generated/), pas dans
      // node_modules : sans ce postinstall, rien ne se type après installation.
      postinstall: 'prisma generate',
      'db:generate': 'prisma generate',
      'db:migrate': 'prisma migrate dev',
      'db:push': 'prisma db push',
    },
    dependencies: { '@prisma/adapter-pg': '>=7.0.0 <8.0.0' },
    // lib/db.ts lit process.env.
    devDependencies: { '@types/node': '^24.0.0' },
    files: [
      { path: 'prisma.config.ts', contents: PRISMA_CONFIG },
      { path: 'prisma/schema/schema.prisma', contents: PRISMA_SCHEMA_POSTGRESQL },
      { path: 'lib/db.ts', contents: PRISMA_CLIENT_POSTGRESQL },
    ],
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
      connection: { env: 'DATABASE_URL', url: 'postgresql://postgres:postgres@localhost:5432/app' },
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

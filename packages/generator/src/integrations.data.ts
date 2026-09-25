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

export interface Integration {
  /** Identifiant d'une fiche du registry. */
  readonly id: string;
  /** Scripts npm à ajouter au package.json généré. */
  readonly scripts?: Readonly<Record<string, string>>;
  /** Service local à ajouter à docker-compose.yml. */
  readonly docker?: DockerService;
}

export const INTEGRATIONS: readonly Integration[] = [
  {
    id: 'typescript',
    scripts: { typecheck: 'tsc --noEmit' },
  },
  {
    id: 'biome',
    scripts: { lint: 'biome check .', 'lint:fix': 'biome check --write .' },
  },
  {
    id: 'vitest',
    scripts: { test: 'vitest run' },
  },
  {
    id: 'playwright',
    scripts: { 'test:e2e': 'playwright test' },
  },
  {
    id: 'next',
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
  },
  {
    id: 'prisma',
    scripts: { 'db:generate': 'prisma generate', 'db:migrate': 'prisma migrate dev' },
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
    scripts: { test: 'jest' },
  },
  {
    id: 'cypress',
    scripts: { 'test:e2e': 'cypress run' },
  },
  {
    id: 'vite',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
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

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

export interface Integration {
  /** Identifiant d'une fiche du registry. */
  readonly id: string;
  /** Scripts npm à ajouter au package.json généré. */
  readonly scripts?: Readonly<Record<string, string>>;
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
];

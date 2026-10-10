import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * `server-only` n'a que deux entrées : `index.js`, qui lève, sous la condition
 * par défaut ; `empty.js`, vide, sous la condition `react-server`. Next monte
 * la couche serveur avec `react-server`, donc `import 'server-only'` y passe.
 * Vitest, lui, résout en conditions Node : sans rien, tout test qui charge
 * l'adaptateur du moteur lèverait « This module cannot be imported from a
 * Client Component module ».
 *
 * La condition ne peut pas être posée globalement : `ssr.resolve.conditions:
 * ['react-server']` fait aussi résoudre `react-dom/server` vers sa variante
 * RSC, qui refuse de s'exécuter dans un test (`react-dom/server is not
 * supported in React Server Components`) — deux tests existants tombent.
 * L'alias, lui, ne vise qu'un paquet, et pointe sur le fichier que le paquet
 * livre pour cette condition : rien n'est simulé, et si `server-only` change
 * de forme, l'import échoue bruyamment au lieu de passer en silence.
 */
const serverOnly = createRequire(import.meta.url).resolve('server-only');

export default defineConfig({
  // Le tsconfig impose `jsx: preserve` pour Next ; en dehors de Next, Vitest
  // doit transformer lui-même le JSX, on force donc le runtime automatique de
  // React (Vitest initialise déjà `oxc`, l'option `esbuild` serait ignorée).
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { 'server-only': join(dirname(serverOnly), 'empty.js') } },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});

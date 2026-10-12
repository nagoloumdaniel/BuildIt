import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

/**
 * `next/font/google` n'existe qu'à la compilation : Next le remplace par un
 * chargeur de police, et le fichier d'origine lève hors de Next. L'alias pointe
 * donc sur le double de `src/test-support`, qui reproduit le seul contrat
 * utilisé par `layout.tsx`. Sans lui, tout test montant le layout échouait à
 * l'import — c'est un défaut d'outillage, pas un défaut d'écran.
 */
const here = dirname(fileURLToPath(import.meta.url));
const nextFontGoogle = join(here, 'src/test-support/next-font-google.ts');

export default defineConfig({
  // Le tsconfig impose `jsx: preserve` pour Next ; en dehors de Next, Vitest
  // doit transformer lui-même le JSX, on force donc le runtime automatique de
  // React (Vitest initialise déjà `oxc`, l'option `esbuild` serait ignorée).
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      'server-only': join(dirname(serverOnly), 'empty.js'),
      'next/font/google': nextFontGoogle,
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    /**
     * Les tests de l'écran de génération écrivent un vrai projet sur le disque :
     * sous `turbo run test` (13 paquets en parallèle), le délai par défaut de
     * 5 s a été dépassé deux fois de façon reproductible — et passé à chaque
     * fois en isolation. Un test qui échoue selon la charge ne prouve rien :
     * le délai est donc porté à 30 s, ce qui reste un plafond, pas une attente.
     * Trouvé pendant la vérification finale de la Phase 10.
     */
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      /**
       * La portée mesurée est `src/lib` — l'état d'UI pur (brouillon, parcours,
       * thème, codec de partage). Elle est **étroite exprès** : le seuil de 90 %
       * y est tenu, alors que sur tout `src` (les 18 écrans et les Server
       * Actions, ~9 000 lignes) la même mesure donne 68 %.
       *
       * Élargir `include` sans élargir les tests ferait échouer la suite sur un
       * chiffre, pas sur un défaut : la preuve des écrans est ailleurs — tests
       * de composant, tests de Server Action, et `pnpm test:e2e` qui pilote le
       * parcours dans un vrai navigateur. Trouvé en revue (MAJOR-3) : le
       * roadmap annonçait « apps/web 98,7 % » sans dire la portée ; c'est
       * désormais écrit ici et là-bas.
       */
      include: ['src/lib/**/*.ts'],
      /**
       * Ce qui est mesuré est l'**état d'UI pur** : brouillon, parcours, thème,
       * liens, quantités. En sont exclus deux ensembles, pour deux raisons
       * différentes :
       *
       * - `i18n/messages*.ts` : des **données**, pas de la logique. Leur parité
       *   français / anglais est tenue par le typecheck (`Widen<typeof FR>` rend
       *   une clé manquante en erreur de compilation) et prouvée par
       *   `src/lib/i18n/messages.test.ts`. Les compter comme du code non couvert
       *   faisait échouer la suite sur un chiffre, pas sur un défaut — trouvé en
       *   vérification finale de la refonte UI/UX.
       * - `i18n/provider.tsx` : de la glue React (un contexte, deux hooks). Ses
       *   deux règles sont prouvées par les écrans eux-mêmes, qui le montent
       *   réellement, et par `messages.test.ts` pour le défaut hors fournisseur.
       */
      exclude: ['src/lib/i18n/messages*.ts', 'src/lib/i18n/provider.tsx'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});

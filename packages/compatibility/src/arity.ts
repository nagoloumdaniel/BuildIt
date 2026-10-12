import type { Category } from '@buildit/registry';

/**
 * Arité des catégories : combien de technologies peuvent coexister.
 *
 * L'hypothèse de départ — « une seule technologie par catégorie, donc deux
 * fiches de la même catégorie s'excluent » — est **fausse**. `vitest`,
 * `playwright` et `testing-library` sont toutes trois dans `testing` et
 * cohabitent parfaitement ; la déduire de la catégorie seule aurait rendu le
 * preset SaaS ingénérable.
 *
 * L'arité vit ici, dans le moteur, et non sur chaque fiche : c'est une
 * propriété invariante de la catégorie. La répéter sur 282 fiches serait 282
 * occasions de se tromper.
 */

/**
 * Un seul choix a du sens : un projet a un framework web, un backend, une base,
 * un ORM, un fournisseur d'authentification, un formateur. Le manifest n'a
 * qu'un emplacement pour chacun, et le générateur n'en câble qu'un.
 */
export const EXCLUSIVE_CATEGORIES: readonly Category[] = [
  'frontend',
  'backend',
  'database',
  'orm',
  'authentication',
  'formatting',
];

/**
 * Plusieurs choix coexistent réellement, et c'est l'audit de compatibilité qui
 * a déplacé la plupart de ces catégories ici. La règle « une seule fiche par
 * catégorie » refusait des combinaisons parfaitement standard :
 *
 * - `language` : TypeScript au front, Python à l'API ;
 * - `styling` : Tailwind **et** PostCSS, Sass **et** CSS Modules ;
 * - `ui` : shadcn/ui est construit sur Radix ; daisyUI s'ajoute à Headless UI ;
 * - `linting` : ESLint pour le code **et** Stylelint pour le CSS ;
 * - `containers` : Docker, Kubernetes et Helm vont ensemble ;
 * - `package-manager` : pnpm **et** Changesets (outil de publication) ;
 * - `hosting`, `payments`, `email`, `ci-cd`… : une API sur Fly.io et un web
 *   sur Vercel, Stripe et PayPal au même paiement.
 *
 * Les vraies impossibilités ne disparaissent pas pour autant : elles sont
 * dites **là où elles existent**, pas déduites d'une catégorie entière —
 * conflits déclarés par les fiches (`npm` contre `pnpm`, Turborepo contre Nx,
 * Tailwind contre UnoCSS) et écosystèmes incompatibles (`checkEcosystems` :
 * Vuetify dans un projet React, Prisma derrière un backend Django).
 */
export const CUMULATIVE_CATEGORIES: readonly Category[] = [
  'language',
  'styling',
  'ui',
  'build',
  'package-manager',
  'monorepo',
  'linting',
  'containers',
  'ci-cd',
  'hosting',
  'email',
  'payments',
  'cms',
  'ecommerce',
  'authorization',
  'state',
  'data-fetching',
  'forms',
  'validation',
  'api',
  'testing',
  'git-hooks',
  // Un devcontainer s'ajoute à Docker, il ne le remplace pas.
  'dev-environment',
  'storage',
  'cache',
  'queue',
  'search',
  'observability',
  'analytics',
  'security',
  'ai',
];

const EXCLUSIVE = new Set<string>(EXCLUSIVE_CATEGORIES);

/** Deux technologies de cette catégorie sont-elles en conflit du seul fait de leur catégorie ? */
export function isExclusive(category: Category): boolean {
  return EXCLUSIVE.has(category);
}

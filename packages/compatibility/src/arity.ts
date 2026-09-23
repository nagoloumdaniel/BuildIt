import type { Category } from '@project-factory/registry';

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

/** Un seul choix a du sens : on ne prend pas deux ORM ni deux frameworks front. */
export const EXCLUSIVE_CATEGORIES: readonly Category[] = [
  'frontend',
  'language',
  'styling',
  'ui',
  'backend',
  'database',
  'orm',
  'authentication',
  'build',
  'package-manager',
  'monorepo',
  'linting',
  'formatting',
  'containers',
  'ci-cd',
  'hosting',
  'email',
  'payments',
  'cms',
  'ecommerce',
];

/** Plusieurs choix coexistent : on teste avec Vitest *et* Playwright. */
export const CUMULATIVE_CATEGORIES: readonly Category[] = [
  'authorization',
  'state',
  'data-fetching',
  'forms',
  'validation',
  'api',
  'testing',
  'git-hooks',
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

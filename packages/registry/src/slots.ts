/**
 * La règle unique « catégorie du catalogue → emplacement dans le manifest ».
 *
 * Elle vivait en deux copies — `PLACES` dans `apps/cli/src/commands/add.ts` et
 * `SLOTS` dans `apps/web/src/lib/draft-to-manifest.ts` — tenues ensemble par un
 * test d'égalité octet pour octet. Deux copies qui doivent dire la même chose
 * finissent toujours par diverger : la règle est donc ici, une fois (§10).
 *
 * Ce module ne place rien : il dit **où** une catégorie s'exprime dans le
 * manifest, jamais **ce qui** existe. L'identité d'une fiche reste l'affaire du
 * catalogue, la forme reste l'affaire de `manifest`, la combinaison reste
 * l'affaire du compatibility engine.
 *
 * La table est complète : `Record<Category, Slot>` fait échouer la compilation
 * dès qu'une catégorie est ajoutée au catalogue, et force à décider de sa place
 * — c'est une décision de produit, pas un détail d'implémentation.
 */
import type { Category } from './schema/entry.js';

/** Les champs d'une application du manifest (§10). */
export type AppField = 'framework' | 'language' | 'styling' | 'ui';

/**
 * Un emplacement du manifest, par **rôle** et non par catégorie : plusieurs
 * catégories désignent le même rôle (un `language` vaut pour toutes les
 * applications, une `database` n'en a qu'une).
 *
 * - `app` : le champ d'une application, au framework près ;
 * - `single` : une valeur unique du manifest (`database.engine`, `database.orm`,
 *   `auth.provider`) ;
 * - `list` : un ensemble du manifest (`services`, `quality`, `infra`).
 */
export type Slot =
  | { readonly kind: 'app'; readonly field: AppField }
  | { readonly kind: 'single'; readonly field: 'engine' | 'orm' | 'provider' }
  | { readonly kind: 'list'; readonly field: 'services' | 'quality' | 'infra' };

/**
 * Où va chaque catégorie du catalogue.
 *
 * Les catégories sans emplacement de premier rang tombent dans `services` :
 * ce sont les capacités du §6.7, et le manifest n'a pas de champ par famille —
 * c'est heureux, une catégorie nouvelle n'oblige à migrer aucun manifest.
 */
export const SLOTS: Readonly<Record<Category, Slot>> = {
  // Un rôle par application : le framework va à l'application que la fiche sert.
  frontend: { kind: 'app', field: 'framework' },
  backend: { kind: 'app', field: 'framework' },
  language: { kind: 'app', field: 'language' },
  styling: { kind: 'app', field: 'styling' },
  ui: { kind: 'app', field: 'ui' },

  // Une seule valeur possible dans le manifest.
  database: { kind: 'single', field: 'engine' },
  orm: { kind: 'single', field: 'orm' },
  authentication: { kind: 'single', field: 'provider' },

  // Le socle de qualité du projet : c'est ce que les presets posent.
  testing: { kind: 'list', field: 'quality' },
  linting: { kind: 'list', field: 'quality' },
  formatting: { kind: 'list', field: 'quality' },
  'git-hooks': { kind: 'list', field: 'quality' },

  // Ce qui fait tourner et livrer le projet.
  containers: { kind: 'list', field: 'infra' },
  'ci-cd': { kind: 'list', field: 'infra' },
  hosting: { kind: 'list', field: 'infra' },
  monorepo: { kind: 'list', field: 'infra' },
  'package-manager': { kind: 'list', field: 'infra' },
  'dev-environment': { kind: 'list', field: 'infra' },

  // Les capacités (§6.7) : le manifest n'a pas de champ par famille.
  authorization: { kind: 'list', field: 'services' },
  state: { kind: 'list', field: 'services' },
  'data-fetching': { kind: 'list', field: 'services' },
  forms: { kind: 'list', field: 'services' },
  validation: { kind: 'list', field: 'services' },
  api: { kind: 'list', field: 'services' },
  build: { kind: 'list', field: 'services' },
  storage: { kind: 'list', field: 'services' },
  cache: { kind: 'list', field: 'services' },
  queue: { kind: 'list', field: 'services' },
  search: { kind: 'list', field: 'services' },
  email: { kind: 'list', field: 'services' },
  payments: { kind: 'list', field: 'services' },
  observability: { kind: 'list', field: 'services' },
  analytics: { kind: 'list', field: 'services' },
  security: { kind: 'list', field: 'services' },
  ai: { kind: 'list', field: 'services' },
  cms: { kind: 'list', field: 'services' },
  ecommerce: { kind: 'list', field: 'services' },
};

/**
 * L'emplacement d'une catégorie. Toujours défini : la table est complète, et
 * une catégorie que le catalogue ne publie pas encore (une fiche future) tombe
 * dans `services`, comme le faisait `pf add` avant ce module.
 */
export function slotFor(category: Category): Slot {
  return SLOTS[category];
}

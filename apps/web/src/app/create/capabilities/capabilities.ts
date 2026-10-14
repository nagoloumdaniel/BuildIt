import type { Category } from '@buildit/registry';
import type { DraftState } from '../../../lib/draft';
import { FR_WIZARD } from '../../../lib/i18n/messages.wizard';
import { toggleExclusive } from '../../../lib/session';

/**
 * L'écran Capabilities (§6.7) « ce que le projet sait faire ».
 *
 * Ce fichier ne contient **aucune** liste de technologies (§11) : il dit
 * seulement quelles **catégories** du catalogue sont des capacités, et l'écran
 * demande ensuite les options au moteur, catégorie par catégorie. La frontière
 * est la même que celle de `SLOTS` dans `lib/draft-to-manifest.ts` : les
 * catégories que le manifest range dans `services` sont celles d'ici. Un choix
 * de capacité ne crée donc aucun champ au manifest, il rejoint `services`.
 *
 * La table `SCREEN_ROLE` est **complète** : ajouter une catégorie au registry
 * casse la compilation ici, et force à décider de son écran. C'est une décision
 * de produit ; la laisser implicite ferait disparaître une catégorie de tous
 * les écrans à la fois.
 */

/** L'écran du parcours où une catégorie se configure. */
export type ScreenRole = 'stack' | 'capabilities' | 'infrastructure';

export const SCREEN_ROLE: Readonly<Record<Category, ScreenRole>> = {
  // Écran 6 Stack Builder : la pile technique et le socle de qualité.
  frontend: 'stack',
  language: 'stack',
  styling: 'stack',
  ui: 'stack',
  backend: 'stack',
  database: 'stack',
  orm: 'stack',
  authentication: 'stack',
  testing: 'stack',
  linting: 'stack',
  formatting: 'stack',
  'git-hooks': 'stack',

  // Écran 9 Infrastructure : ce qui fait tourner et livrer le projet.
  'package-manager': 'infrastructure',
  monorepo: 'infrastructure',
  containers: 'infrastructure',
  'dev-environment': 'infrastructure',
  'ci-cd': 'infrastructure',
  hosting: 'infrastructure',

  // Écran 7 Capabilities : le reste, c'est-à-dire les capacités du §6.7.
  authorization: 'capabilities',
  state: 'capabilities',
  'data-fetching': 'capabilities',
  forms: 'capabilities',
  validation: 'capabilities',
  api: 'capabilities',
  build: 'capabilities',
  storage: 'capabilities',
  cache: 'capabilities',
  queue: 'capabilities',
  search: 'capabilities',
  email: 'capabilities',
  payments: 'capabilities',
  observability: 'capabilities',
  analytics: 'capabilities',
  security: 'capabilities',
  ai: 'capabilities',
  cms: 'capabilities',
  ecommerce: 'capabilities',
};

/**
 * Les familles de l'écran, dans l'ordre d'affichage.
 *
 * La **liste et l'ordre viennent du dictionnaire** (`wizard.capabilities.
 * families`) : une famille ajoutée là a son libellé en français **et** en
 * anglais par construction, et le test de type de `Messages` refuse la langue
 * incomplète. Les identifiants, eux, viennent du catalogue : ils ne sont pas
 * préfixés, pas traduits, et un renommage au registry les casse visiblement —
 * `satisfies Partial<Record<Category, …>>` au dictionnaire le garantit.
 */
export type CapabilityCategory = keyof (typeof FR_WIZARD)['wizard']['capabilities']['families'];

export const CAPABILITY_FAMILIES = Object.keys(
  FR_WIZARD.wizard.capabilities.families,
) as readonly CapabilityCategory[];

/** La famille ouverte au premier rendu, avant tout clic : la première de la liste. */
export const DEFAULT_CAPABILITY_CATEGORY: CapabilityCategory = 'authorization';

export const CAPABILITY_CATEGORIES: readonly CapabilityCategory[] = CAPABILITY_FAMILIES;

/** Ce que le moteur attend pour vérifier une sélection. */
export interface EngineSelection {
  readonly targets: readonly string[];
  readonly technologies: readonly string[];
}

/**
 * La sélection envoyée au moteur : technologies **et** capacités.
 *
 * Les deux écrans écrivent dans deux listes du brouillon, mais le moteur ne
 * connaît qu'une sélection de technologies c'est déjà la règle de
 * `chosenIds` dans `lib/draft-to-manifest.ts`. L'union est triée pour que deux
 * ordres de clics donnent la même vérification.
 */
export function engineSelection(draft: DraftState): EngineSelection {
  return {
    targets: [...draft.targets],
    technologies: [...new Set([...draft.technologies, ...draft.capabilities])].sort(),
  };
}

/**
 * Ajoute, retire ou remplace une capacité, sans muter le brouillon reçu.
 *
 * `email`, `payments`, `cms`, `ecommerce` et `build` sont des catégories
 * exclusives (§12) au même titre que `language` ou `orm` au Stack Builder :
 * choisir un second moyen de paiement sans retirer le premier produisait
 * une sélection que le moteur refusait au Blueprint, pas ici (même bug que
 * `toggleExclusive`, cf. `lib/session.ts`).
 *
 * `categoryOf` vient des options déjà chargées pour la famille affichée les
 * seules dont le retrait silencieux a un sens : une capacité d'une autre
 * famille, non chargée ici, n'est jamais retirée par erreur.
 */
export function toggleCapability(
  draft: DraftState,
  id: string,
  category: Category,
  categoryOf: ReadonlyMap<string, Category>,
): DraftState {
  return { ...draft, capabilities: toggleExclusive(draft.capabilities, id, category, categoryOf) };
}

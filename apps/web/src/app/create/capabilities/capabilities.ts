import type { Category } from '@buildit/registry';
import type { DraftState } from '../../../lib/draft';
import { FR_WIZARD } from '../../../lib/i18n/messages.wizard';
import { type EngineSelection, selectionOf } from '../../../lib/selection';
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

/**
 * Les catégories qu'un écran configure, dans l'ordre de la table.
 *
 * Dérivée de `SCREEN_ROLE`, jamais recopiée : c'est ce qui permet à l'écran
 * Infrastructure de demander **ses six** catégories d'un coup sans qu'une
 * septième, ajoutée au registry, soit oubliée quelque part. L'ordre est celui
 * de la déclaration de la table, donc stable d'un rendu à l'autre.
 */
export function categoriesWithRole(role: ScreenRole): readonly Category[] {
  return (Object.keys(SCREEN_ROLE) as Category[]).filter(
    (category) => SCREEN_ROLE[category] === role,
  );
}

export type { EngineSelection };

/**
 * La sélection envoyée au moteur : voir `lib/selection.ts`.
 *
 * Elle porte les technologies, les capacités **et** les choix d'infrastructure
 * (Docker, CI) : un refus causé par l'un des trois doit être dit tôt, et les
 * options proposées à un écran doivent refléter les choix des autres.
 */
export function engineSelection(draft: DraftState): EngineSelection {
  return selectionOf(draft);
}

/**
 * Ajoute, retire ou remplace une capacité, sans muter le brouillon reçu.
 *
 * Les catégories de cet écran sont **cumulatives** (`arity.ts`) : deux moyens
 * de paiement, deux CMS, deux outils de validation cohabitent, et
 * `toggleExclusive` n'a donc rien à remplacer. Le commentaire d'avant parlait
 * d'exclusivité pour `email`, `payments`, `cms`, `ecommerce` ou `build` — une
 * règle qui n'existe plus : les recopier ici invitait à « corriger » la bascule
 * dans le mauvais sens.
 *
 * `categoryOf` et `targetsOf` viennent des options déjà chargées pour la famille
 * affichée : les seules dont le retrait silencieux aurait un sens. Une capacité
 * d'une autre famille, non chargée ici, n'est jamais retirée par erreur.
 */
export function toggleCapability(
  draft: DraftState,
  id: string,
  category: Category,
  categoryOf: ReadonlyMap<string, Category>,
  targetsOf?: ReadonlyMap<string, readonly string[]>,
): DraftState {
  return {
    ...draft,
    capabilities: toggleExclusive(draft.capabilities, id, category, categoryOf, targetsOf),
  };
}

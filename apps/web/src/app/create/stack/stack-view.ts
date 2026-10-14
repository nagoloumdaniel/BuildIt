import type { Category } from '@buildit/registry';
import type { Messages } from '../../../lib/i18n/messages';

/**
 * La logique du Stack Builder (§5, §6.6), hors JSX.
 *
 * Tout ce qui décide ordre de recommandation, budget « 2 à 4 », sort des
 * options bloquées, recherche, filtre de compatibilité vit ici et se teste
 * sans DOM. Le composant ne fait que rendre ces décisions : une règle du §5
 * écrite dans le JSX serait invérifiable, et le prochain écran la recopierait.
 *
 * Deux invariants portés par ce module :
 *
 * 1. **Une option bloquée n'est jamais silencieuse.** Le mode guidé cache la
 *    longue traîne des options compatibles, jamais les incompatibles : elles
 *    restent visibles, grisées, avec leur raison (`optionReason`).
 * 2. **Un choix déjà fait reste visible.** Le budget de recommandation
 *    s'applique aux options proposées, pas aux options sélectionnées masquer
 *    celles-ci empêcherait de les retirer.
 */

/** L'état d'une option, tel que le moteur le rend (`OptionView.state`). */
export type OptionState = 'selected' | 'available' | 'blocked';

/**
 * Une option telle que l'écran la consomme.
 *
 * Forme volontairement structurelle : elle reste compatible avec l'`OptionView`
 * de l'adaptateur sans lier ce module à `lib/engine` (qui est `server-only`).
 */
export interface StackOption {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly state: OptionState;
  /** La raison d'un blocage toujours présente côté moteur pour un `blocked`. */
  readonly reason?: string;
  /** La documentation officielle de la technologie. */
  readonly docs?: string;
  /** Le code du refus : il choisit la conséquence et la solution à afficher. */
  readonly code?: string;
  /** Les technologies en cause dans le refus, avec leur documentation. */
  readonly conflicts?: readonly {
    readonly id: string;
    readonly label: string;
    readonly docs?: string;
  }[];
}

/** Une catégorie du catalogue et ses fiches, dans l'ordre du registry. */
export interface CategoryBlock {
  readonly category: Category;
  readonly options: readonly StackOption[];
}

/** Le plafond du §5 : jamais plus de quatre propositions à la fois. */
export const GUIDED_MAX = 4;

/**
 * La raison affichée sous une option, ou `undefined` si elle est utilisable.
 *
 * Un blocage sans raison reste un blocage : l'écran ne montre jamais un bouton
 * grisé muet (§5, §12 un refus dit pourquoi). `fallback` vient du dictionnaire
 * de la langue courante : ce module ne connaît aucune phrase.
 */
export function optionReason(option: StackOption, fallback: string): string | undefined {
  if (option.state !== 'blocked') {
    return undefined;
  }
  const reason = option.reason?.trim();
  return reason === undefined || reason === '' ? fallback : reason;
}

/**
 * Le libellé d'une catégorie du §7, dans la langue courante.
 *
 * La table vit au dictionnaire (`wizard.stack.categories`) et couvre les 37
 * catégories du registry : `satisfies Record<Category, string>` y fait du
 * libellé manquant une erreur de compilation même garde-fou que les cibles
 * du §4.
 */
export function categoryLabel(t: Messages, category: Category): string {
  return t.wizard.stack.categories[category];
}

/** Minuscules, sans accents, sans espaces autour : la forme de comparaison. */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Une option correspond-elle à la recherche ? Une recherche vide ne filtre rien. */
export function matchesQuery(option: StackOption, query: string): boolean {
  const needle = normalizeText(query);
  if (needle === '') {
    return true;
  }
  return normalizeText(option.label).includes(needle) || normalizeText(option.id).includes(needle);
}

export interface GuidedView {
  /** Les propositions du §5 : les choix faits, puis les disponibles. */
  readonly recommended: readonly StackOption[];
  /** Toutes les incompatibles, grisées avec leur raison jamais masquées. */
  readonly blocked: readonly StackOption[];
  /** La longue traîne compatible, derrière « Voir toutes les options ». */
  readonly hidden: readonly StackOption[];
}

/**
 * Le découpage du mode guidé (§5) : 2 à 4 recommandations, le reste accessible.
 *
 * L'ordre source est celui du registry, qui va du plus courant au plus
 * pointu ; on le préserve au lieu de réinventer un classement. Les choix déjà
 * faits passent devant, parce que c'est ce qu'on vient vérifier ou défaire.
 */
export function guidedView(options: readonly StackOption[]): GuidedView {
  const chosen = options.filter((option) => option.state === 'selected');
  const available = options.filter((option) => option.state === 'available');
  const blocked = options.filter((option) => option.state === 'blocked');

  // Les choix faits ne consomment pas le budget : ils sont toujours affichés.
  const budget = Math.max(0, GUIDED_MAX - chosen.length);
  const recommended = [...chosen, ...available.slice(0, budget)];
  const shown = new Set(recommended.map((option) => option.id));

  return {
    recommended,
    blocked,
    hidden: available.filter((option) => !shown.has(option.id)),
  };
}

/** Les filtres du mode expert (§5) : recherche texte, compatibilité stricte. */
export interface OptionFilter {
  readonly query: string;
  readonly compatibleOnly: boolean;
}

export interface FilteredOptions {
  readonly shown: readonly StackOption[];
  /** Combien de bloquées le filtre « compatible seulement » a écartées. */
  readonly hiddenBlocked: number;
}

export function filterOptions(
  options: readonly StackOption[],
  filter: OptionFilter,
): FilteredOptions {
  const matched = options.filter((option) => matchesQuery(option, filter.query));
  if (!filter.compatibleOnly) {
    return { shown: matched, hiddenBlocked: 0 };
  }
  return {
    shown: matched.filter((option) => option.state !== 'blocked'),
    hiddenBlocked: matched.filter((option) => option.state === 'blocked').length,
  };
}

export interface FilteredCatalogue {
  /** Les catégories qui gardent au moins une option, dans l'ordre du registry. */
  readonly blocks: readonly CategoryBlock[];
  readonly hiddenBlocked: number;
}

/**
 * La recherche globale du §5 : un seul champ, toutes catégories.
 *
 * Une catégorie sans résultat disparaît c'est le sens d'une recherche mais
 * ce que le filtre de compatibilité écarte est **compté**, pour que rien ne
 * disparaisse en silence.
 */
export function filterCatalogue(
  blocks: readonly CategoryBlock[],
  filter: OptionFilter,
): FilteredCatalogue {
  const kept: CategoryBlock[] = [];
  let hiddenBlocked = 0;

  for (const block of blocks) {
    const filtered = filterOptions(block.options, filter);
    hiddenBlocked += filtered.hiddenBlocked;
    if (filtered.shown.length > 0) {
      kept.push({ category: block.category, options: filtered.shown });
    }
  }

  return { blocks: kept, hiddenBlocked };
}

export interface CategoryProgress {
  readonly selected: number;
  readonly total: number;
}

export function categoryProgress(options: readonly StackOption[]): CategoryProgress {
  return {
    selected: options.filter((option) => option.state === 'selected').length,
    total: options.length,
  };
}

/** Combien de technologies portent la sélection, toutes catégories confondues. */
export function selectedCount(blocks: readonly CategoryBlock[]): number {
  return blocks.reduce((total, block) => total + categoryProgress(block.options).selected, 0);
}

/**
 * La catégorie ouverte par défaut : celle où l'utilisateur a déjà choisi
 * quelque chose, sinon la première du catalogue.
 */
export function defaultCategory(blocks: readonly CategoryBlock[]): Category | undefined {
  const withSelection = blocks.find((block) =>
    block.options.some((option) => option.state === 'selected'),
  );
  return (withSelection ?? blocks[0])?.category;
}

/**
 * Les alternatives à proposer pour une option bloquée : les options **disponibles**
 * de la même famille (ni bloquées, ni déjà choisies : celles-là sont la cause), dans l'ordre du catalogue, sans l'option elle-même.
 *
 * Bornées à trois : la bulle de détails dit « voici par quoi remplacer », elle
 * ne recopie pas la grille qu'on a sous les yeux.
 */
export function compatibleAlternatives(
  options: readonly StackOption[],
  id: string,
  max = 3,
): readonly StackOption[] {
  return options.filter((option) => option.id !== id && option.state === 'available').slice(0, max);
}

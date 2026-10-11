import type { Category } from '@project-factory/registry';

/**
 * La logique du Stack Builder (§5, §6.6), hors JSX.
 *
 * Tout ce qui décide — ordre de recommandation, budget « 2 à 4 », sort des
 * options bloquées, recherche, filtre de compatibilité — vit ici et se teste
 * sans DOM. Le composant ne fait que rendre ces décisions : une règle du §5
 * écrite dans le JSX serait invérifiable, et le prochain écran la recopierait.
 *
 * Deux invariants portés par ce module :
 *
 * 1. **Une option bloquée n'est jamais silencieuse.** Le mode guidé cache la
 *    longue traîne des options compatibles, jamais les incompatibles : elles
 *    restent visibles, grisées, avec leur raison (`optionReason`).
 * 2. **Un choix déjà fait reste visible.** Le budget de recommandation
 *    s'applique aux options proposées, pas aux options sélectionnées — masquer
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
  /** La raison d'un blocage — toujours présente côté moteur pour un `blocked`. */
  readonly reason?: string;
}

/** Une catégorie du catalogue et ses fiches, dans l'ordre du registry. */
export interface CategoryBlock {
  readonly category: Category;
  readonly options: readonly StackOption[];
}

/** Le plafond du §5 : jamais plus de quatre propositions à la fois. */
export const GUIDED_MAX = 4;

/** Ce qu'on dit d'une option bloquée que le moteur n'a pas su expliquer. */
const FALLBACK_REASON = 'Incompatible avec la sélection en cours.';

/**
 * La raison affichée sous une option, ou `undefined` si elle est utilisable.
 *
 * Un blocage sans raison reste un blocage : l'écran ne montre jamais un bouton
 * grisé muet (§5, §12 — un refus dit pourquoi).
 */
export function optionReason(option: StackOption): string | undefined {
  if (option.state !== 'blocked') {
    return undefined;
  }
  const reason = option.reason?.trim();
  return reason === undefined || reason === '' ? FALLBACK_REASON : reason;
}

/**
 * Les libellés français des catégories du §7.
 *
 * Table **complète** : ajouter une catégorie au registry casse la compilation
 * ici, et force à écrire son libellé — même logique que les cibles du §4 dans
 * `target/page.tsx`.
 */
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  frontend: 'Frontend',
  language: 'Langage',
  styling: 'Styles',
  ui: 'Bibliothèque d’interface',
  backend: 'Backend',
  database: 'Base de données',
  orm: 'ORM / ODM',
  authentication: 'Authentification',
  authorization: 'Autorisation',
  state: 'État client',
  'data-fetching': 'Récupération de données',
  forms: 'Formulaires',
  validation: 'Validation',
  api: 'API',
  build: 'Outils de build',
  'package-manager': 'Gestionnaire de paquets',
  monorepo: 'Monorepo',
  testing: 'Tests',
  linting: 'Lint',
  formatting: 'Formatage',
  'git-hooks': 'Crochets Git',
  containers: 'Conteneurs',
  'dev-environment': 'Environnement de développement',
  'ci-cd': 'CI/CD',
  hosting: 'Hébergement',
  storage: 'Stockage',
  cache: 'Cache',
  queue: 'File d’attente',
  search: 'Recherche',
  email: 'E-mail',
  payments: 'Paiements',
  observability: 'Observabilité',
  analytics: 'Analytique',
  security: 'Sécurité',
  ai: 'IA',
  cms: 'CMS',
  ecommerce: 'E-commerce',
};

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category];
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
  /** Toutes les incompatibles, grisées avec leur raison — jamais masquées. */
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
 * Une catégorie sans résultat disparaît — c'est le sens d'une recherche — mais
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

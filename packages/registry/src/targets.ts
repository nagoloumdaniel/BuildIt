/**
 * Couverture des cibles par le catalogue (§7.9, §7.10, §10).
 *
 * Le §10 décrit chaque cible par une **application** : `web` par `frontend`,
 * `mobile` par `mobile`, `desktop` par `desktop`, `api` par `backend` — et
 * chacune exige un `framework`. Une cible dont le catalogue n'offre aucun
 * framework produit donc un brouillon qui ne peut pas devenir un manifest
 * valide : c'est un cul-de-sac, et il ne se voit qu'à la fin du parcours.
 *
 * Ce module répond à la seule question qui le dise sans se tromper —
 * « qu'est-ce que le catalogue offre pour cette cible ? » — et ne recopie
 * jamais une liste de technologies (§11). Il ne dit pas **quelles** cibles
 * exigent une application : c'est la forme du §10, qui vit dans `manifest` et
 * dans l'assemblage du brouillon. Il dit ce que le catalogue contient.
 *
 * Le piège que ce module existe pour nommer : compter les fiches qui **citent**
 * une cible répond à côté. Des linters, des CI et des langages citent `mobile`
 * et `desktop` sans pouvoir en être le framework. Le compte qui décide est
 * celui des fiches dont la **catégorie** occupe le champ `framework` d'une
 * application — `frontend` et `backend`, d'après `SLOTS`.
 */
import { TARGETS, type Target } from '@project-factory/manifest';
import type { Category, RegistryEntry } from './schema/entry.js';
import { SLOTS } from './slots.js';

/**
 * Les catégories qui remplissent le champ `framework` d'une application (§10).
 *
 * Dérivée de `SLOTS`, jamais recopiée : une catégorie de framework ajoutée au
 * catalogue entre ici sans que ce fichier change, et une catégorie qui change
 * de rôle en sort.
 */
export const FRAMEWORK_CATEGORIES: readonly Category[] = (Object.keys(SLOTS) as Category[]).filter(
  (category) => {
    const slot = SLOTS[category];
    return slot.kind === 'app' && slot.field === 'framework';
  },
);

/** Ce que le catalogue offre pour une cible, en deux chiffres qui ne disent pas la même chose. */
export interface TargetCoverage {
  readonly target: Target;
  /** Fiches qui citent la cible, quel que soit leur rôle. */
  readonly entries: number;
  /** Fiches capables d'être le `framework` de l'application de cette cible. */
  readonly frameworks: number;
}

/** La couverture par cible, dans l'ordre de `TARGETS` — stable, donc comparable. */
export function targetCoverage(entries: Iterable<RegistryEntry>): readonly TargetCoverage[] {
  const all = [...entries];
  const frameworks = all.filter((entry) => FRAMEWORK_CATEGORIES.includes(entry.category));

  return TARGETS.map((target) => ({
    target,
    entries: all.filter((entry) => entry.targets.includes(target)).length,
    frameworks: frameworks.filter((entry) => entry.targets.includes(target)).length,
  }));
}

/**
 * Les cibles qu'aucun framework du catalogue ne peut honorer.
 *
 * C'est une réponse **par cible**, pas une liste d'interdits : le jour où une
 * fiche `expo` vise `mobile`, `mobile` sort de cette liste et l'écran qui s'y
 * réfère cesse de la retirer — sans qu'aucune liste à tenir à jour n'existe.
 *
 * Attention : une cible sans framework n'est pas forcément inutilisable. Le
 * §10 ne décrit pas `library` par une application, donc aucune n'y exige de
 * framework. Croiser cette réponse avec les applications du §10 est le travail
 * de l'appelant, qui seul connaît cette forme.
 */
export function targetsWithoutFramework(entries: Iterable<RegistryEntry>): readonly Target[] {
  return targetCoverage(entries)
    .filter((coverage) => coverage.frameworks === 0)
    .map((coverage) => coverage.target);
}

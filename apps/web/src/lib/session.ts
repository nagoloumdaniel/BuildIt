import { isExclusive } from '@buildit/compatibility';
import type { Category } from '@buildit/registry';
import {
  clearDraft,
  type DraftState,
  freshDraft,
  loadDraft,
  restorePersistedDraft,
  samePersistedDraft,
  saveDraft,
} from './draft';

/**
 * L'état du parcours, en mémoire pour l'écran et **persisté à chaque
 * changement** (§3 : « à tout moment, sauvegarde automatique du brouillon »).
 *
 * C'est un store pur, hors React : les écrans s'y abonnent par
 * `useSyncExternalStore`, les tests l'utilisent directement avec un `Storage`
 * en mémoire. Le changement est une **fonction** de l'état précédent, pas un
 * objet partiel : `{ ...state, ...patch }` rendrait les champs optionnels
 * incompatibles avec `exactOptionalPropertyTypes`, et un écran a parfois besoin
 * de l'état courant pour décider (ajouter ou retirer une valeur).
 */

/** Le changement demandé par un écran : l'état suivant, à partir du précédent. */
export type DraftChange = (draft: DraftState) => DraftState;

export interface SessionStore {
  /** L'état courant. La référence ne change qu'au changement réel. */
  get(): DraftState;
  update(change: DraftChange): DraftState;
  /** Repart d'un brouillon frais et l'oublie du navigateur. */
  reset(): DraftState;
  subscribe(listener: () => void): () => void;
  /**
   * Branche le stockage **après** l'hydratation, puis relit le brouillon.
   *
   * Le rendu serveur ne connaît pas `localStorage` : le premier rendu client
   * doit produire le même HTML que le serveur, sinon React signale une
   * divergence d'hydratation. Le provider branche donc le stockage dans un
   * effet, une fois l'hydratation terminée.
   *
   * Relire un brouillon **identique** à l'état courant n'est pas un
   * changement : `attach` ne notifie pas les abonnés dans ce cas, sans quoi
   * les écrans rejouent leurs effets pour la même valeur — c'est ce qui
   * chargeait le catalogue du Stack Builder deux fois par visite (§8bis).
   * Un brouillon relu différent, lui, est annoncé : c'est la reprise.
   */
  attach(storage: Storage | null): DraftState;
}

export function createSessionStore(storage: Storage | null, initial?: DraftState): SessionStore {
  let current = storage;
  // L'état de départ : c'est lui qui dit, au branchement du stockage, ce que
  // l'application a changé **en mémoire** entre-temps (`StepShell` écrit
  // l'étape de l'URL avant que le provider ne branche `localStorage`).
  const baseline = initial ?? loadDraft(current);
  let state = baseline;
  const listeners = new Set<() => void>();

  function commit(next: DraftState): DraftState {
    state = next;
    for (const listener of listeners) {
      listener();
    }
    return state;
  }

  return {
    get: () => state,
    update(change) {
      const next = change(state);
      saveDraft(current, next);
      return commit(next);
    },
    reset() {
      clearDraft(current);
      return commit(freshDraft());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach(nextStorage) {
      current = nextStorage;
      const restored = restorePersistedDraft(loadDraft(current), state, baseline);
      // Un brouillon relu identique n'est pas un changement : le notifier ferait
      // rejouer les effets des écrans pour les mêmes valeurs — c'est ce qui
      // chargeait le catalogue du Stack Builder deux fois par visite (§8bis).
      return samePersistedDraft(restored, state) ? state : commit(restored);
    },
  };
}

/** Ajoute ou retire une valeur d'une liste — le geste de presque tous les écrans. */
export function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/**
 * Choisir, retirer ou remplacer une technologie dans `current` (§12).
 *
 * Trois écrans (Stack Builder, Capabilities, Infrastructure) couvrent à eux
 * trois les 37 catégories du catalogue, chacun greffé sur le même geste :
 * cocher une option en attendant le prochain aller-retour serveur pour la
 * voir grisée si elle devient incompatible. Une catégorie **exclusive**
 * (`isExclusive`, §12 — un seul ORM, un seul moyen de paiement…) n'admet
 * qu'un choix ; en ajouter un second sans retirer le premier produit une
 * sélection que le moteur refuse, mais seulement au Blueprint, des écrans
 * plus loin, sans lien visible avec le clic qui l'a causée (bug rapporté :
 * JavaScript et TypeScript choisis tous les deux).
 *
 * Le remplacement se décide ici, dans `current` et `category` seuls : aucun
 * aller-retour serveur, donc aucune fenêtre où un second clic rapproché
 * passerait avant que l'option visée n'ait eu le temps d'être grisée.
 *
 * `categoryOf` vient des options déjà chargées par l'écran — cette fonction
 * ne requiert pas le catalogue, seulement de savoir qui d'autre appartient à
 * la même catégorie que l'identifiant choisi.
 */
export function toggleExclusive(
  current: readonly string[],
  id: string,
  category: Category,
  categoryOf: ReadonlyMap<string, Category>,
): string[] {
  if (current.includes(id)) {
    return current.filter((existing) => existing !== id);
  }
  if (!isExclusive(category)) {
    return [...current, id];
  }
  const withoutSiblings = current.filter((existing) => categoryOf.get(existing) !== category);
  return [...withoutSiblings, id];
}

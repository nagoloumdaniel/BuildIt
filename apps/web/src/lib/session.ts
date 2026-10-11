import { clearDraft, type DraftState, freshDraft, loadDraft, saveDraft } from './draft';

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
   */
  attach(storage: Storage | null): DraftState;
}

export function createSessionStore(storage: Storage | null, initial?: DraftState): SessionStore {
  let current = storage;
  let state = initial ?? loadDraft(current);
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
      return commit(loadDraft(current));
    },
  };
}

/** Ajoute ou retire une valeur d'une liste — le geste de presque tous les écrans. */
export function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

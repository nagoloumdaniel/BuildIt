'use client';

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { DraftState } from '../../lib/draft';
import { createSessionStore, type SessionStore } from '../../lib/session';
import { browserStorage } from '../../lib/theme';

const StoreContext = createContext<SessionStore | null>(null);

/**
 * Le brouillon du parcours, partagé par tous les écrans (§3).
 *
 * Le premier rendu se fait **sans stockage** : le serveur ne connaît pas
 * `localStorage`, et le rendu client d'hydratation doit lui ressembler, sinon
 * React signale une divergence. Le stockage est branché dans un effet, une
 * fois l'hydratation terminée — et c'est là seulement que le brouillon repris
 * réapparaît.
 */
export function DraftProvider({ children }: { children: ReactNode }): ReactElement {
  const [store] = useState(() => createSessionStore(null));

  useEffect(() => {
    store.attach(browserStorage());
  }, [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** Le store, pour écrire : `update`, `reset`. */
export function useSession(): SessionStore {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error('useSession s’utilise sous <DraftProvider>.');
  }
  return store;
}

/** Le brouillon courant, re-rendu à chaque changement. */
export function useDraft(): DraftState {
  const store = useSession();
  // Le troisième argument est le snapshot **serveur** : React l'emploie pendant
  // l'hydratation. Passer `store.get` — l'état courant, déjà enrichi par
  // `attach` — faisait rendre au client une sélection absente du HTML, et React
  // signalait une divergence d'hydratation.
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

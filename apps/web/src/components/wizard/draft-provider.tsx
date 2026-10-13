'use client';

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import type { DraftState } from '../../lib/draft';
import { createSessionStore, type SessionStore } from '../../lib/session';
import { browserStorage } from '../../lib/theme';

const StoreContext = createContext<SessionStore | null>(null);

/**
 * `useLayoutEffect` au navigateur, `useEffect` au serveur (qui n'exécute ni
 * l'un ni l'autre, mais React avertit sur le premier).
 */
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Le brouillon du parcours, partagé par tous les écrans (§3).
 *
 * Le premier rendu se fait **sans stockage** : le serveur ne connaît pas
 * `localStorage`, et le rendu client d'hydratation doit lui ressembler, sinon
 * React signale une divergence. Le stockage est branché dans un effet, une
 * fois l'hydratation terminée — et c'est là seulement que le brouillon repris
 * réapparaît.
 *
 * Ce branchement est un effet **de mise en page** : React exécute tous les
 * effets de mise en page avant le moindre effet passif. Le brouillon relu est
 * donc en place avant qu'un écran n'écrive quoi que ce soit (étape courante,
 * architecture par défaut…) et avant que la page ne se peigne : un
 * rechargement ne perd rien, et ne montre pas un instant l'écran vide.
 */
export function DraftProvider({ children }: { children: ReactNode }): ReactElement {
  const [store] = useState(() => createSessionStore(null));

  useBrowserLayoutEffect(() => {
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

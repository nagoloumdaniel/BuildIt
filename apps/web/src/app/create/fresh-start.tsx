'use client';

import { useSearchParams } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { useSession } from '../../components/wizard/draft-provider';
import { NEW_PROJECT_PARAM } from '../../lib/new-project';

/**
 * Le départ d'un **nouveau** projet : `/create?new=1` repart d'un brouillon
 * neuf, puis l'adresse redevient `/create` — un rechargement ensuite garde
 * donc ce qui a été saisi depuis. `useLayoutEffect` : la remise à zéro passe
 * avant que l'écran ne se peigne, aucun reste du projet précédent n'apparaît.
 *
 * `history.replaceState` plutôt que le routeur : Next le synchronise, et le
 * composant reste rendable hors application (tests au rendu serveur).
 */
export function FreshStart(): null {
  const fresh = useSearchParams()?.has(NEW_PROJECT_PARAM) === true;
  const session = useSession();

  useLayoutEffect(() => {
    if (fresh) {
      session.reset();
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [fresh, session]);

  return null;
}

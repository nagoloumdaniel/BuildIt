'use client';

import Link from 'next/link';
import { type ReactElement, useEffect } from 'react';
import { ErrorState } from '../components/ui/error-state';
import { Icon } from '../components/ui/icon';
import { useMessages } from '../lib/i18n/provider';

/**
 * Le cadre d'erreur d'une route.
 *
 * Next le monte quand le rendu d'un écran lève. Il remplace **l'écran**, pas
 * l'application : l'en-tête, la navigation et la langue restent en place, donc
 * on ne perd jamais ses repères.
 *
 * Les deux gestes sont volontairement dans cet ordre : « Réessayer » d'abord
 * (le cas courant est un hoquet réseau ou un rendez-vous raté avec le moteur),
 * « Accueil » ensuite. Le message technique — le `digest` — n'est pas traduit :
 * c'est une valeur, et c'est la seule chose qui relie l'écran au journal du
 * serveur si l'utilisateur doit le signaler.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  const t = useMessages();

  useEffect(() => {
    // Le journal du navigateur garde la trace complète : l'écran, lui, ne
    // montre qu'un résumé lisible.
    console.error(error);
  }, [error]);

  return (
    <main className="pf-shell pf-shell-narrow">
      <div className="pf-fade-in pt-6 md:pt-10">
        <ErrorState
          body={t.errors.crashBody}
          title={t.errors.crashTitle}
          actions={
            <>
              <button className="pf-btn pf-btn-primary" onClick={reset} type="button">
                <Icon name="refresh" size={15} />
                {t.common.retry}
              </button>
              <Link className="pf-btn" href="/">
                <Icon name="home" size={15} />
                {t.common.backHome}
              </Link>
            </>
          }
        />
        {error.digest === undefined ? null : (
          <p className="pf-mono mt-3" style={{ color: 'var(--pf-faint)' }}>
            digest: {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}

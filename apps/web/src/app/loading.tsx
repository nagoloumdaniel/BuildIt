'use client';

import type { ReactElement } from 'react';
import { ProgressBar, Spinner } from '../components/ui/loading';
import { Wordmark } from '../components/ui/logo';
import { useMessages } from '../lib/i18n/provider';

/**
 * Ce que Next affiche pendant qu'un écran se prépare.
 *
 * Le chargement d'une route n'est pas un état d'écran : on ne sait encore rien
 * de sa forme. Un squelette mentirait donc deux fois — il dessinerait un
 * contenu qui n'a pas été lu, et il ferait sauter la mise en page quand le
 * vrai écran arriverait plus haut ou plus court.
 *
 * Ici, rien n'anticipe la réponse : le mot de la marque, un rotor, la barre
 * **indéterminée** (on ne connaît aucun pourcentage, en inventer un serait
 * pire que rien) et une phrase qui nomme le travail. La barre a la même
 * hauteur et la même place que partout ailleurs : quand la page arrive, rien
 * ne bouge.
 */
export default function Loading(): ReactElement {
  const t = useMessages();

  return (
    <main className="pf-route-loading" aria-busy="true">
      <Wordmark size={24} />
      <Spinner label={t.a11y.loading} size="lg" />
      <p aria-live="polite" className="pf-hint" role="status">
        {t.common.loading}
      </p>
      <ProgressBar className="mt-1" label={t.a11y.loading} />
    </main>
  );
}

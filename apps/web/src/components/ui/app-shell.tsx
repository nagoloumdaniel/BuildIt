'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { LocaleToggle } from '../../app/locale-toggle';
import { ThemeToggle } from '../../app/theme-toggle';
import { useMessages } from '../../lib/i18n/provider';
import { REPO_URL } from '../../lib/links';
import { BubbleNav } from './bubble-nav';
import { Icon } from './icon';
import { Wordmark } from './logo';

/**
 * L'en-tête et le pied de page, partout.
 *
 * L'en-tête n'est **pas** une barre : c'est une rangée de bulles posées au-dessus
 * de la page. Une barre pleine derrière des bulles faisait deux fonds pour une
 * seule rangée — l'un disait « barre », l'autre « pilule », et le contenu qui
 * défilait disparaissait sous un bandeau au lieu de passer entre les bulles.
 *
 * Quatre groupes, chacun dans sa bulle, dans l'ordre de lecture :
 * l'identité, la navigation, les deux réglages (langue, thème), le code source.
 * Un groupe par bulle, parce que les gestes qu'il contient se ressemblent :
 * chercher une ressemblance entre « Projets » et « thème sombre » n'aurait pas
 * de sens, et la frontière le dit mieux qu'un écart.
 *
 * Les espaces **entre** les bulles ne captent pas le clic
 * (`pointer-events`, dans `globals.css`) : l'en-tête est collante, et une bande
 * transparente de 56 px qui avale les clics sur toute la largeur serait un
 * piège invisible.
 */
export function AppShell({ children }: { children: ReactNode }): ReactElement {
  const t = useMessages();
  return (
    <>
      <a className="pf-btn pf-sr-only-focusable" href="#contenu">
        {t.common.skipToContent}
      </a>

      <header className="pf-topbar">
        <div className="pf-topbar-inner">
          <Link
            aria-label={t.nav.home}
            className="pf-pod pf-pod-identity no-underline"
            href="/"
            style={{ color: 'inherit' }}
          >
            <Wordmark size={22} />
          </Link>

          <div className="hidden md:flex md:min-w-0">
            <BubbleNav />
          </div>

          <div className="pf-topbar-settings">
            <div className="pf-pod">
              <LocaleToggle />
            </div>
            <div className="pf-pod">
              <ThemeToggle />
            </div>
            {/* Le dépôt du produit, pas l'écran de connexion GitHub (qui est
                dans la navigation) : d'où le libellé « code source ». */}
            <a
              aria-label={t.nav.source}
              className="pf-pod pf-pod-action"
              href={REPO_URL}
              rel="noreferrer"
              target="_blank"
              title={t.nav.source}
            >
              <Icon name="github" size={16} />
            </a>
          </div>
        </div>

        {/* Sous 768 px, les bulles de navigation passent sous l'identité : elles
            gardent leur place de rangée plutôt que de disparaître dans un menu. */}
        <div className="pf-topbar-mobile md:hidden">
          <BubbleNav />
        </div>
      </header>

      <div id="contenu" tabIndex={-1}>
        {children}
      </div>

      {/* Le pied de page : trois blocs, pas un plan du site. Il s'aligne sur la
          même colonne que les écrans (1120 px, mêmes gouttières), le filet le
          sépare du contenu, et à l'étroit les blocs s'empilent à gauche plutôt
          que de se répartir au hasard de l'espace restant. */}
      <footer className="pf-footer">
        <div className="pf-footer-inner">
          <div className="min-w-0">
            <Wordmark size={20} />
            <p className="pf-eyebrow mt-1.5">{t.common.tagline}</p>
          </div>

          <nav aria-label={t.footer.navLabel} className="pf-footer-nav">
            <Link className="pf-link" href="/projects">
              {t.nav.projects}
            </Link>
            <Link className="pf-link" href="/graph">
              {t.nav.graph}
            </Link>
            <a className="pf-link" href={REPO_URL} rel="noreferrer" target="_blank">
              {t.nav.source}
            </a>
          </nav>

          <p className="pf-eyebrow pf-footer-meta">
            {t.footer.licence} · v{t.footer.version}
          </p>
        </div>
      </footer>
    </>
  );
}

'use client';

import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { LocaleToggle } from '../../app/locale-toggle';
import { ThemeToggle } from '../../app/theme-toggle';
import { useMessages } from '../../lib/i18n/provider';
import { BubbleNav } from './bubble-nav';
import { Wordmark } from './logo';

/**
 * L'en-tête et le pied de page, partout.
 *
 * L'en-tête est collant : sur un parcours de douze écrans, revenir à l'accueil
 * ou changer de chemin ne doit pas demander de remonter. Il est translucide et
 * flouté plutôt qu'opaque — le contenu qui passe dessous dit qu'on a défilé,
 * ce qu'une barre pleine cache.
 *
 * Trois zones, dans cet ordre de lecture : l'identité (logo et nom), la
 * navigation (les bulles), les réglages (langue, thème). Les réglages sont à
 * droite parce qu'on les change une fois, pas à chaque écran.
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
            className="no-underline"
            href="/"
            style={{ color: 'inherit' }}
          >
            <Wordmark size={26} />
          </Link>

          <div className="hidden md:block">
            <BubbleNav />
          </div>

          <div className="flex items-center gap-1">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Sous 768 px, les bulles passent sous l'identité : elles gardent leur
            place de rangée plutôt que de disparaître dans un menu. */}
        <div className="pf-mobile-nav border-t border-border px-3 py-2 md:hidden">
          <BubbleNav />
        </div>
      </header>

      <div id="contenu" tabIndex={-1}>
        {children}
      </div>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="min-w-0">
            <Wordmark size={20} />
            <p className="pf-eyebrow mt-1.5">{t.common.tagline}</p>
          </div>

          {/* Le pied de page n'est pas un plan du site : trois adresses, celles
              qui servent quand on est déjà en bas de page. Les réglages
              (langue, thème) restent dans l'en-tête, avec le reste. */}
          <nav aria-label={t.footer.navLabel} className="pf-row">
            <Link className="pf-link text-[0.8125rem]" href="/projects">
              {t.nav.projects}
            </Link>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <Link className="pf-link text-[0.8125rem]" href="/graph">
              {t.nav.graph}
            </Link>
            <span aria-hidden="true" className="text-faint">
              ·
            </span>
            <Link className="pf-link text-[0.8125rem]" href="/github">
              {t.nav.github}
            </Link>
          </nav>

          <p className="pf-eyebrow">
            {t.footer.licence} · v{t.footer.version}
          </p>
        </div>
      </footer>
    </>
  );
}

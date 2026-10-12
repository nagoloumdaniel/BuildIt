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
            <Wordmark priority size={26} />
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
        <div className="border-t border-border px-3 py-2 md:hidden">
          <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <BubbleNav />
          </div>
        </div>
      </header>

      <div id="contenu" tabIndex={-1}>
        {children}
      </div>

      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8">
          <p className="pf-eyebrow">{t.common.tagline}</p>
          <p className="pf-eyebrow">MIT</p>
        </div>
      </footer>
    </>
  );
}

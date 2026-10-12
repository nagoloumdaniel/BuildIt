'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import { Icon, type IconName } from './icon';

/**
 * La navigation en bulles de l'en-tête.
 *
 * Une pilule par destination, l'active en orange. Le repère n'est pas un
 * soulignement de 2 px qu'il faut chercher : la pastille entière change de
 * fond, ce qui se voit du coin de l'œil et survit au zoom à 200 %.
 *
 * Sur mobile, les libellés tombent et il ne reste que les icônes — la rangée
 * tient alors dans la largeur sans défilement horizontal. L'`aria-label` de
 * chaque lien porte le libellé dans les deux cas : l'icône seule ne nomme rien.
 */

interface Destination {
  readonly href: string;
  readonly icon: IconName;
  readonly key: 'home' | 'create' | 'clone' | 'open' | 'projects' | 'github';
}

const DESTINATIONS: readonly Destination[] = [
  { href: '/', icon: 'home', key: 'home' },
  { href: '/create', icon: 'sparkles', key: 'create' },
  { href: '/clone', icon: 'gitBranch', key: 'clone' },
  { href: '/open', icon: 'folderOpen', key: 'open' },
  { href: '/projects', icon: 'layers', key: 'projects' },
  { href: '/github', icon: 'github', key: 'github' },
];

/** La destination active : la racine n'est active que sur elle-même. */
export function isCurrent(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function BubbleNav(): ReactElement {
  const pathname = usePathname() ?? '/';
  const t = useMessages();

  return (
    <nav aria-label={t.nav.label}>
      <ul className="pf-bubbles m-0 list-none p-1">
        {DESTINATIONS.map((destination) => {
          const label = t.nav[destination.key];
          const active = isCurrent(pathname, destination.href);
          return (
            <li key={destination.href}>
              <Link
                aria-label={label}
                className="pf-bubble"
                href={destination.href}
                {...(active ? { 'aria-current': 'page' as const } : {})}
              >
                <Icon name={destination.icon} size={15} />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

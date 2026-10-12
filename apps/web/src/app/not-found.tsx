'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { Icon } from '../components/ui/icon';
import { useMessages } from '../lib/i18n/provider';

/**
 * L'écran 404.
 *
 * Il ne s'excuse pas et ne plaisante pas : il dit l'adresse demandée — la
 * seule information que le visiteur n'a pas sous les yeux s'il est arrivé par
 * un lien — puis les deux endroits d'où repartir. Deux, pas six : une page
 * d'erreur n'est pas un plan du site.
 *
 * Le « 404 » est en chasse fixe et grand : c'est un code, et c'est le seul
 * endroit de l'application où la typographie fait du bruit. C'est voulu — une
 * page d'erreur doit se reconnaître sans être lue.
 */
export default function NotFound(): ReactElement {
  const t = useMessages();
  const pathname = usePathname();

  return (
    <main className="pf-shell pf-shell-narrow">
      <div className="pf-fade-in py-10 md:py-16">
        <p
          aria-hidden="true"
          className="pf-mono"
          style={{
            color: 'var(--pf-accent)',
            fontSize: 'clamp(4rem, 3rem + 10vw, 8rem)',
            fontWeight: 600,
            letterSpacing: '-0.06em',
            lineHeight: 0.85,
          }}
        >
          {t.errors.notFoundCode}
        </p>

        <h1 className="pf-display mt-5">{t.errors.notFoundTitle}</h1>
        <p className="pf-subtitle mt-3">{t.errors.notFoundBody}</p>

        {pathname === null || pathname === '' ? null : (
          <p className="pf-code mt-5" style={{ wordBreak: 'break-all' }}>
            {pathname}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Link className="pf-btn pf-btn-primary pf-btn-lg" href="/">
            <Icon name="home" />
            {t.errors.notFoundHome}
          </Link>
          <Link className="pf-btn pf-btn-lg" href="/create">
            <Icon name="sparkles" />
            {t.errors.notFoundCreate}
          </Link>
        </div>
      </div>
    </main>
  );
}

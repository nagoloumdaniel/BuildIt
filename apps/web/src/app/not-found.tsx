'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactElement, useEffect, useState } from 'react';
import { CommandLine } from '../components/ui/copy';
import { Icon } from '../components/ui/icon';
import { Illustration } from '../components/ui/illustration';
import { useMessages } from '../lib/i18n/provider';
import { NEW_PROJECT_HREF } from '../lib/new-project';

/**
 * L'écran 404.
 *
 * Il ne s'excuse pas et ne plaisante pas : il dit l'adresse demandée la
 * seule information que le visiteur n'a pas sous les yeux s'il est arrivé par
 * un lien puis les endroits d'où repartir. Trois, pas six : une page
 * d'erreur n'est pas un plan du site, mais une seule sortie serait un
 * cul-de-sac.
 *
 * Le « 404 » est en chasse fixe et grand : c'est un code, et c'est le seul
 * endroit de l'application où la typographie fait du bruit. C'est voulu une
 * page d'erreur doit se reconnaître sans être lue.
 *
 * L'adresse demandée n'est **pas** rendue au premier passage : le rendu serveur
 * de la 404 ne connaît pas de chemin (`usePathname()` y est vide), et l'afficher
 * tout de suite faisait diverger l'hydratation (`#418`) trouvé par les
 * captures d'écran, pas par un test. Elle apparaît donc après le montage, ce qui
 * ne coûte rien : personne n'attend une fraction de seconde pour lire un chemin.
 */
export default function NotFound(): ReactElement {
  const t = useMessages();
  const pathname = usePathname();
  const [requested, setRequested] = useState<string | null>(null);

  useEffect(() => {
    setRequested(pathname);
  }, [pathname]);

  return (
    <main className="pf-shell pf-shell-narrow">
      <div className="pf-fade-in py-8 md:py-14">
        <p
          aria-hidden="true"
          className="pf-mono"
          style={{
            color: 'var(--pf-accent)',
            fontSize: 'clamp(3.5rem, 2.6rem + 9vw, 7rem)',
            fontWeight: 600,
            letterSpacing: '-0.06em',
            lineHeight: 0.85,
          }}
        >
          {t.errors.notFoundCode}
        </p>

        <div className="mt-6 flex flex-wrap items-start gap-5">
          <span aria-hidden="true" className="flex-none" style={{ color: 'var(--pf-steel)' }}>
            <Illustration name="lost" size={88} />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="pf-display">{t.errors.notFoundTitle}</h1>
            <p className="pf-subtitle mt-3">{t.errors.notFoundBody}</p>

            {requested === null || requested === '' ? null : (
              <CommandLine className="mt-4" value={requested} what={t.errors.notFoundPathWhat} />
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <Link className="pf-btn pf-btn-primary pf-btn-lg" href="/">
            <Icon name="home" />
            {t.errors.notFoundHome}
          </Link>
          <Link className="pf-btn pf-btn-lg" href={NEW_PROJECT_HREF}>
            <Icon name="sparkles" />
            {t.errors.notFoundCreate}
          </Link>
          <Link className="pf-btn pf-btn-lg" href="/projects">
            <Icon name="layers" />
            {t.nav.projects}
          </Link>
        </div>
      </div>
    </main>
  );
}

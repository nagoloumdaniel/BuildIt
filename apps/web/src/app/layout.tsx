import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DraftProvider } from '../components/wizard/draft-provider';
import { ThemeToggle } from './theme-toggle';
import { Toaster } from './toaster';
import './globals.css';

/**
 * Métadonnées de tout le site.
 *
 * `metadataBase` donne une origine absolue aux URL relatives (canonique, Open
 * Graph) : elle vient de `PF_SITE_URL`, avec le repli sur ce que `pf web` sert
 * (`http://127.0.0.1:4173`). Aucun domaine n'est écrit en dur — l'hébergement
 * est la Phase 12, et le jour venu une variable d'environnement suffira.
 *
 * Le titre passe par un gabarit : un écran qui déclare son propre titre n'a plus
 * à répéter « BuildIt » (`/share` le faisait).
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env['PF_SITE_URL'] ?? 'http://127.0.0.1:4173'),
  title: {
    default: 'BuildIt',
    template: '%s · BuildIt',
  },
  description: 'Décrire un projet, obtenir un projet prêt à développer.',
  applicationName: 'BuildIt',
  openGraph: {
    type: 'website',
    siteName: 'BuildIt',
    locale: 'fr_FR',
    url: '/',
    // `title` et `description` sont volontairement absents : Next les reprend du
    // titre résolu de **chaque** page. Les fixer ici les figerait pour tout le
    // site — `/share` afficherait « BuildIt » au lieu de son propre
    // titre dans les aperçus de lien.
  },
  twitter: { card: 'summary' },
};

/**
 * Posé avant le premier rendu : sans lui, la page s'affiche en clair puis
 * bascule en sombre — le « flash » que le §6 rend inacceptable. Le script est
 * volontairement minuscule, sans dépendance, et ne lève jamais : un thème est
 * un confort, pas une condition d'affichage.
 */
const ANTI_FLASH = `(function(){try{var p=localStorage.getItem('pf-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: le script anti-flash doit être inline et posé avant le premier rendu — c'est le motif que Next documente pour éviter le flash de thème. Aucune donnée n'y entre. */}
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH }} />
      </head>
      <body>
        <a className="pf-btn pf-sr-only-focusable" href="#contenu">
          Aller au contenu
        </a>
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-5 py-2">
            <Link className="pf-title text-base no-underline" href="/">
              BuildIt
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <div id="contenu" tabIndex={-1}>
          {/* Le brouillon est partagé par tous les écrans : un seul endroit (§3). */}
          <DraftProvider>{children}</DraftProvider>
        </div>
        <Toaster />
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeToggle } from './theme-toggle';
import { Toaster } from './toaster';
import './globals.css';

export const metadata: Metadata = { title: 'Project Factory' };

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
        <header>
          <ThemeToggle />
        </header>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppShell } from '../components/ui/app-shell';
import { DraftProvider } from '../components/wizard/draft-provider';
import { LocaleProvider } from '../lib/i18n/provider';
import { Toaster } from './toaster';
import './globals.css';

/**
 * Les deux familles, auto-hébergées par Next.
 *
 * `next/font` les télécharge à la construction et les sert depuis le même
 * domaine : pas de requête vers fonts.gstatic.com au chargement, pas de
 * dépendance réseau à l'exécution, et le `font-display: swap` évite le texte
 * invisible. Les variables CSS rejoignent `globals.css`, qui garde les
 * familles de repli — une police qui n'arrive pas ne doit pas casser la page.
 *
 * Deux familles et deux rôles, tenus partout : Inter pour la prose, JetBrains
 * Mono pour la donnée (chemins, identifiants, compteurs, pourcentages).
 */
const sans = Inter({
  axes: ['opsz'],
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-pf-sans',
});

const mono = JetBrains_Mono({
  display: 'swap',
  subsets: ['latin'],
  variable: '--font-pf-mono',
  weight: ['400', '500', '600'],
});

/**
 * Métadonnées de tout le site.
 *
 * `metadataBase` donne une origine absolue aux URL relatives (canonique, Open
 * Graph) : elle vient de `PF_SITE_URL`, avec le repli sur ce que `pf web` sert
 * (`http://127.0.0.1:4173`). Aucun domaine n'est écrit en dur.
 *
 * Le titre passe par un gabarit : un écran qui déclare son propre titre n'a
 * plus à répéter « BuildIt ».
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
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BuildIt' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
};

/**
 * La couleur de la barre du navigateur suit le thème.
 *
 * Sans elle, un téléphone en thème sombre garde une encoche blanche au-dessus
 * d'une page noire.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf8' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0e10' },
  ],
};

/**
 * Posé avant le premier rendu : sans lui, la page s'affiche en clair puis
 * bascule en sombre — le « flash » que le §6 rend inacceptable. Le script est
 * volontairement minuscule, sans dépendance, et ne lève jamais : un thème est
 * un confort, pas une condition d'affichage.
 *
 * Il pose aussi `lang` : le fournisseur de langue ne peut le faire qu'après
 * hydratation, et un lecteur d'écran qui lit du français avec une voix
 * anglaise pendant une seconde est désagréable.
 */
const ANTI_FLASH = `(function(){try{var p=localStorage.getItem('pf-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';var l=localStorage.getItem('pf-locale');if(l==='en'||l==='fr'){document.documentElement.lang=l;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="fr" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: le script anti-flash doit être inline et posé avant le premier rendu — c'est le motif que Next documente pour éviter le flash de thème. Aucune donnée n'y entre. */}
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <LocaleProvider>
          <AppShell>
            {/* Le brouillon est partagé par tous les écrans : un seul endroit (§3). */}
            <DraftProvider>{children}</DraftProvider>
          </AppShell>
          <Toaster />
        </LocaleProvider>
      </body>
    </html>
  );
}

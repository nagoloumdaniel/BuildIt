'use client';

import { type ReactElement, useEffect, useState } from 'react';

/**
 * Le dernier filet : l'erreur du **layout racine**.
 *
 * Quand le layout lui-même n'a pas pu être rendu, il n'y a plus de
 * fournisseur de langue, plus de thème, plus de polices — Next demande donc à
 * ce fichier de rendre `<html>` et `<body>` lui-même. Il ne peut rien
 * emprunter à l'application : pas de composant partagé, pas de dictionnaire,
 * pas de classe `pf-*` (la feuille de style a pu ne pas être servie).
 *
 * D'où les deux règles tenues ici, et nulle part ailleurs :
 * 1. le style est **inline** et minimal — il doit tenir sans `globals.css` ;
 * 2. le texte est **court et bilingue**, choisi d'après la langue réellement
 *    posée par le script du layout (`pf-locale`), avec le français par défaut.
 *
 * C'est le seul endroit de l'application où une phrase existe en deux langues
 * à la fois. C'est assumé : ici, être compris vaut mieux qu'être élégant.
 */

const TEXT = {
  fr: {
    title: 'BuildIt n’a pas pu démarrer',
    body: 'La page n’a pas pu être affichée. Rechargez la page ; si le problème revient, relancez « pf web ».',
    action: 'Recharger',
  },
  en: {
    title: 'BuildIt could not start',
    body: 'The page could not be displayed. Reload it; if it comes back, restart “pf web”.',
    action: 'Reload',
  },
} as const;

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}): ReactElement {
  const [locale, setLocale] = useState<'fr' | 'en'>('fr');

  useEffect(() => {
    console.error(error);
    try {
      const stored = window.localStorage.getItem('pf-locale');
      if (stored === 'en' || stored === 'fr') {
        setLocale(stored);
      }
    } catch {
      // Stockage refusé : le français reste, ce n'est pas un motif d'échec.
    }
  }, [error]);

  const t = TEXT[locale];

  return (
    <html lang={locale}>
      <body
        style={{
          background: '#0c0e10',
          color: '#eceef0',
          fontFamily: 'Inter, system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
        }}
      >
        <main
          style={{
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            justifyContent: 'center',
            margin: '0 auto',
            maxWidth: '30rem',
            minHeight: '100vh',
            padding: '2rem 1.25rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: '#ff8a3d',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.02em',
              margin: 0,
            }}
          >
            BuildIt
          </p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 660, margin: 0 }}>{t.title}</h1>
          <p style={{ color: '#9aa2aa', fontSize: '0.9375rem', margin: 0 }}>{t.body}</p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              background: '#ff8a3d',
              border: 0,
              borderRadius: '8px',
              color: '#1a0e04',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginTop: '0.5rem',
              minHeight: '2.5rem',
              padding: '0.5rem 1.1rem',
            }}
            type="button"
          >
            {t.action}
          </button>
          {error.digest === undefined ? null : (
            <p
              style={{
                color: '#767e86',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontSize: '0.75rem',
                margin: 0,
              }}
            >
              digest: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}

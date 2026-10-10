'use client';

import { type ReactElement, useEffect, useState } from 'react';
import {
  browserStorage,
  readPreference,
  resolveTheme,
  type ThemePreference,
  writePreference,
} from '../lib/theme';

/** L'ordre du cycle : clair, sombre, système, puis de nouveau clair. */
const NEXT: Readonly<Record<ThemePreference, ThemePreference>> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const LABELS: Readonly<Record<ThemePreference, string>> = {
  light: 'clair',
  dark: 'sombre',
  system: 'système',
};

/**
 * La bascule de thème du socle — neutre à dessein : la direction artistique
 * est l'affaire de la sous-phase 8A. Elle existe ici parce que le script
 * anti-flash n'est vérifiable qu'avec un moyen de changer de thème.
 */
export function ThemeToggle(): ReactElement {
  const [preference, setPreference] = useState<ThemePreference>('system');

  // Le premier rendu est celui du serveur, qui ne connaît pas la préférence :
  // le script anti-flash a déjà posé le bon `data-theme`, on se synchronise ici.
  useEffect(() => {
    setPreference(readPreference(browserStorage()));
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = (): void => {
      // `setAttribute` plutôt que `dataset.theme` : `noPropertyAccessFromIndexSignature`
      // interdit l'accès par point sur une signature d'index, et les crochets
      // feraient râler Biome. L'attribut est exactement ce que lit le CSS.
      document.documentElement.setAttribute('data-theme', resolveTheme(preference, query.matches));
    };
    sync();
    // En mode système, suivre le système **en direct**, pas seulement au chargement.
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [preference]);

  function cycle(): void {
    const next = NEXT[preference];
    setPreference(next);
    writePreference(browserStorage(), next);
  }

  return (
    <button type="button" onClick={cycle} aria-label={`Thème : ${LABELS[preference]}`}>
      Thème : {LABELS[preference]}
    </button>
  );
}

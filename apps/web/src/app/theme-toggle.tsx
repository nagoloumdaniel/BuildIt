'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { Icon, type IconName } from '../components/ui/icon';
import { useMessages } from '../lib/i18n/provider';
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

const GLYPH: Readonly<Record<ThemePreference, IconName>> = {
  light: 'sun',
  dark: 'moon',
  system: 'monitor',
};

/**
 * La bascule de thème.
 *
 * Trois états, un seul bouton : l'icône dit lequel, et le libellé accessible
 * le nomme. Pas de menu déroulant — trois valeurs se parcourent plus vite
 * qu'elles ne se choisissent, et un menu coûterait un piège à focus pour
 * trois lignes.
 *
 * Le libellé reste masqué visuellement mais présent : sans lui, le bouton
 * serait « un soleil », ce qui ne dit ni l'état courant ni ce qu'un clic fait.
 */
export function ThemeToggle(): ReactElement {
  const t = useMessages();
  const [preference, setPreference] = useState<ThemePreference>('system');

  // Le premier rendu est celui du serveur, qui ne connaît pas la préférence :
  // le script anti-clignotement a déjà posé le bon `data-theme`, on se
  // synchronise ici.
  useEffect(() => {
    setPreference(readPreference(browserStorage()));
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = (): void => {
      document.documentElement.setAttribute('data-theme', resolveTheme(preference, query.matches));
    };
    sync();
    // En mode système, suivre le système **en direct**, pas seulement au chargement.
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [preference]);

  const label = {
    light: t.common.themeLight,
    dark: t.common.themeDark,
    system: t.common.themeSystem,
  }[preference];

  return (
    <button
      aria-label={t.a11y.themeToggle(label)}
      className="pf-btn pf-btn-ghost pf-btn-sm pf-btn-icon"
      onClick={() => {
        const next = NEXT[preference];
        setPreference(next);
        writePreference(browserStorage(), next);
      }}
      title={t.a11y.themeToggle(label)}
      type="button"
    >
      <Icon name={GLYPH[preference]} size={16} />
    </button>
  );
}

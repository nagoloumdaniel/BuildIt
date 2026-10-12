'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { Icon } from '../components/ui/icon';
import { useMessages } from '../lib/i18n/provider';
import {
  browserStorage,
  readPreference,
  resolveTheme,
  type ThemePreference,
  writePreference,
} from '../lib/theme';

/**
 * La bascule de thème : **un seul bouton**, qui montre le soleil en clair et
 * la lune en sombre.
 *
 * Le défaut reste le thème du système — c'est lui que le script
 * anti-clignotement applique au premier affichage, et le bouton le reflète.
 * Un appui force le thème opposé à celui qui est affiché ; la préférence est
 * conservée dans le navigateur (`pf-theme`). Tant que rien n'a été forcé, le
 * bouton suit le système en direct.
 *
 * Le libellé accessible dit ce que le clic **fait** (« Passer au thème
 * sombre ») : l'icône dit l'état, la phrase dit l'action.
 */
export function ThemeToggle(): ReactElement {
  const t = useMessages();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [prefersDark, setPrefersDark] = useState(false);

  // Le premier rendu est celui du serveur, qui ne connaît ni la préférence ni
  // le système : le script anti-clignotement a déjà posé le bon `data-theme`,
  // on se synchronise ici.
  useEffect(() => {
    setPreference(readPreference(browserStorage()));
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = (): void => {
      setPrefersDark(query.matches);
      document.documentElement.setAttribute('data-theme', resolveTheme(preference, query.matches));
    };
    sync();
    // En mode système, suivre le système **en direct**, pas seulement au chargement.
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [preference]);

  const resolved = resolveTheme(preference, prefersDark);
  const next = resolved === 'dark' ? 'light' : 'dark';
  const label = t.a11y.themeSet(next === 'dark' ? t.common.themeDark : t.common.themeLight);

  return (
    <button
      aria-label={label}
      className="pf-btn pf-btn-ghost pf-btn-sm pf-btn-icon"
      onClick={() => {
        setPreference(next);
        writePreference(browserStorage(), next);
      }}
      title={label}
      type="button"
    >
      <Icon name={resolved === 'dark' ? 'moon' : 'sun'} size={16} />
    </button>
  );
}

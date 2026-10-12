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
 * La bascule de thème — **deux icônes**, un soleil et une lune.
 *
 * Le troisième état (« suivre le système ») existe toujours : il est le
 * **défaut**, et c'est lui qu'on retrouve en rappuyant sur l'icône déjà
 * active. Autrement dit : en clair, le soleil est allumé ; appuyer dessus rend
 * la main au système, appuyer sur la lune force le sombre. Un cycle à trois
 * positions obligeait à passer par « système » pour revenir au clair, et une
 * troisième icône (l'écran) demandait d'apprendre un pictogramme pour un
 * réglage qu'on touche une fois.
 *
 * Le repère n'est donc pas « ce que le clic va faire » mais « le thème
 * affiché » : un contrôle segmenté se lit comme un état. Quand ce thème vient
 * du système, le segment le dit (`data-auto`) et le libellé accessible le
 * nomme — sans quoi « clair » et « clair parce que votre système l'est »
 * seraient indistinguables.
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
  const auto = preference === 'system';

  function choose(theme: 'light' | 'dark'): void {
    // Rappuyer sur le thème affiché rend la main au système : c'est le seul
    // chemin de retour, et il est sur le bouton qu'on vient d'utiliser.
    const next: ThemePreference = resolved === theme ? 'system' : theme;
    setPreference(next);
    writePreference(browserStorage(), next);
  }

  return (
    <div className="pf-segmented">
      {(['light', 'dark'] as const).map((theme) => {
        const active = resolved === theme;
        const name = theme === 'light' ? t.common.themeLight : t.common.themeDark;
        const label = active
          ? auto
            ? t.a11y.themeAuto(name)
            : t.a11y.themeRelease(name)
          : t.a11y.themeSet(name);
        return (
          <button
            aria-label={label}
            aria-pressed={active}
            className="pf-segment"
            data-auto={active && auto ? 'true' : 'false'}
            key={theme}
            onClick={() => choose(theme)}
            title={label}
            type="button"
          >
            <Icon name={theme === 'light' ? 'sun' : 'moon'} size={15} />
          </button>
        );
      })}
    </div>
  );
}

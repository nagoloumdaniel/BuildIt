'use client';

import type { ReactElement } from 'react';
import { Icon } from '../components/ui/icon';
import { LOCALE_LABELS, LOCALE_SHORT } from '../lib/i18n/locale';
import { useLocale } from '../lib/i18n/provider';

/**
 * La bascule de langue.
 *
 * Deux langues : un bouton qui passe de l'une à l'autre, avec le code de la
 * langue **courante** écrit en chasse fixe — c'est une valeur, pas une
 * phrase. Un menu déroulant pour deux options coûterait plus qu'il ne rapporte.
 *
 * Le bouton montre la langue affichée, pas celle vers laquelle il bascule :
 * un indicateur d'état se lit plus souvent qu'il ne se clique.
 */
export function LocaleToggle(): ReactElement {
  const { locale, setLocale, t } = useLocale();
  const other = locale === 'fr' ? 'en' : 'fr';

  return (
    <button
      aria-label={`${t.a11y.localeToggle(LOCALE_LABELS[locale])} · ${LOCALE_LABELS[other]}`}
      className="pf-btn pf-btn-ghost pf-btn-sm"
      onClick={() => setLocale(other)}
      title={LOCALE_LABELS[other]}
      type="button"
    >
      <Icon name="languages" size={15} />
      <span className="pf-mono" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
        {LOCALE_SHORT[locale]}
      </span>
    </button>
  );
}

'use client';

import type { ReactElement } from 'react';
import { LOCALE_LABELS, LOCALE_SHORT } from '../lib/i18n/locale';
import { useLocale } from '../lib/i18n/provider';

/**
 * La bascule de langue.
 *
 * Deux langues : un bouton qui passe de l'une à l'autre, et qui n'affiche que
 * le code de la langue **courante**, `FR` ou `EN`, en chasse fixe : c'est une
 * valeur, pas une phrase. Pas d'icône à côté : le code se lit seul, et une
 * icône de traduction en plus doublait la bulle sans rien apprendre. Un menu
 * déroulant pour deux options coûterait plus qu'il ne rapporte.
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
      className="pf-btn pf-btn-ghost pf-btn-sm pf-locale"
      onClick={() => setLocale(other)}
      title={LOCALE_LABELS[other]}
      type="button"
    >
      {LOCALE_SHORT[locale]}
    </button>
  );
}

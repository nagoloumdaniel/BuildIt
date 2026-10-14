'use client';

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  browserLocaleStorage,
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
  preferredLocale,
  readLocale,
  writeLocale,
} from './locale';
import { MESSAGES, type Messages } from './messages';

/**
 * La langue, partagée par tous les écrans.
 *
 * Le premier rendu est celui du serveur, qui ne connaît aucune préférence :
 * il sort le français, et l'effet d'hydratation bascule si le visiteur a
 * choisi l'anglais. Un `suppressHydrationWarning` serait un pansement ici
 * le texte est remplacé après le montage, pas pendant la comparaison.
 *
 * Aucune route `/[locale]` : ce configurateur n'est pas indexé par langue, et
 * doubler chaque adresse casserait les liens de partage déjà émis.
 */

interface LocaleContextValue {
  readonly locale: Locale;
  readonly t: Messages;
  readonly setLocale: (locale: Locale) => void;
  /** Vrai une fois la préférence du visiteur lue avant, c'est le défaut. */
  readonly ready: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }): ReactElement {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storage = browserLocaleStorage();
    const stored = storage.read('pf-locale');
    const resolved =
      stored === null
        ? preferredLocale(navigator.languages ?? [navigator.language])
        : readLocale(storage);
    setLocaleState(resolved);
    setReady(true);
  }, []);

  // L'attribut `lang` du document suit la langue : c'est lui que lisent les
  // lecteurs d'écran pour choisir leur voix, et la césure du navigateur.
  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocale(browserLocaleStorage(), next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: MESSAGES[locale], setLocale, ready }),
    [locale, setLocale, ready],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/**
 * Le dictionnaire de la langue courante.
 *
 * Hors fournisseur rendu statique d'un test de composant il rend le
 * français plutôt que de lever : un test de balisage n'a pas à monter tout
 * l'arbre de l'application pour vérifier un bouton.
 */
export function useMessages(): Messages {
  return useContext(LocaleContext)?.t ?? MESSAGES[DEFAULT_LOCALE];
}

export function useLocale(): LocaleContextValue {
  return (
    useContext(LocaleContext) ?? {
      locale: DEFAULT_LOCALE,
      t: MESSAGES[DEFAULT_LOCALE],
      setLocale: () => undefined,
      ready: false,
    }
  );
}

export type { Locale };
export { LOCALES };

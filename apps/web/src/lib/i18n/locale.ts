/**
 * La langue de l'interface (français, anglais).
 *
 * Isolé du dictionnaire et du contexte React : la lecture de la préférence est
 * la même logique que celle du thème (`lib/theme.ts`), elle est testable sans
 * DOM, et le script anti-clignotement du `layout` la reproduit en trois lignes
 * sans importer ce module.
 */

export const LOCALES = ['fr', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/** La clé de stockage — la même que celle du script anti-clignotement. */
export const LOCALE_STORAGE_KEY = 'pf-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Un stockage minimal, injectable : les tests n'ont pas besoin d'un DOM, et un
 * navigateur en navigation privée peut lever sur `localStorage`.
 */
export interface LocaleStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export function browserLocaleStorage(): LocaleStorage {
  return {
    read(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Une préférence est un confort, pas une condition d'affichage.
      }
    },
  };
}

export function readLocale(storage: LocaleStorage): Locale {
  const stored = storage.read(LOCALE_STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function writeLocale(storage: LocaleStorage, locale: Locale): void {
  storage.write(LOCALE_STORAGE_KEY, locale);
}

/**
 * La langue déduite du navigateur, quand rien n'a encore été choisi.
 *
 * Tout ce qui n'est pas anglais retombe sur le français : c'est la langue
 * d'origine du produit, et la plus complète.
 */
export function preferredLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.toLowerCase();
    if (tag.startsWith('en')) {
      return 'en';
    }
    if (tag.startsWith('fr')) {
      return 'fr';
    }
  }
  return DEFAULT_LOCALE;
}

export const LOCALE_LABELS: Readonly<Record<Locale, string>> = {
  fr: 'Français',
  en: 'English',
};

/** L'étiquette courte du sélecteur — deux lettres, en chasse fixe. */
export const LOCALE_SHORT: Readonly<Record<Locale, string>> = {
  fr: 'FR',
  en: 'EN',
};

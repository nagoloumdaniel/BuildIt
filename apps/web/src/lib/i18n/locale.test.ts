import { describe, expect, it } from 'vitest';
import {
  browserLocaleStorage,
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_STORAGE_KEY,
  preferredLocale,
  readLocale,
  writeLocale,
} from './locale';

/**
 * La langue : lecture, écriture, déduction.
 *
 * Ce module est la seule logique du dossier `i18n` — les dictionnaires sont des
 * données et le fournisseur est de la glue React. Il est donc vérifié ici, sans
 * DOM : le stockage est injecté, comme pour le thème (`lib/theme.ts`).
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const memory = new Map(Object.entries(initial));
  const writes: string[] = [];
  return {
    storage: {
      read: (key: string) => memory.get(key) ?? null,
      write: (key: string, value: string) => {
        writes.push(`${key}=${value}`);
        memory.set(key, value);
      },
    },
    writes,
    memory,
  };
}

describe('isLocale', () => {
  it('n’accepte que les deux langues servies', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('fr-FR')).toBe(false);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe('readLocale', () => {
  it('rend le français quand rien n’a été choisi', () => {
    expect(readLocale(fakeStorage().storage)).toBe(DEFAULT_LOCALE);
  });

  it('rend la langue enregistrée', () => {
    expect(readLocale(fakeStorage({ [LOCALE_STORAGE_KEY]: 'en' }).storage)).toBe('en');
  });

  it('retombe sur le français pour une valeur hostile', () => {
    // Ce qui vient du stockage n'est pas de confiance : une langue inventée ne
    // doit pas produire un écran sans texte.
    expect(readLocale(fakeStorage({ [LOCALE_STORAGE_KEY]: 'klingon' }).storage)).toBe(
      DEFAULT_LOCALE,
    );
  });
});

describe('writeLocale', () => {
  it('écrit sous la clé lue par le script anti-clignotement', () => {
    const fake = fakeStorage();

    writeLocale(fake.storage, 'en');

    expect(fake.writes).toEqual([`${LOCALE_STORAGE_KEY}=en`]);
    expect(readLocale(fake.storage)).toBe('en');
  });
});

describe('preferredLocale', () => {
  it('suit la première langue préférée du navigateur', () => {
    expect(preferredLocale(['en-US', 'fr-FR'])).toBe('en');
    expect(preferredLocale(['fr-CA', 'en-US'])).toBe('fr');
  });

  it('ignore les langues non servies plutôt que de rendre la première venue', () => {
    expect(preferredLocale(['de-DE', 'es-ES', 'en-GB'])).toBe('en');
  });

  it('retombe sur le français quand aucune langue servie n’est préférée', () => {
    expect(preferredLocale(['de-DE'])).toBe(DEFAULT_LOCALE);
    expect(preferredLocale([])).toBe(DEFAULT_LOCALE);
  });

  it('compare sans tenir compte de la casse', () => {
    expect(preferredLocale(['EN-us'])).toBe('en');
    expect(preferredLocale(['FR'])).toBe('fr');
  });
});

describe('browserLocaleStorage', () => {
  function withWindow(windowValue: unknown, run: () => void): void {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowValue });
    try {
      run();
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  }

  it('lit et écrit quand le stockage répond', () => {
    const memory = new Map<string, string>();
    withWindow(
      {
        localStorage: {
          getItem: (key: string) => memory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            memory.set(key, value);
          },
        },
      },
      () => {
        const storage = browserLocaleStorage();
        storage.write(LOCALE_STORAGE_KEY, 'en');
        expect(storage.read(LOCALE_STORAGE_KEY)).toBe('en');
      },
    );
  });

  it('avale le refus d’un navigateur en navigation privée', () => {
    withWindow(
      {
        localStorage: {
          getItem() {
            throw new Error('refusé');
          },
          setItem() {
            throw new Error('refusé');
          },
        },
      },
      () => {
        const storage = browserLocaleStorage();
        expect(storage.read(LOCALE_STORAGE_KEY)).toBeNull();
        expect(() => storage.write(LOCALE_STORAGE_KEY, 'en')).not.toThrow();
      },
    );
  });
});

import { describe, expect, it } from 'vitest';
import {
  browserStorage,
  readPreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  writePreference,
} from './theme';

/** Un `Storage` en mémoire : le navigateur n'est pas disponible sous Vitest. */
function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('resolveTheme', () => {
  it('system suit la préférence du système', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('light et dark s’imposent, quel que soit le système', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readPreference', () => {
  it('sans storage ni valeur, revient à system', () => {
    expect(readPreference(null)).toBe('system');
    expect(readPreference(fakeStorage() as unknown as Storage)).toBe('system');
  });

  it('une valeur inconnue est rejetée, pas crachée', () => {
    expect(readPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'bleu' }) as unknown as Storage)).toBe(
      'system',
    );
  });

  it('relit une préférence écrite', () => {
    const storage = fakeStorage() as unknown as Storage;
    writePreference(storage, 'dark');
    expect(readPreference(storage)).toBe('dark');
  });

  it('écrire sans storage ne lève pas (navigation privée, rendu serveur)', () => {
    expect(() => writePreference(null, 'light')).not.toThrow();
  });
});

describe('browserStorage', () => {
  /** Remet `globalThis.localStorage` dans son état d'origine, quoi qu'il arrive. */
  function withoutLocalStorage(body: () => void): void {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
      body();
    } finally {
      if (original === undefined) {
        Reflect.deleteProperty(globalThis, 'localStorage');
      } else {
        Object.defineProperty(globalThis, 'localStorage', original);
      }
    }
  }

  it('un localStorage refusé rend null au lieu de lever', () => {
    withoutLocalStorage(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('accès refusé');
        },
      });
      expect(browserStorage()).toBeNull();
    });
  });

  it('rend le storage du navigateur quand il existe', () => {
    const storage = fakeStorage() as unknown as Storage;
    withoutLocalStorage(() => {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
      expect(browserStorage()).toBe(storage);
    });
  });
});

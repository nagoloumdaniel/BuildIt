/**
 * Thème clair / sombre — la logique pure, hors React.
 *
 * Le §6 impose les deux thèmes ; le choix de l'utilisateur vit dans
 * `localStorage`, mais rien ici ne touche au navigateur : `Storage` est passé
 * en argument, donc testable, et `null` (rendu serveur, navigation privée) est
 * un cas normal, pas une panne.
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'pf-theme';

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

/** Ce qu'il faut poser sur `data-theme` pour une préférence donnée. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') {
    return prefersDark ? 'dark' : 'light';
  }
  return preference;
}

/** Une préférence inconnue (ou absente) revient à `system`, jamais à une erreur. */
export function readPreference(storage: Storage | null): ThemePreference {
  const raw = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  return PREFERENCES.find((value) => value === raw) ?? 'system';
}

export function writePreference(storage: Storage | null, preference: ThemePreference): void {
  storage?.setItem(THEME_STORAGE_KEY, preference);
}

/**
 * Le `localStorage` du navigateur, ou `null` quand il est refusé.
 *
 * Y accéder peut **lever** (cookies bloqués, iframe cloisonnée) : le thème est
 * un confort, il ne doit jamais empêcher la page de s'afficher.
 */
export function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

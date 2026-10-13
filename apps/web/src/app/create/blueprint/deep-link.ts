/**
 * L'arrivée par un crayon du plan (`edit-links.ts`) : lire la section visée
 * dans l'adresse, puis l'amener sous les yeux.
 *
 * Lu **après le montage** par `window.location.search`, pas par
 * `useSearchParams` : ce dernier exige une frontière `Suspense` autour de
 * chaque page pour le rendu statique, et l'écran n'a besoin de la valeur
 * qu'une fois, au premier rendu côté navigateur. Sans paramètre, rien ne
 * change : l'écran s'ouvre comme avant.
 */

/** La valeur d'un paramètre, ou `null` s'il est absent ou vide. */
export function deepLinkParam(search: string, key: string): string | null {
  const value = new URLSearchParams(search).get(key);
  return value === null || value.trim() === '' ? null : value.trim();
}

/** Le paramètre de l'adresse courante ; `null` hors navigateur. */
export function currentDeepLink(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return deepLinkParam(window.location.search, key);
}

/**
 * Fait défiler jusqu'à la section, sans glissement si l'utilisateur a demandé
 * moins de mouvement (§7 : la règle CSS globale ne couvre pas un défilement
 * déclenché par script).
 */
export function revealSection(element: Element | null): void {
  if (element === null) {
    return;
  }
  const reduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

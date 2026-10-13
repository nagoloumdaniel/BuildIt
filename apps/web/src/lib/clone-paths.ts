/**
 * Les chemins d'une archive de dépôt, avant d'écrire quoi que ce soit.
 *
 * Une archive `.zip` porte des noms choisis par celui qui l'a fabriquée. Même
 * venue de GitHub, elle décrit le contenu d'un dépôt que personne ici n'a
 * relu : un nom `../../Windows/x`, `C:\x` ou `/etc/x` est la forme classique
 * de l'attaque « zip slip ». Ce module tranche nom par nom, en trois issues :
 *
 * - `ok` : un chemin relatif sûr, en segments `/` ;
 * - `skip` : un nom légitime ailleurs mais que Windows n'écrira pas (`aux.txt`,
 *   `a:b`, `?`, un point final). On l'écarte **et on le dit** : refuser tout le
 *   dépôt pour un fichier exotique serait pire que de l'annoncer ;
 * - `unsafe` : une tentative de sortir du dossier. Là, on refuse l'archive
 *   entière : une seule entrée hostile suffit à ne plus faire confiance au
 *   reste.
 *
 * Ce module ne dépend de rien (ni Node ni navigateur) : la même règle peut
 * tourner des deux côtés.
 */

export type ArchivePathVerdict =
  | { readonly kind: 'ok'; readonly path: string; readonly segments: readonly string[] }
  | { readonly kind: 'skip'; readonly path: string }
  | { readonly kind: 'unsafe'; readonly path: string };

/** Les noms que Windows réserve, avec ou sans extension (`con`, `nul.txt`). */
const RESERVED = /^(?:con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\..*)?$/i;

/** Ce que Windows refuse dans un nom de fichier. */
const FORBIDDEN = /[<>:"|?*]/;

// biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Un segment qu'aucun système n'écrirait tel quel : il trahit un chemin piégé. */
function hostileSegment(segment: string): boolean {
  return segment === '' || segment === '.' || segment === '..';
}

/** Un segment acceptable ailleurs, mais que l'explorateur de Windows refusera. */
function windowsRefuses(segment: string): boolean {
  return (
    FORBIDDEN.test(segment) ||
    RESERVED.test(segment) ||
    segment.endsWith('.') ||
    segment.endsWith(' ')
  );
}

/**
 * Le verdict d'un chemin d'archive, déjà débarrassé du dossier racine.
 *
 * Le séparateur Windows (`\`) n'existe pas dans le format zip : un nom qui en
 * contient un est traité comme une tentative, pas comme un chemin à convertir.
 */
export function classifyArchivePath(raw: string): ArchivePathVerdict {
  if (
    raw === '' ||
    CONTROL.test(raw) ||
    raw.includes('\\') ||
    raw.startsWith('/') ||
    /^[A-Za-z]:/.test(raw)
  ) {
    return { kind: 'unsafe', path: raw };
  }
  const segments = raw.split('/');
  if (segments.some(hostileSegment)) {
    return { kind: 'unsafe', path: raw };
  }
  if (segments.some(windowsRefuses)) {
    return { kind: 'skip', path: raw };
  }
  return { kind: 'ok', path: segments.join('/'), segments };
}

/**
 * Le dossier racine commun à toutes les entrées, s'il y en a un.
 *
 * GitHub range tout le dépôt sous `propriétaire-dépôt-<commit>/`. On le retire
 * pour écrire `<dossier choisi>/<nom>/src/...` et pas
 * `<nom>/octocat-hello-1a2b3c4/src/...`. Une archive sans racine commune est
 * rendue telle quelle (`undefined`).
 */
export function commonRoot(names: readonly string[]): string | undefined {
  let root: string | undefined;
  for (const name of names) {
    const slash = name.indexOf('/');
    if (slash <= 0) {
      return undefined;
    }
    const first = name.slice(0, slash);
    if (root === undefined) {
      root = first;
    } else if (root !== first) {
      return undefined;
    }
  }
  return root;
}

/** Le nom d'une entrée sans la racine commune. Vide pour la racine elle-même. */
export function stripRoot(name: string, root: string | undefined): string {
  if (root === undefined) {
    return name;
  }
  return name.startsWith(`${root}/`) ? name.slice(root.length + 1) : name;
}

'use client';

/**
 * Choisir un dossier **depuis le navigateur**, quand le serveur ne peut pas.
 *
 * En local (`pf web`), l'explorateur s'ouvre côté serveur : le processus tourne
 * sur la machine de l'utilisateur, et il rend un chemin absolu — ce que le
 * moteur attend. En hébergé (`trybuildit.vercel.app`), ce chemin-là n'existe
 * pas : le serveur est ailleurs. L'écran disait donc « saisissez le dossier »,
 * et un champ de saisie de chemin absolu sur une machine qu'on ne voit pas est
 * exactement le cul-de-sac qu'on a retiré partout ailleurs.
 *
 * La File System Access API ouvre **le vrai explorateur de Windows**, dans le
 * navigateur du visiteur. Elle ne rend pas de chemin — seulement une poignée.
 * Ça suffit : la détection n'a besoin que des **noms** des fichiers du premier
 * niveau et du texte de `package.json` (`detectFromEntries`, dans
 * `@buildit/workspace`). C'est tout ce qui part vers le serveur, et c'est la
 * même règle que celle qui tourne en local — pas une seconde détection.
 *
 * Ce que ça ne permet pas, et qui est dit à l'écran plutôt que caché :
 * installer. Aucun serveur ne lancera `pnpm install` sur la machine du
 * visiteur ; la commande est affichée et copiable, à lancer dans son terminal.
 */

/** Ce que le navigateur envoie au serveur : des noms, et un petit fichier. */
export interface PickedFolder {
  /** Le nom du dossier choisi. Pas son chemin : le navigateur ne le donne pas. */
  readonly name: string;
  readonly names: readonly string[];
  readonly packageJson?: string;
}

export type BrowserPickOutcome =
  | { readonly ok: true; readonly value: PickedFolder }
  | { readonly ok: false; readonly reason: 'cancelled' | 'unsupported' | 'failed' };

/**
 * Au-delà, on ne lit plus : un dossier de 10 000 fichiers n'a pas son manifeste
 * au 5 000ᵉ, et la boucle d'énumération coûterait plus que l'information.
 */
export const MAX_ENTRIES = 600;

/** `package.json` au-delà d'un mégaoctet n'est pas un `package.json`. */
const MAX_PACKAGE_JSON_BYTES = 1_000_000;

interface DirectoryEntry {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  getFile?: () => Promise<Blob>;
}

interface DirectoryHandle {
  readonly name: string;
  values: () => AsyncIterable<DirectoryEntry>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<DirectoryHandle>;
};

/**
 * L'API est-elle là ?
 *
 * Chromium et Edge l'ont (donc Windows, le cas visé) ; Firefox et Safari non.
 * L'écran demande avant de proposer le geste, au lieu d'ouvrir une boîte qui
 * ne viendra pas.
 */
export function canUseBrowserPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showDirectoryPicker === 'function'
  );
}

/** Les entrées du premier niveau du dossier choisi. */
async function readEntries(handle: DirectoryHandle): Promise<PickedFolder> {
  const names: string[] = [];
  let packageJson: Blob | undefined;

  for await (const entry of handle.values()) {
    if (entry.kind !== 'file') {
      continue;
    }
    names.push(entry.name);
    if (entry.name === 'package.json' && entry.getFile !== undefined) {
      packageJson = await entry.getFile();
    }
    if (names.length >= MAX_ENTRIES) {
      break;
    }
  }

  if (packageJson === undefined || packageJson.size > MAX_PACKAGE_JSON_BYTES) {
    return { name: handle.name, names };
  }
  return { name: handle.name, names, packageJson: await packageJson.text() };
}

/**
 * Ouvre l'explorateur du visiteur et rend ce que la détection lira.
 *
 * Une annulation n'est pas une panne : fermer la boîte rend `cancelled`, que
 * l'écran dit calmement. `AbortError` est le nom que la plateforme donne à ce
 * geste — et le seul moyen de le distinguer d'un vrai refus.
 */
export async function pickFolderInBrowser(): Promise<BrowserPickOutcome> {
  const open = (window as PickerWindow).showDirectoryPicker;
  if (open === undefined) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const handle = await open({ id: 'buildit-open-local', mode: 'read' });
    return { ok: true, value: await readEntries(handle) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    // `SecurityError` (geste utilisateur manquant), dossier système refusé, API
    // désactivée par politique : rien à réparer côté produit, mais à dire.
    return { ok: false, reason: 'failed' };
  }
}

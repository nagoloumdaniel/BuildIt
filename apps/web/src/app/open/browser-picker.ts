'use client';

/**
 * Choisir un dossier **depuis le navigateur**, quand le serveur ne peut pas.
 *
 * En local (`pf web`), l'explorateur s'ouvre côté serveur : le processus tourne
 * sur la machine de l'utilisateur, et il rend un chemin absolu. En hébergé
 * (`trybuildit.vercel.app`), ce chemin-là n'existe pas : le serveur est
 * ailleurs. C'est le navigateur du visiteur qui choisit et lit le dossier.
 *
 * Deux voies de lecture, toutes deux dans le navigateur :
 * - Chrome, Edge : `showDirectoryPicker` (File System Access API), qui rend
 *   aussi une poignée — de quoi **écrire** les fichiers de base manquants ;
 * - Firefox, Safari, Brave… : `<input type="file" webkitdirectory>`, lecture
 *   seule ; les fichiers manquants partent alors en archive `.zip`.
 *
 * Avant, seule la première existait : hors Chromium, la carte était grisée et
 * l'ouverture d'un projet local impossible depuis le site hébergé.
 *
 * Ce qui part vers le serveur : les **noms** du premier niveau et le texte de
 * `package.json` / `pf.manifest.json` — rien d'autre.
 */

export interface PickedFolder {
  /** Le nom du dossier choisi. Pas son chemin : le navigateur ne le donne pas. */
  readonly name: string;
  /** Les fichiers du premier niveau. */
  readonly names: readonly string[];
  /** Les dossiers du premier niveau. */
  readonly dirs?: readonly string[];
  readonly packageJson?: string;
  /** `pf.manifest.json`, quand le projet en porte un. */
  readonly manifest?: string;
}

export interface DirectoryEntry {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  getFile?: () => Promise<Blob>;
}

export interface DirectoryHandle {
  readonly name: string;
  values: () => AsyncIterable<DirectoryEntry>;
  requestPermission?: (options: { mode: 'read' | 'readwrite' }) => Promise<string>;
}

/** Comment écrire dans le dossier choisi, s'il le permet. */
export type PickedAccess =
  | { readonly kind: 'handle'; readonly handle: DirectoryHandle }
  | { readonly kind: 'files'; readonly paths: readonly string[] };

export type BrowserPickOutcome =
  | { readonly ok: true; readonly value: PickedFolder; readonly access: PickedAccess }
  | { readonly ok: false; readonly reason: 'cancelled' | 'unsupported' | 'failed' };

/**
 * Au-delà, on ne lit plus : un dossier de 10 000 fichiers n'a pas son manifeste
 * au 5 000ᵉ, et la boucle d'énumération coûterait plus que l'information.
 */
export const MAX_ENTRIES = 600;

/** Au-delà d'un mégaoctet, ce n'est pas un fichier de configuration. */
const MAX_TEXT_BYTES = 1_000_000;

const MANIFEST_FILE = 'pf.manifest.json';

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: string;
  }) => Promise<DirectoryHandle>;
};

/** Chromium et Edge ont l'API ; Firefox, Safari et Brave (par défaut) non. */
export function canUseBrowserPicker(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showDirectoryPicker === 'function'
  );
}

/** Le repli : les navigateurs de bureau savent tous choisir un dossier ainsi. */
export function canUseFileInput(): boolean {
  return typeof document !== 'undefined' && 'webkitdirectory' in document.createElement('input');
}

async function textOf(blob: Blob | undefined): Promise<string | undefined> {
  return blob === undefined || blob.size > MAX_TEXT_BYTES ? undefined : blob.text();
}

/** Les entrées du premier niveau du dossier choisi. */
async function readEntries(handle: DirectoryHandle): Promise<PickedFolder> {
  const names: string[] = [];
  const dirs: string[] = [];
  let packageJson: Blob | undefined;
  let manifest: Blob | undefined;

  for await (const entry of handle.values()) {
    if (entry.kind === 'directory') {
      dirs.push(entry.name);
    } else {
      names.push(entry.name);
      if (entry.name === 'package.json' && entry.getFile !== undefined) {
        packageJson = await entry.getFile();
      }
      if (entry.name === MANIFEST_FILE && entry.getFile !== undefined) {
        manifest = await entry.getFile();
      }
    }
    if (names.length + dirs.length >= MAX_ENTRIES) {
      break;
    }
  }

  const pkg = await textOf(packageJson);
  const man = await textOf(manifest);
  return {
    name: handle.name,
    names,
    dirs,
    ...(pkg === undefined ? {} : { packageJson: pkg }),
    ...(man === undefined ? {} : { manifest: man }),
  };
}

/**
 * Ouvre l'explorateur du visiteur (Chromium) et rend ce que la détection lira.
 *
 * Une annulation n'est pas une panne : fermer la boîte rend `cancelled`.
 * `AbortError` est le nom que la plateforme donne à ce geste.
 */
export async function pickFolderInBrowser(): Promise<BrowserPickOutcome> {
  const picker = window as PickerWindow;
  if (typeof picker.showDirectoryPicker !== 'function') {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    const handle = await picker.showDirectoryPicker({ id: 'buildit-open-local', mode: 'read' });
    return { ok: true, value: await readEntries(handle), access: { kind: 'handle', handle } };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    // `SecurityError`, dossier système refusé, API désactivée par politique.
    return { ok: false, reason: 'failed' };
  }
}

/** Un fichier tel que `<input webkitdirectory>` le rend. */
export interface ListedFile {
  readonly webkitRelativePath: string;
  readonly name: string;
  readonly size: number;
  text: () => Promise<string>;
}

/**
 * Lit la liste rendue par `<input webkitdirectory>` : `racine/chemin/fichier`.
 * Testable sans navigateur.
 */
export async function readFileList(
  files: ArrayLike<ListedFile>,
): Promise<{ readonly value: PickedFolder; readonly paths: readonly string[] } | undefined> {
  const list = Array.from(files);
  const first = list[0];
  if (first === undefined) {
    return undefined;
  }
  const root = first.webkitRelativePath.split('/')[0] ?? '';
  const names: string[] = [];
  const dirs: string[] = [];
  const paths: string[] = [];
  let packageJson: string | undefined;
  let manifest: string | undefined;

  for (const file of list) {
    const relative = file.webkitRelativePath.split('/').slice(1);
    const [head] = relative;
    if (head === undefined) {
      continue;
    }
    paths.push(relative.join('/'));
    if (relative.length > 1) {
      if (!dirs.includes(head)) {
        dirs.push(head);
      }
      continue;
    }
    names.push(head);
    if (file.size <= MAX_TEXT_BYTES && head === 'package.json') {
      packageJson = await file.text();
    }
    if (file.size <= MAX_TEXT_BYTES && head === MANIFEST_FILE) {
      manifest = await file.text();
    }
  }

  return {
    value: {
      name: root,
      names: names.slice(0, MAX_ENTRIES),
      dirs: dirs.slice(0, MAX_ENTRIES),
      ...(packageJson === undefined ? {} : { packageJson }),
      ...(manifest === undefined ? {} : { manifest }),
    },
    paths,
  };
}

/**
 * Le repli universel : un `<input type="file" webkitdirectory>` invisible.
 *
 * Appelé dans le geste de l'utilisateur (le clic sur la carte), sans `await`
 * avant `click()` : sinon le navigateur refuse d'ouvrir la boîte.
 */
export function pickFolderWithInput(): Promise<BrowserPickOutcome> {
  if (!canUseFileInput()) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('data-pf-folder-input', '');
    input.style.display = 'none';
    let settled = false;
    const settle = (outcome: BrowserPickOutcome): void => {
      if (!settled) {
        settled = true;
        input.remove();
        resolve(outcome);
      }
    };
    input.addEventListener('cancel', () => settle({ ok: false, reason: 'cancelled' }));
    input.addEventListener('change', () => {
      void readFileList((input.files ?? []) as ArrayLike<ListedFile>).then(
        (read) =>
          settle(
            read === undefined
              ? { ok: false, reason: 'cancelled' }
              : { ok: true, value: read.value, access: { kind: 'files', paths: read.paths } },
          ),
        () => settle({ ok: false, reason: 'failed' }),
      );
    });
    document.body.append(input);
    input.click();
  });
}

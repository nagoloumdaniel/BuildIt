'use client';

import { listZipEntries, readZipEntry, ZipReadError } from '../../lib/zip-read-browser';

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
  | {
      readonly ok: false;
      readonly reason: 'cancelled' | 'unsupported' | 'failed';
      /** Ce qui a échoué, quand on le sait : `zip` = archive illisible. */
      readonly detail?: 'zip';
    };

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

/** Lit le premier niveau d'un dossier déjà ouvert par sa poignée. */
export function readHandleFolder(handle: DirectoryHandle): Promise<PickedFolder> {
  return readEntries(handle);
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

/** Ce que dit le navigateur de l'appareil : de quoi reconnaître un mobile. */
export interface DeviceHints {
  readonly userAgent: string;
  readonly maxTouchPoints?: number;
}

/**
 * iPhone, iPad et Android : `<input webkitdirectory>` y existe parfois mais
 * n'ouvre pas de dossier (iOS propose Photos et Fichiers, un fichier à la
 * fois). On y propose une archive `.zip` du projet, ou plusieurs fichiers.
 * iPadOS se présente en « Macintosh » : ses points de contact le trahissent.
 */
export function isMobileWithoutFolder(hints: DeviceHints): boolean {
  const ua = hints.userAgent;
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return /Macintosh/.test(ua) && (hints.maxTouchPoints ?? 0) > 1;
}

export function deviceIsMobileWithoutFolder(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isMobileWithoutFolder({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

/** Le dossier racine commun à toutes les entrées (`projet/`), s'il y en a un. */
function commonRoot(paths: readonly string[]): string | undefined {
  const first = paths[0]?.split('/')[0];
  if (first === undefined || !paths.every((path) => path.startsWith(`${first}/`))) {
    return undefined;
  }
  return first;
}

type ReadProject = { readonly value: PickedFolder; readonly paths: readonly string[] };

/**
 * Lit l'archive `.zip` d'un projet : les chemins, et le texte de
 * `package.json` / `pf.manifest.json` à la racine. Une archive d'un dossier
 * (« projet/… », ce que fait « Compresser » sur iOS et macOS) est lue depuis
 * ce dossier.
 */
export async function readZipProject(bytes: Uint8Array, zipName: string): Promise<ReadProject> {
  const entries = listZipEntries(bytes).filter(
    (entry) =>
      !entry.path.endsWith('/') &&
      !entry.path.startsWith('__MACOSX/') &&
      !entry.path.split('/').includes('.DS_Store'),
  );
  const root = commonRoot(entries.map((entry) => entry.path));
  const strip = root === undefined ? 0 : root.length + 1;
  const names: string[] = [];
  const dirs: string[] = [];
  const paths: string[] = [];
  let packageJson: string | undefined;
  let manifest: string | undefined;
  const decoder = new TextDecoder();
  for (const entry of entries) {
    const relative = entry.path.slice(strip);
    if (relative === '' || relative.split('/').includes('..')) continue;
    paths.push(relative);
    const [head = ''] = relative.split('/');
    if (relative.includes('/')) {
      if (!dirs.includes(head)) dirs.push(head);
      continue;
    }
    names.push(head);
    const wanted = head === 'package.json' || head === MANIFEST_FILE;
    if (wanted && entry.size <= MAX_TEXT_BYTES) {
      const text = decoder.decode(await readZipEntry(bytes, entry));
      if (head === 'package.json') packageJson = text;
      else manifest = text;
    }
  }
  return {
    value: {
      name: root ?? zipName.replace(/\.zip$/i, ''),
      names: names.slice(0, MAX_ENTRIES),
      dirs: dirs.slice(0, MAX_ENTRIES),
      ...(packageJson === undefined ? {} : { packageJson }),
      ...(manifest === undefined ? {} : { manifest }),
    },
    paths,
  };
}

/** Un fichier choisi un par un : seulement son nom (pas de chemin sur mobile). */
export interface PlainFile {
  readonly name: string;
  readonly size: number;
  text: () => Promise<string>;
}

function packageName(text: string | undefined): string | undefined {
  try {
    const name: unknown = (JSON.parse(text ?? '{}') as Record<string, unknown>)['name'];
    return typeof name === 'string' && name !== '' ? name : undefined;
  } catch {
    return undefined;
  }
}

/** Plusieurs fichiers de la racine du projet, choisis ensemble. */
export async function readPlainFiles(
  files: ArrayLike<PlainFile>,
): Promise<ReadProject | undefined> {
  const list = Array.from(files);
  if (list.length === 0) return undefined;
  let packageJson: string | undefined;
  let manifest: string | undefined;
  for (const file of list) {
    if (file.size > MAX_TEXT_BYTES) continue;
    if (file.name === 'package.json') packageJson = await file.text();
    if (file.name === MANIFEST_FILE) manifest = await file.text();
  }
  const names = list.map((file) => file.name);
  return {
    value: {
      name: packageName(packageJson) ?? 'projet',
      names: names.slice(0, MAX_ENTRIES),
      dirs: [],
      ...(packageJson === undefined ? {} : { packageJson }),
      ...(manifest === undefined ? {} : { manifest }),
    },
    paths: names,
  };
}

async function readPicked(
  source: 'zip' | 'files',
  files: readonly File[],
): Promise<BrowserPickOutcome> {
  const first = files[0];
  if (first === undefined) return { ok: false, reason: 'cancelled' };
  if (source === 'zip') {
    try {
      const read = await readZipProject(new Uint8Array(await first.arrayBuffer()), first.name);
      return { ok: true, value: read.value, access: { kind: 'files', paths: read.paths } };
    } catch (error) {
      return error instanceof ZipReadError
        ? { ok: false, reason: 'failed', detail: 'zip' }
        : { ok: false, reason: 'failed' };
    }
  }
  const read = await readPlainFiles(files);
  return read === undefined
    ? { ok: false, reason: 'cancelled' }
    : { ok: true, value: read.value, access: { kind: 'files', paths: read.paths } };
}

/**
 * Le choix mobile : une archive `.zip` du projet, ou plusieurs fichiers.
 * Appelé dans le geste (aucun `await` avant `click()`).
 */
export function pickProjectFiles(source: 'zip' | 'files'): Promise<BrowserPickOutcome> {
  if (typeof document === 'undefined') {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (source === 'zip') {
      input.accept = '.zip,application/zip,application/x-zip-compressed';
    } else {
      input.multiple = true;
    }
    input.setAttribute('data-pf-project-input', source);
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
      void readPicked(source, Array.from(input.files ?? [])).then(settle, () =>
        settle({ ok: false, reason: 'failed' }),
      );
    });
    document.body.append(input);
    input.click();
  });
}

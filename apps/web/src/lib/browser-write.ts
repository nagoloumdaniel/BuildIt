/**
 * Écrire un projet dans un dossier de la machine **depuis le navigateur**.
 *
 * C'est la sortie « dossier » de la version hébergée (trybuildit.vercel.app) :
 * le serveur est sur Vercel, il ne voit pas le disque de l'utilisateur et ne
 * peut pas ouvrir son explorateur. Le navigateur, lui, le peut : la File System
 * Access API ouvre le vrai explorateur de Windows et rend une poignée sur le
 * dossier choisi, en lecture **et** écriture une fois que l'utilisateur l'a
 * accepté. On y crée `<projet>/` puis chaque fichier.
 *
 * Ce que ça ne permet pas, et que l'écran dit : lancer `pnpm install`. Aucun
 * navigateur n'exécute de programme sur la machine ; la commande est affichée,
 * à copier dans un terminal.
 *
 * Les poignées sont décrites par leur forme minimale (`WritableDirectory`) :
 * le module se teste avec un faux dossier en mémoire, sans navigateur.
 */

export interface WritableStream {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

export interface WritableFile {
  createWritable(): Promise<WritableStream>;
}

export interface WritableDirectory {
  readonly name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<WritableDirectory>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<WritableFile>;
  values(): AsyncIterable<unknown>;
}

export interface FileToWrite {
  readonly path: string;
  readonly base64: string;
}

export type BrowserWriteOutcome =
  | { readonly ok: true; readonly directory: string; readonly written: number }
  | {
      readonly ok: false;
      readonly reason: 'taken' | 'unsafePath' | 'failed';
      readonly directory: string;
      readonly written: number;
      readonly detail?: string;
    };

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }) => Promise<WritableDirectory>;
};

/** Le navigateur sait-il écrire dans un dossier ? Chrome et Edge oui, Firefox et Safari non. */
export function canWriteInBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as PickerWindow).showDirectoryPicker === 'function'
  );
}

export type PickOutcome =
  | { readonly ok: true; readonly handle: WritableDirectory }
  | { readonly ok: false; readonly reason: 'cancelled' | 'unsupported' | 'failed' };

/** Ouvre l'explorateur de la machine, en lecture-écriture. */
export async function pickWritableFolder(): Promise<PickOutcome> {
  const open =
    typeof window === 'undefined' ? undefined : (window as PickerWindow).showDirectoryPicker;
  if (open === undefined) {
    return { ok: false, reason: 'unsupported' };
  }
  try {
    return { ok: true, handle: await open({ id: 'buildit-output', mode: 'readwrite' }) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, reason: 'cancelled' };
    }
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Les segments d'un chemin relatif **sûr**, ou `undefined`.
 *
 * Les chemins viennent du serveur, mais ils traversent le réseau : un `..`, un
 * chemin absolu ou un segment vide n'a rien à faire dans un projet généré, et
 * l'API refuserait de toute façon de sortir du dossier — on le refuse avant.
 */
export function safeSegments(path: string): readonly string[] | undefined {
  const segments = path.split('/');
  const ok = segments.every(
    (segment) =>
      segment !== '' &&
      segment !== '.' &&
      segment !== '..' &&
      !segment.includes('\\') &&
      !segment.includes(':'),
  );
  return ok && segments.length > 0 ? segments : undefined;
}

function decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function isEmpty(directory: WritableDirectory): Promise<boolean> {
  for await (const _entry of directory.values()) {
    return false;
  }
  return true;
}

/**
 * Écrit `files` dans `<parent>/<name>/`.
 *
 * Comme le serveur en local, il n'écrase **rien** : un dossier `<name>` déjà
 * présent et non vide est refusé avant le premier octet. `onProgress` reçoit
 * le nombre de fichiers réellement écrits : c'est une vraie mesure, pas une
 * estimation.
 */
export async function writeProject(
  parent: WritableDirectory,
  name: string,
  files: readonly FileToWrite[],
  onProgress?: (written: number, total: number) => void,
): Promise<BrowserWriteOutcome> {
  const directory = `${parent.name}/${name}`;
  for (const file of files) {
    if (safeSegments(file.path) === undefined) {
      return { ok: false, reason: 'unsafePath', directory, written: 0, detail: file.path };
    }
  }

  let root: WritableDirectory;
  try {
    root = await parent.getDirectoryHandle(name, { create: true });
    if (!(await isEmpty(root))) {
      return { ok: false, reason: 'taken', directory, written: 0 };
    }
  } catch (error) {
    return { ok: false, reason: 'failed', directory, written: 0, detail: String(error) };
  }

  let written = 0;
  onProgress?.(0, files.length);
  for (const file of files) {
    const segments = safeSegments(file.path) ?? [];
    try {
      let folder = root;
      for (const segment of segments.slice(0, -1)) {
        folder = await folder.getDirectoryHandle(segment, { create: true });
      }
      const handle = await folder.getFileHandle(segments.at(-1) ?? file.path, { create: true });
      const stream = await handle.createWritable();
      await stream.write(decode(file.base64));
      await stream.close();
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        directory,
        written,
        detail: `${file.path} : ${String(error)}`,
      };
    }
    written += 1;
    onProgress?.(written, files.length);
  }
  return { ok: true, directory, written };
}

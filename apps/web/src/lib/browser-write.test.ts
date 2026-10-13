import { describe, expect, it } from 'vitest';
import {
  canWriteInBrowser,
  decodeBase64,
  openProjectFolder,
  pickWritableFolder,
  safeSegments,
  type WritableDirectory,
  writeFileAt,
  writeProject,
} from './browser-write';

/**
 * L'écriture d'un projet par le navigateur, contre un faux dossier en mémoire.
 *
 * Ce qui compte : rien n'est écrasé, aucun chemin ne sort du dossier choisi,
 * l'avancement compte ce qui est **réellement** écrit, et un échec en cours
 * de route dit combien de fichiers sont déjà là.
 */

interface MemoryDir extends WritableDirectory {
  readonly dirs: Map<string, MemoryDir>;
  readonly files: Map<string, Uint8Array>;
}

function memoryDir(name: string, failOn?: string): MemoryDir {
  const dirs = new Map<string, MemoryDir>();
  const files = new Map<string, Uint8Array>();
  const dir: MemoryDir = {
    name,
    dirs,
    files,
    async getDirectoryHandle(child, options) {
      const existing = dirs.get(child);
      if (existing !== undefined) {
        return existing;
      }
      if (options?.create !== true) {
        throw new Error('absent');
      }
      const created = memoryDir(child, failOn);
      dirs.set(child, created);
      return created;
    },
    async getFileHandle(file) {
      return {
        async createWritable() {
          if (file === failOn) {
            throw new DOMException('refusé', 'NotAllowedError');
          }
          return {
            async write(data: Uint8Array) {
              files.set(file, data);
            },
            async close() {},
          };
        },
      };
    },
    async *values() {
      yield* dirs.values();
      yield* files.keys();
    },
  };
  return dir;
}

const encode = (text: string): string => btoa(text);
const FILES = [
  { path: 'package.json', base64: encode('{"name":"demo"}') },
  { path: 'app/page.tsx', base64: encode('export default 1;') },
  { path: 'components/ui/button.tsx', base64: encode('x') },
];

describe('writeProject', () => {
  it('écrit chaque fichier sous <parent>/<projet>, dossiers compris', async () => {
    const parent = memoryDir('Projets');
    const progress: number[] = [];
    const outcome = await writeProject(parent, 'demo', FILES, (written) => progress.push(written));

    expect(outcome).toEqual({ ok: true, directory: 'Projets/demo', written: 3 });
    const root = parent.dirs.get('demo');
    expect(new TextDecoder().decode(root?.files.get('package.json'))).toBe('{"name":"demo"}');
    expect(root?.dirs.get('app')?.files.has('page.tsx')).toBe(true);
    expect(root?.dirs.get('components')?.dirs.get('ui')?.files.has('button.tsx')).toBe(true);
    // L'avancement compte les fichiers réellement écrits, de 0 à 3.
    expect(progress).toEqual([0, 1, 2, 3]);
  });

  it('n’écrase jamais un dossier du même nom déjà rempli', async () => {
    const parent = memoryDir('Projets');
    const existing = await parent.getDirectoryHandle('demo', { create: true });
    (existing as MemoryDir).files.set('vieux.txt', new Uint8Array());

    const outcome = await writeProject(parent, 'demo', FILES);
    expect(outcome).toMatchObject({ ok: false, reason: 'taken', written: 0 });
    expect((existing as MemoryDir).files.size).toBe(1);
  });

  it('refuse un chemin qui sortirait du dossier, avant d’écrire quoi que ce soit', async () => {
    const parent = memoryDir('Projets');
    const outcome = await writeProject(parent, 'demo', [
      ...FILES,
      { path: '../evil.txt', base64: encode('x') },
    ]);
    expect(outcome).toMatchObject({ ok: false, reason: 'unsafePath', detail: '../evil.txt' });
    expect(parent.dirs.size).toBe(0);
  });

  it('un refus en cours de route dit combien de fichiers sont déjà écrits', async () => {
    const parent = memoryDir('Projets', 'page.tsx');
    const outcome = await writeProject(parent, 'demo', FILES);
    expect(outcome).toMatchObject({ ok: false, reason: 'failed', written: 1 });
  });
});

describe('écritures au fil de l’eau', () => {
  it('réserve le dossier, puis écrit fichier par fichier', async () => {
    const parent = memoryDir('Projets');
    const opened = await openProjectFolder(parent, 'depot');
    expect(opened).toMatchObject({ ok: true, directory: 'Projets/depot' });
    if (!opened.ok) {
      return;
    }
    await writeFileAt(opened.root, 'src/a.ts', decodeBase64(encode('a')));
    const root = parent.dirs.get('depot');
    expect(new TextDecoder().decode(root?.dirs.get('src')?.files.get('a.ts'))).toBe('a');
    // Le même dossier, désormais rempli, est refusé.
    expect(await openProjectFolder(parent, 'depot')).toMatchObject({ ok: false, reason: 'taken' });
  });

  it('dit pourquoi le dossier n’a pas pu être créé', async () => {
    const parent: WritableDirectory = {
      name: 'Bloqué',
      async getDirectoryHandle() {
        throw new DOMException('refusé', 'NotAllowedError');
      },
      async getFileHandle() {
        throw new Error('jamais');
      },
      async *values() {},
    };
    expect(await openProjectFolder(parent, 'x')).toMatchObject({
      ok: false,
      reason: 'failed',
      directory: 'Bloqué/x',
    });
    expect(await writeProject(parent, 'x', FILES)).toMatchObject({ ok: false, written: 0 });
  });

  it('refuse d’écrire un chemin hostile, même appelé directement', async () => {
    await expect(writeFileAt(memoryDir('P'), '../x', new Uint8Array())).rejects.toThrow(
      'Chemin refusé',
    );
  });
});

describe('safeSegments', () => {
  it.each([
    ['app/page.tsx', ['app', 'page.tsx']],
    ['.env.example', ['.env.example']],
    ['../x', undefined],
    ['a//b', undefined],
    ['/etc/passwd', undefined],
    ['C:/x', undefined],
    ['a\\b', undefined],
    ['./x', undefined],
  ] as const)('%s', (path, expected) => {
    expect(safeSegments(path)).toEqual(expected);
  });
});

describe('sans File System Access API', () => {
  it('le dit, et l’ouverture répond « non pris en charge »', async () => {
    expect(canWriteInBrowser()).toBe(false);
    expect(await pickWritableFolder()).toEqual({ ok: false, reason: 'unsupported' });
  });
});

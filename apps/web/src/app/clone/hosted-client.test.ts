import { describe, expect, it } from 'vitest';
import type { WritableDirectory } from '../../lib/browser-write';
import {
  checkHostedCopy,
  copyToFolder,
  downloadRepositoryZip,
  type HostedFetch,
  type HostedProgress,
} from './hosted-client';
import { parseHostedError, parseHostedEvent, parseHostedPlan } from './hosted-protocol';

/**
 * La copie hébergée côté navigateur : un faux serveur, un faux dossier en
 * mémoire. Ce qui compte : l'avancement compte ce qui est réellement écrit,
 * et chaque fin (aboutie, refusée, coupée, annulée) se dit autrement.
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
    async getDirectoryHandle(child) {
      const existing = dirs.get(child);
      if (existing !== undefined) {
        return existing;
      }
      const created = memoryDir(child, failOn);
      dirs.set(child, created);
      return created;
    },
    async getFileHandle(file) {
      return {
        async createWritable() {
          if (file === failOn) {
            throw new Error('disque plein');
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

const b64 = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

const MANIFEST = {
  type: 'manifest',
  total: 2,
  bytes: 3,
  skipped: ['aux.txt'],
  symlinks: [],
  installCommand: 'pnpm install',
};

const HAPPY = [
  { type: 'download', received: 100 },
  MANIFEST,
  { type: 'file', path: 'package.json', data: b64('{}') },
  { type: 'file', path: 'src/a.ts', data: b64('a') },
  { type: 'done', sent: 2 },
];

function ndjson(lines: readonly unknown[]): string {
  return lines.map((line) => (typeof line === 'string' ? line : JSON.stringify(line))).join('\n');
}

/** Un serveur qui répond `body`, découpé en morceaux pour éprouver la lecture. */
function server(body: string | null, init: ResponseInit = {}): HostedFetch {
  return async () => {
    if (body === null) {
      return new Response(null, init);
    }
    const bytes = new TextEncoder().encode(body);
    const middle = Math.floor(bytes.length / 2);
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes.slice(0, middle));
          controller.enqueue(bytes.slice(middle));
          controller.close();
        },
      }),
      init,
    );
  };
}

/** Un serveur qui envoie `lines` puis se tait, sans fermer le flux. */
function silent(lines: readonly unknown[]): HostedFetch {
  return async (_url, init) =>
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`${ndjson(lines)}\n`));
          init.signal?.addEventListener('abort', () => controller.error(new Error('coupé')));
        },
      }),
    );
}

describe('checkHostedCopy', () => {
  it('rend la vérification du serveur, revalidée', async () => {
    const plan = await checkHostedCopy('octo/hello', '', {
      fetch: async (url, init) => {
        expect(url).toBe('/api/clone-archive');
        expect(JSON.parse(String(init.body))).toEqual({
          action: 'plan',
          link: 'octo/hello',
          folder: '',
        });
        return Response.json({
          ok: true,
          label: 'octo/hello',
          url: 'u',
          folder: 'hello',
          github: true,
        });
      },
    });
    expect(plan).toEqual({
      ok: true,
      label: 'octo/hello',
      url: 'u',
      folder: 'hello',
      github: true,
      issues: [],
    });
  });

  it('rend `undefined` quand le serveur ne répond pas, ou mal', async () => {
    expect(
      await checkHostedCopy('a', '', { fetch: server(null, { status: 500 }) }),
    ).toBeUndefined();
    expect(await checkHostedCopy('a', '', { fetch: server('{"x":1}') })).toBeUndefined();
    expect(
      await checkHostedCopy('a', '', {
        fetch: async () => {
          throw new TypeError('hors ligne');
        },
      }),
    ).toBeUndefined();
  });
});

describe('copyToFolder — la copie aboutie', () => {
  it('écrit chaque fichier et compte ce qui est réellement écrit', async () => {
    const parent = memoryDir('Projets');
    const progress: HostedProgress[] = [];
    const outcome = await copyToFolder(
      { link: 'octo/hello', folder: 'hello', parent, onProgress: (p) => progress.push(p) },
      { fetch: server(ndjson(HAPPY)) },
    );
    expect(outcome).toEqual({
      kind: 'done',
      result: {
        directory: 'Projets/hello',
        written: 2,
        bytes: 3,
        skipped: ['aux.txt'],
        symlinks: [],
        installCommand: 'pnpm install',
      },
    });
    const root = parent.dirs.get('hello');
    expect(new TextDecoder().decode(root?.dirs.get('src')?.files.get('a.ts'))).toBe('a');
    expect(progress).toEqual([
      { phase: 'downloading', received: 100 },
      { phase: 'writing', written: 0, total: 2 },
      { phase: 'writing', written: 1, total: 2 },
      { phase: 'writing', written: 2, total: 2 },
    ]);
  });

  it('porte le projet reconnu par le serveur', async () => {
    const project = { description: 'JavaScript / TypeScript : pnpm', packageManager: 'pnpm' };
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      {
        fetch: server(
          ndjson([{ ...MANIFEST, total: 0, project }, { type: 'done', sent: 0 }, '', 'ignoré']),
        ),
      },
    );
    expect(outcome).toMatchObject({ kind: 'done', result: { project, written: 0 } });
  });
});

describe('copyToFolder — les fins qui ne sont pas un succès', () => {
  it('refuse un dossier déjà rempli sans rien télécharger', async () => {
    const parent = memoryDir('Projets');
    const existing = await parent.getDirectoryHandle('hello');
    (existing as MemoryDir).files.set('vieux', new Uint8Array());
    let called = false;
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'hello', parent },
      {
        fetch: async () => {
          called = true;
          return new Response('');
        },
      },
    );
    expect(outcome).toEqual({
      kind: 'failed',
      failure: { code: 'taken' },
      written: 0,
      directory: 'Projets/hello',
    });
    expect(called).toBe(false);
  });

  it('dit un dossier qui n’a pas pu être créé', async () => {
    const parent: WritableDirectory = {
      name: 'P',
      async getDirectoryHandle() {
        throw new Error('refusé');
      },
      async getFileHandle() {
        throw new Error('jamais');
      },
      async *values() {},
    };
    const outcome = await copyToFolder({ link: 'o/r', folder: 'r', parent }, { fetch: server('') });
    expect(outcome).toMatchObject({ kind: 'failed', failure: { code: 'write' } });
  });

  it('rend le refus du serveur, lu dans son JSON ou dans son statut', async () => {
    const refused = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      { fetch: server(JSON.stringify({ error: { code: 'notFound' } }), { status: 404 }) },
    );
    expect(refused).toMatchObject({ kind: 'failed', failure: { code: 'notFound' }, written: 0 });

    const bare = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      { fetch: server('<html>', { status: 504 }) },
    );
    expect(bare).toMatchObject({ failure: { code: 'http', status: 504 } });

    const odd = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      { fetch: server('{"error":{"code":"rm -rf"}}', { status: 400 }) },
    );
    expect(odd).toMatchObject({ failure: { code: 'http', status: 400 } });
  });

  it('distingue une réponse illisible d’un flux coupé avant la fin', async () => {
    const run = (fetch: HostedFetch) =>
      copyToFolder({ link: 'o/r', folder: 'r', parent: memoryDir('P') }, { fetch });
    expect(await run(server(null))).toMatchObject({ failure: { code: 'malformed' } });
    expect(await run(server('pas du json\n'))).toMatchObject({ failure: { code: 'malformed' } });
    expect(await run(server(`${ndjson([HAPPY[2]])}\n`))).toMatchObject({
      failure: { code: 'malformed' },
    });
    expect(await run(server(`${ndjson([MANIFEST, { type: 'done', sent: 5 }])}\n`))).toMatchObject({
      failure: { code: 'malformed' },
    });
    expect(await run(server(`${ndjson([{ type: 'done', sent: 0 }])}\n`))).toMatchObject({
      failure: { code: 'malformed' },
    });
    expect(await run(server(`${ndjson(HAPPY.slice(0, 3))}\n`))).toMatchObject({
      failure: { code: 'incomplete' },
      written: 1,
    });
  });

  it('s’arrête sur l’erreur annoncée par le serveur, en disant ce qui est écrit', async () => {
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      {
        fetch: server(
          `${ndjson([MANIFEST, HAPPY[2], { type: 'error', error: { code: 'corrupt', detail: 'src/a.ts' } }])}\n`,
        ),
      },
    );
    expect(outcome).toMatchObject({
      kind: 'failed',
      failure: { code: 'corrupt', detail: 'src/a.ts' },
      written: 1,
      directory: 'P/r',
    });
  });

  it('arrête tout à la première écriture refusée', async () => {
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P', 'package.json') },
      { fetch: server(`${ndjson(HAPPY)}\n`) },
    );
    expect(outcome).toMatchObject({ kind: 'failed', failure: { code: 'write' }, written: 0 });
    if (outcome.kind === 'failed' && outcome.failure.code === 'write') {
      expect(outcome.failure.detail).toContain('package.json');
    }
  });

  it('une écriture refusée pendant un flux qui continue arrête aussi la lecture', async () => {
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P', 'package.json') },
      { fetch: silent([MANIFEST, HAPPY[2]]) },
    );
    expect(outcome).toMatchObject({ kind: 'failed', failure: { code: 'write' } });
  });

  it('rend l’annulation, avant comme pendant la copie', async () => {
    const before = new AbortController();
    before.abort();
    expect(
      await copyToFolder(
        { link: 'o/r', folder: 'r', parent: memoryDir('P') },
        { fetch: server(''), signal: before.signal },
      ),
    ).toEqual({ kind: 'cancelled', written: 0, directory: 'P/r' });

    const during = new AbortController();
    const outcome = await copyToFolder(
      {
        link: 'o/r',
        folder: 'r',
        parent: memoryDir('P'),
        onProgress: (progress) => {
          if (progress.phase === 'writing' && progress.written === 1) {
            during.abort();
          }
        },
      },
      { fetch: silent([MANIFEST, HAPPY[2]]), signal: during.signal },
    );
    expect(outcome).toEqual({ kind: 'cancelled', written: 1, directory: 'P/r' });
  });

  it('une annulation pendant la requête n’est pas une panne réseau', async () => {
    const controller = new AbortController();
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      {
        signal: controller.signal,
        fetch: async () => {
          controller.abort();
          throw new DOMException('annulé', 'AbortError');
        },
      },
    );
    expect(outcome).toMatchObject({ kind: 'cancelled' });
    const offline = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      {
        fetch: async () => {
          throw new TypeError('hors ligne');
        },
      },
    );
    expect(offline).toMatchObject({ kind: 'failed', failure: { code: 'network' } });
  });

  it('borne le silence du serveur', async () => {
    const outcome = await copyToFolder(
      { link: 'o/r', folder: 'r', parent: memoryDir('P') },
      { fetch: silent([MANIFEST]), idleTimeoutMs: 20 },
    );
    expect(outcome).toMatchObject({ kind: 'failed', failure: { code: 'timeout', seconds: 1 } });
  });

  it('utilise le fetch global et l’adresse par défaut', async () => {
    const original = globalThis.fetch;
    const seen: string[] = [];
    globalThis.fetch = (async (url: string) => {
      seen.push(url);
      return new Response(
        `${ndjson([
          { ...MANIFEST, total: 0 },
          { type: 'done', sent: 0 },
        ])}\n`,
      );
    }) as typeof fetch;
    try {
      const outcome = await copyToFolder(
        { link: 'o/r', folder: 'r', parent: memoryDir('P') },
        { idleTimeoutMs: 0 },
      );
      expect(outcome.kind).toBe('done');
      expect(seen).toEqual(['/api/clone-archive']);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('downloadRepositoryZip', () => {
  it('rend l’archive et compte les octets reçus', async () => {
    const seen: number[] = [];
    const outcome = await downloadRepositoryZip('o/r', 'r', (bytes) => seen.push(bytes), {
      fetch: server('PK-archive'),
    });
    expect(outcome).toMatchObject({ kind: 'done', fileName: 'r.zip', bytes: 10 });
    expect(seen.at(-1)).toBe(10);
    if (outcome.kind === 'done') {
      expect(await outcome.blob.text()).toBe('PK-archive');
    }
  });

  it('rend le refus, une réponse vide, l’annulation et la panne', async () => {
    expect(
      await downloadRepositoryZip('o/r', 'r', undefined, {
        fetch: server(JSON.stringify({ error: { code: 'rateLimited' } }), { status: 429 }),
      }),
    ).toEqual({ kind: 'failed', failure: { code: 'rateLimited' } });
    expect(await downloadRepositoryZip('o/r', 'r', undefined, { fetch: server(null) })).toEqual({
      kind: 'failed',
      failure: { code: 'malformed' },
    });
    const before = new AbortController();
    before.abort();
    expect(
      await downloadRepositoryZip('o/r', 'r', undefined, {
        fetch: server(''),
        signal: before.signal,
      }),
    ).toEqual({ kind: 'cancelled' });
    const during = new AbortController();
    expect(
      await downloadRepositoryZip('o/r', 'r', undefined, {
        signal: during.signal,
        fetch: async () => {
          during.abort();
          throw new DOMException('annulé', 'AbortError');
        },
      }),
    ).toEqual({ kind: 'cancelled' });
    expect(
      await downloadRepositoryZip('o/r', 'r', undefined, {
        fetch: async () => {
          throw new TypeError('hors ligne');
        },
      }),
    ).toEqual({ kind: 'failed', failure: { code: 'network' } });
  });
});

describe('le contrat, lu défensivement', () => {
  it('lit chaque événement, et refuse ce qui n’a pas sa forme', () => {
    expect(parseHostedEvent('')).toBeUndefined();
    expect(parseHostedEvent('{"type":"inconnu"}')).toBeUndefined();
    expect(parseHostedEvent('[1]')).toBe('malformed');
    expect(parseHostedEvent('{"type":"download","received":-1}')).toBe('malformed');
    expect(parseHostedEvent('{"type":"manifest","total":1}')).toBe('malformed');
    expect(parseHostedEvent('{"type":"file","path":1,"data":""}')).toBe('malformed');
    expect(parseHostedEvent('{"type":"done"}')).toBe('malformed');
    expect(parseHostedEvent('{"type":"error","error":{}}')).toBe('malformed');
    expect(parseHostedEvent('{"type":"manifest","total":1,"bytes":2,"skipped":[1,"a"]}')).toEqual({
      type: 'manifest',
      total: 1,
      bytes: 2,
      skipped: ['a'],
      symlinks: [],
    });
  });

  it('ne garde d’une erreur que les champs du contrat', () => {
    expect(parseHostedError({ code: 'http', status: 500, limit: 1.5, detail: 3 })).toEqual({
      code: 'http',
      status: 500,
    });
    expect(parseHostedError({ code: 'tooLarge', limit: 10, detail: 'x' })).toEqual({
      code: 'tooLarge',
      limit: 10,
      detail: 'x',
    });
    expect(parseHostedError('notFound')).toBeUndefined();
  });

  it('complète une vérification partielle sans rien inventer', () => {
    expect(parseHostedPlan({ ok: false, error: { code: 'notGithub' }, issues: ['a', 2] })).toEqual({
      ok: false,
      label: '',
      url: '',
      folder: '',
      github: false,
      error: { code: 'notGithub' },
      issues: ['a'],
    });
    expect(parseHostedPlan(null)).toBeUndefined();
  });
});

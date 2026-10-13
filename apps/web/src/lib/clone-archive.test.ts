import { describe, expect, it } from 'vitest';
import {
  type ArchiveFetch,
  archiveHeaders,
  boundedBody,
  CLONE_ARCHIVE_LIMITS,
  exceedsDeclared,
  extractRepository,
  githubArchiveUrl,
  openArchive,
  readBounded,
} from './clone-archive';
import { buildZip } from './clone-zip.fixture';

/** Le téléchargement et l'ouverture de l'archive GitHub, sans réseau. */

const TOKEN = 'gho_secret_0123456789';

function streamOf(chunks: readonly Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

describe('l’adresse et les en-têtes', () => {
  it('vise l’API GitHub, et ne pose le jeton que s’il existe', () => {
    expect(githubArchiveUrl('octo cat', 'hello')).toBe(
      'https://api.github.com/repos/octo%20cat/hello/zipball',
    );
    expect(archiveHeaders()).not.toHaveProperty('authorization');
    expect(archiveHeaders('')).not.toHaveProperty('authorization');
    expect(archiveHeaders(TOKEN)['authorization']).toBe(`Bearer ${TOKEN}`);
  });
});

describe('openArchive', () => {
  it('rend la réponse, avec le jeton du visiteur', async () => {
    const seen: RequestInit[] = [];
    const fetch: ArchiveFetch = async (_url, init) => {
      seen.push(init);
      return new Response('zip');
    };
    const opened = await openArchive('octo', 'hello', { fetch, token: TOKEN });
    expect(opened.ok).toBe(true);
    const headers = seen[0]?.headers as Record<string, string> | undefined;
    expect(headers?.['authorization']).toBe(`Bearer ${TOKEN}`);
  });

  it('réessaie sans le jeton quand GitHub le refuse (401)', async () => {
    const calls: (string | undefined)[] = [];
    const fetch: ArchiveFetch = async (_url, init) => {
      const auth = (init.headers as Record<string, string>)['authorization'];
      calls.push(auth);
      return auth === undefined ? new Response('zip') : new Response('', { status: 401 });
    };
    expect((await openArchive('o', 'r', { fetch, token: TOKEN })).ok).toBe(true);
    expect(calls).toEqual([`Bearer ${TOKEN}`, undefined]);
    // Sans jeton, un 401 reste un 401.
    const refused = await openArchive('o', 'r', {
      fetch: async () => new Response('', { status: 401 }),
    });
    expect(refused).toEqual({ ok: false, failure: { code: 'unauthorized' } });
  });

  it('nomme chaque refus de GitHub', async () => {
    const answer = (status: number, headers?: Record<string, string>) =>
      openArchive('o', 'r', {
        fetch: async () => new Response('', { status, ...(headers ? { headers } : {}) }),
      });
    expect(await answer(404)).toEqual({ ok: false, failure: { code: 'notFound' } });
    expect(await answer(429)).toEqual({ ok: false, failure: { code: 'rateLimited' } });
    expect(await answer(403, { 'x-ratelimit-remaining': '0' })).toEqual({
      ok: false,
      failure: { code: 'rateLimited' },
    });
    expect(await answer(403)).toEqual({ ok: false, failure: { code: 'http', status: 403 } });
    expect(await answer(500)).toEqual({ ok: false, failure: { code: 'http', status: 500 } });
  });

  it('distingue une liaison perdue d’une annulation', async () => {
    const fetch: ArchiveFetch = async () => {
      throw new TypeError('réseau');
    };
    expect(await openArchive('o', 'r', { fetch })).toEqual({
      ok: false,
      failure: { code: 'network' },
    });
    const controller = new AbortController();
    controller.abort();
    expect(await openArchive('o', 'r', { fetch, signal: controller.signal })).toEqual({
      ok: false,
      failure: { code: 'cancelled' },
    });
  });

  it('utilise le fetch global par défaut', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch;
    try {
      expect(await openArchive('o', 'r')).toEqual({ ok: false, failure: { code: 'notFound' } });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('readBounded / exceedsDeclared / boundedBody', () => {
  it('lit tout, en comptant les octets reçus', async () => {
    const seen: number[] = [];
    const read = await readBounded(
      new Response(streamOf([new Uint8Array(3), new Uint8Array(2)])),
      10,
      (received) => seen.push(received),
    );
    expect(read.ok && read.data.length).toBe(5);
    expect(seen).toEqual([3, 5]);
  });

  it('coupe au-delà de la borne, annoncée ou comptée', async () => {
    const declared = new Response('0123456789', { headers: { 'content-length': '10' } });
    expect(exceedsDeclared(declared, 5)).toBe(true);
    expect(await readBounded(declared, 5)).toEqual({ ok: false });
    expect(exceedsDeclared(new Response('x'), 5)).toBe(false);
    const counted = new Response(streamOf([new Uint8Array(4), new Uint8Array(4)]));
    expect(await readBounded(counted, 5)).toEqual({ ok: false });
  });

  it('rend un corps vide pour une réponse sans corps', async () => {
    const read = await readBounded(new Response(null), 5);
    expect(read.ok && read.data.length).toBe(0);
  });

  it('relaie un corps tel quel, et le coupe en erreur au-delà de la borne', async () => {
    const small = await new Response(boundedBody(streamOf([new Uint8Array(3)]), 5)).arrayBuffer();
    expect(small.byteLength).toBe(3);
    const big = boundedBody(streamOf([new Uint8Array(4), new Uint8Array(4)]), 5);
    await expect(new Response(big).arrayBuffer()).rejects.toThrow();
  });
});

describe('extractRepository', () => {
  it('retire la racine de GitHub, reconnaît le premier niveau et lit package.json', () => {
    const zip = buildZip([
      { name: 'octo-hello-1a2b/' },
      { name: 'octo-hello-1a2b/package.json', data: '{"name":"hello"}' },
      { name: 'octo-hello-1a2b/pnpm-lock.yaml', data: 'lockfileVersion: 9' },
      { name: 'octo-hello-1a2b/src/index.ts', data: 'export {};' },
      { name: 'octo-hello-1a2b/docs/a:b.md', data: 'x' },
      { name: 'octo-hello-1a2b/link', data: 'src', host: 3, mode: 0o120777 },
    ]);
    const result = extractRepository(zip, CLONE_ARCHIVE_LIMITS);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const value = result.value;
    expect(value.root).toBe('octo-hello-1a2b');
    expect(value.files.map((file) => file.path)).toEqual([
      'package.json',
      'pnpm-lock.yaml',
      'src/index.ts',
    ]);
    expect(value.rootNames).toEqual(['package.json', 'pnpm-lock.yaml']);
    expect(value.packageJson).toBe('{"name":"hello"}');
    expect(value.skipped).toEqual(['docs/a:b.md']);
    expect(value.symlinks).toEqual(['link']);
    expect(value.bytes).toBe(16 + 18 + 10);
    expect(value.files[2]?.read().toString('utf8')).toBe('export {};');
  });

  it('garde les chemins tels quels sans racine commune, et sans package.json', () => {
    const result = extractRepository(
      buildZip([
        { name: 'a.txt', data: 'a' },
        { name: 'b/c.txt', data: 'c' },
      ]),
      CLONE_ARCHIVE_LIMITS,
    );
    expect(result.ok && result.value.root).toBeUndefined();
    expect(result.ok && result.value.packageJson).toBeUndefined();
    expect(result.ok && result.value.files.map((file) => file.path)).toEqual(['a.txt', 'b/c.txt']);
  });

  it('refuse l’archive entière pour un seul chemin hostile', () => {
    const result = extractRepository(
      buildZip([
        { name: 'repo/ok.txt', data: 'a' },
        { name: 'repo/../../evil.txt', data: 'b' },
      ]),
      CLONE_ARCHIVE_LIMITS,
    );
    expect(result).toEqual({
      ok: false,
      failure: { reason: 'unsafePath', detail: 'repo/../../evil.txt' },
    });
  });

  it('se passe d’un package.json abîmé ou démesuré', () => {
    const broken = extractRepository(
      buildZip([{ name: 'r/package.json', data: '{}', crc: 1 }]),
      CLONE_ARCHIVE_LIMITS,
    );
    expect(broken.ok && broken.value.packageJson).toBeUndefined();
    const huge = extractRepository(
      buildZip([{ name: 'r/package.json', data: ' '.repeat(1024 * 1024 + 1) }]),
      CLONE_ARCHIVE_LIMITS,
    );
    expect(huge.ok && huge.value.packageJson).toBeUndefined();
  });

  it('rend le refus du lecteur tel quel', () => {
    expect(extractRepository(Buffer.from('pas un zip'), CLONE_ARCHIVE_LIMITS)).toEqual({
      ok: false,
      failure: { reason: 'notZip' },
    });
  });
});

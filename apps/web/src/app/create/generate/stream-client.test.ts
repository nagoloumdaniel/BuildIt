import { describe, expect, it } from 'vitest';
import {
  type GenerateFetch,
  type GenerateProgress,
  parseGenerateEvent,
  streamGeneration,
} from './stream-client';

/**
 * Le suivi côté navigateur, sans réseau : un `fetch` simulé rend un flux
 * d'événements, et le suivi doit en tirer les passages réels, la fin, et
 * distinguer un flux coupé, un serveur muet et une réponse illisible.
 */

const REQUEST = { manifest: { name: 'mon-projet' }, parent: 'C:\\Projets', install: true };

const DONE = {
  type: 'done',
  ok: true,
  directory: 'C:\\Projets\\mon-projet',
  files: ['package.json'],
  bytes: 120,
  warnings: [],
  steps: ['plan', 'write', 'install'],
  issues: [],
  installRequested: true,
  installed: true,
  installCommand: 'pnpm install',
  installIssues: [],
};

function block(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Un `fetch` qui rend ces morceaux, puis ferme le flux (ou le laisse ouvert). */
function streaming(chunks: readonly string[], keepOpen = false): GenerateFetch {
  return async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        if (!keepOpen) {
          controller.close();
        }
      },
    });
    return new Response(body, { status: 200 });
  };
}

describe('parseGenerateEvent rien n’est cru sur parole', () => {
  it('lit les passages connus', () => {
    expect(parseGenerateEvent(block({ type: 'phase', phase: 'writing' }))).toEqual({
      type: 'progress',
      progress: { phase: 'writing' },
    });
    expect(
      parseGenerateEvent(block({ type: 'phase', phase: 'installing', command: 'pnpm install' })),
    ).toEqual({ type: 'progress', progress: { phase: 'installing', command: 'pnpm install' } });
    expect(parseGenerateEvent(block({ type: 'phase', phase: 'installing' }))).toEqual({
      type: 'progress',
      progress: { phase: 'installing' },
    });
    expect(
      parseGenerateEvent(block({ type: 'written', directory: '/x', files: 3, bytes: 10 })),
    ).toEqual({
      type: 'progress',
      progress: { phase: 'written', directory: '/x', files: 3, bytes: 10 },
    });
  });

  it('ignore un commentaire, un bloc vide et un type inconnu', () => {
    expect(parseGenerateEvent(': keep-alive')).toBeUndefined();
    expect(parseGenerateEvent('data: ')).toBeUndefined();
    expect(parseGenerateEvent(block({ type: 'futur' }))).toBeUndefined();
  });

  it('refuse ce qui n’a pas la forme attendue', () => {
    expect(parseGenerateEvent('data: {pas du json')).toBe('malformed');
    expect(parseGenerateEvent('data: [1]')).toBe('malformed');
    expect(parseGenerateEvent(block({ type: 'phase', phase: 'deploy' }))).toBe('malformed');
    expect(
      parseGenerateEvent(block({ type: 'written', directory: '/x', files: -1, bytes: 1 })),
    ).toBe('malformed');
    expect(parseGenerateEvent(block({ type: 'done', ok: 'oui', directory: '' }))).toBe('malformed');
  });

  it('une installation n’est jamais supposée : seul un true explicite compte', () => {
    const parsed = parseGenerateEvent(
      block({ type: 'done', ok: true, directory: '/x', installed: 'yes', installCommand: '' }),
    );
    expect(parsed).toEqual({
      type: 'done',
      result: {
        ok: true,
        directory: '/x',
        files: [],
        bytes: 0,
        warnings: [],
        steps: [],
        issues: [],
        installRequested: false,
        installed: false,
        installIssues: [],
      },
    });
  });

  it('lit l’adresse du dépôt GitHub et les échecs de sa création', () => {
    const parsed = parseGenerateEvent(
      block({
        type: 'done',
        ok: true,
        directory: '/x',
        repositoryUrl: 'https://github.com/moi/mon-projet',
        githubIssues: [],
      }),
    );
    expect(parsed).toMatchObject({
      type: 'done',
      result: { repositoryUrl: 'https://github.com/moi/mon-projet' },
    });

    const failed = parseGenerateEvent(
      block({ type: 'done', ok: true, directory: '/x', githubIssues: ['déjà pris'] }),
    );
    expect(failed).toMatchObject({
      type: 'done',
      result: { githubIssues: ['déjà pris'] },
    });
  });
});

describe('streamGeneration', () => {
  it('pousse les passages réels puis rend la fin du serveur', async () => {
    const seen: GenerateProgress[] = [];
    const outcome = await streamGeneration(REQUEST, {
      fetch: streaming([
        block({ type: 'phase', phase: 'writing' }),
        // Un événement coupé en deux morceaux de réseau reste un événement.
        block({
          type: 'written',
          directory: 'C:\\Projets\\mon-projet',
          files: 1,
          bytes: 120,
        }).slice(0, 20),
        block({
          type: 'written',
          directory: 'C:\\Projets\\mon-projet',
          files: 1,
          bytes: 120,
        }).slice(20),
        `: keep-alive\r\n\r\n`,
        block({ type: 'phase', phase: 'installing', command: 'pnpm install' }),
        block(DONE),
      ]),
      onProgress: (progress) => seen.push(progress),
    });

    expect(seen.map((progress) => progress.phase)).toEqual(['writing', 'written', 'installing']);
    expect(outcome).toMatchObject({ kind: 'done', result: { ok: true, installed: true } });
  });

  it('envoie un POST JSON vers /api/generate', async () => {
    let seenUrl = '';
    let seenInit: RequestInit | undefined;
    await streamGeneration(REQUEST, {
      fetch: async (url, init) => {
        seenUrl = url;
        seenInit = init;
        return streaming([block(DONE)])(url, init);
      },
    });
    expect(seenUrl).toBe('/api/generate');
    expect(seenInit?.method).toBe('POST');
    expect(JSON.parse(String(seenInit?.body))).toEqual(REQUEST);
  });

  it('un flux fermé sans fin est incomplet', async () => {
    const outcome = await streamGeneration(REQUEST, {
      fetch: streaming([block({ type: 'phase', phase: 'writing' })]),
    });
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'incomplete' } });
  });

  it('une réponse illisible est dite illisible', async () => {
    const outcome = await streamGeneration(REQUEST, { fetch: streaming(['data: {cassé\n\n']) });
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'malformed' } });
  });

  it('un statut HTTP en erreur est rendu tel quel', async () => {
    const outcome = await streamGeneration(REQUEST, {
      fetch: async () => new Response('non', { status: 403 }),
    });
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'http', status: 403 } });
  });

  it('une réponse sans corps est illisible', async () => {
    const outcome = await streamGeneration(REQUEST, {
      fetch: async () => new Response(null, { status: 200 }),
    });
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'malformed' } });
  });

  it('un réseau coupé est une panne de réseau', async () => {
    const outcome = await streamGeneration(REQUEST, {
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'network' } });
  });

  it('un serveur muet est arrêté au bout du délai', async () => {
    const outcome = await streamGeneration(REQUEST, {
      fetch: streaming([block({ type: 'phase', phase: 'writing' })], true),
      idleTimeoutMs: 30,
    });
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'timeout', seconds: 1 } });
  });

  it('l’appelant peut arrêter le suivi, avant ou pendant', async () => {
    const before = new AbortController();
    before.abort();
    expect(await streamGeneration(REQUEST, { signal: before.signal })).toEqual({
      kind: 'cancelled',
    });

    const during = new AbortController();
    const pending = streamGeneration(REQUEST, {
      fetch: streaming([block({ type: 'phase', phase: 'writing' })], true),
      signal: during.signal,
      onProgress: () => during.abort(),
      idleTimeoutMs: 0,
    });
    expect(await pending).toEqual({ kind: 'cancelled' });
  });

  it('un abandon pendant la requête elle-même est une annulation', async () => {
    const controller = new AbortController();
    const outcome = await streamGeneration(REQUEST, {
      signal: controller.signal,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          controller.abort();
        }),
    });
    expect(outcome).toEqual({ kind: 'cancelled' });
  });
});

import { describe, expect, it } from 'vitest';
import { type CloneFetch, type CloneStreamFailure, parseCloneEvent, streamClone } from './client';
import { type ClonePhase, type CloneProgress, clonePhaseRank } from './progress';

/**
 * L'écran 22 le suivi du clone.
 *
 * Le clone ne passe pas par une Server Action : elle rend son résultat d'un
 * seul coup, et un clone de 200 Mo y passerait des minutes derrière un rotor.
 * `POST /api/clone` tient la réponse ouverte et pousse l'avancement réel de
 * git ; ces tests lisent ce flux contre un **faux `fetch`** aucun réseau.
 *
 * Ce qui est vérifié ici : la mesure ne recule jamais, le corps de la requête
 * porte bien la destination choisie, et les trois fins (aboutie, annulée,
 * perdue) sont distinguées c'est ce qui permet à l'écran de ne jamais laisser
 * une barre tourner sans fin.
 */

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

interface Fake {
  readonly fetch: CloneFetch;
  readonly calls: Call[];
}

function fakeFetch(response: Response | (() => Response | Promise<Response>)): Fake {
  const calls: Call[] = [];
  const fetcher: CloneFetch = async (url, init) => {
    calls.push({ url, init });
    return typeof response === 'function' ? await response() : response;
  };
  return { fetch: fetcher, calls };
}

/** Un flux d'événements déjà complet, tel que la route l'écrit. */
function sse(blocks: readonly string[], status = 200): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const block of blocks) {
          controller.enqueue(encoder.encode(block));
        }
        controller.close();
      },
    }),
    { status },
  );
}

/** Un flux qu'on pilote à la main : pour observer l'attente et l'annulation. */
function openSse(): {
  readonly response: Response;
  readonly push: (block: string) => void;
  readonly close: () => void;
} {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    }),
    { status: 200 },
  );
  return {
    response,
    push: (block) => controller?.enqueue(encoder.encode(block)),
    close: () => controller?.close(),
  };
}

const event = (payload: unknown): string => `data: ${JSON.stringify(payload)}\n\n`;

const progresses = (payload: { phase: string; percent: number; detail?: string }): string =>
  event({ type: 'progress', ...payload });

const announced = (phase: string): string => event({ type: 'phase', phase });

const finished = (result: Record<string, unknown>): string =>
  event({
    type: 'done',
    ok: true,
    directory: 'C:\\travail\\mon-app',
    issues: [],
    warnings: [],
    installed: false,
    ...result,
  });

describe('parseCloneEvent', () => {
  it('lit les trois événements du contrat', () => {
    expect(parseCloneEvent('data: {"type":"phase","phase":"receiving"}')).toEqual({
      type: 'phase',
      phase: 'receiving',
    });
    expect(
      parseCloneEvent(
        'data: {"type":"progress","phase":"receiving","percent":62,"detail":"520/1234"}',
      ),
    ).toEqual({
      type: 'progress',
      phase: 'receiving',
      percent: 62,
      detail: '520/1234',
    });
    const done = parseCloneEvent(finished({ installed: true }));
    expect(done).toMatchObject({ type: 'done', ok: true, installed: true });
  });

  it('ignore ce qui n’est pas un événement : commentaire, bloc vide, type inconnu', () => {
    expect(parseCloneEvent(': keep-alive')).toBeUndefined();
    expect(parseCloneEvent('')).toBeUndefined();
    expect(parseCloneEvent('event: ping')).toBeUndefined();
    expect(parseCloneEvent('data: {"type":"quelque-chose-encore"}')).toBeUndefined();
  });

  it('refuse une charge utile illisible ou hors contrat', () => {
    expect(parseCloneEvent('data: {oops')).toBe('malformed');
    expect(parseCloneEvent('data: 42')).toBe('malformed');
    expect(parseCloneEvent('data: {"type":"phase","phase":"Enumerating objects"}')).toBe(
      'malformed',
    );
    expect(parseCloneEvent('data: {"type":"progress","phase":"receiving"}')).toBe('malformed');
    expect(parseCloneEvent('data: {"type":"done","ok":"oui"}')).toBe('malformed');
  });

  it('tolère les champs facultatifs d’un `done` : le résultat compte plus que la forme', () => {
    expect(parseCloneEvent('data: {"type":"done","ok":true,"directory":"C:\\\\travail"}')).toEqual({
      type: 'done',
      ok: true,
      directory: 'C:\\travail',
      issues: [],
      warnings: [],
      installed: false,
    });
  });
});

describe('streamClone le flux du clone', () => {
  it('pousse une progression monotone et rend le résultat', async () => {
    const fake = fakeFetch(
      sse([
        announced('starting'),
        progresses({ phase: 'counting', percent: 6, detail: '3/25' }),
        progresses({ phase: 'receiving', percent: 62, detail: '520/1234 · 3.00 MiB/s' }),
        // Git réaffiche une phase antérieure : l'écran ne doit pas reculer.
        progresses({ phase: 'counting', percent: 3, detail: '25/25' }),
        announced('installing'),
        finished({ installed: true, installCommand: 'pnpm install --ignore-scripts' }),
      ]),
    );
    const seen: CloneProgress[] = [];

    const outcome = await streamClone(
      { link: 'octocat/mon-app', folder: 'mon-app', install: true, ignoreScripts: true },
      { fetch: fake.fetch, onProgress: (progress) => seen.push(progress) },
    );

    expect(outcome.kind).toBe('done');
    if (outcome.kind === 'done') {
      expect(outcome.result.ok).toBe(true);
      expect(outcome.result.directory).toBe('C:\\travail\\mon-app');
      expect(outcome.result.installed).toBe(true);
      expect(outcome.result.installCommand).toBe('pnpm install --ignore-scripts');
    }

    expect(seen.length).toBeGreaterThanOrEqual(4);
    for (let index = 1; index < seen.length; index += 1) {
      const previous = seen[index - 1];
      const current = seen[index];
      expect(clonePhaseRank(current?.phase ?? 'starting')).toBeGreaterThanOrEqual(
        clonePhaseRank(previous?.phase ?? 'starting'),
      );
      expect(current?.percent ?? 0).toBeGreaterThanOrEqual(previous?.percent ?? 0);
    }
    // Le retour en arrière de git est absorbé : la phase reste la plus avancée.
    expect(seen.some((progress) => progress.phase === 'installing')).toBe(true);
    expect(seen[seen.length - 1]?.phase).toBe('installing');
  });

  it('envoie la destination choisie dans le corps de la requête', async () => {
    const fake = fakeFetch(sse([finished({})]));

    await streamClone(
      {
        link: 'octocat/mon-app',
        folder: 'mon-app',
        install: true,
        ignoreScripts: false,
        parent: 'C:\\Projets',
      },
      { fetch: fake.fetch },
    );

    expect(fake.calls).toHaveLength(1);
    const [call] = fake.calls;
    expect(call?.url).toBe('/api/clone');
    expect(call?.init.method).toBe('POST');
    expect(call?.init.cache).toBe('no-store');
    expect(JSON.parse(String(call?.init.body))).toEqual({
      link: 'octocat/mon-app',
      folder: 'mon-app',
      install: true,
      ignoreScripts: false,
      parent: 'C:\\Projets',
    });
  });

  it('porte le projet reconnu, la commande et les avertissements', async () => {
    const fake = fakeFetch(
      sse([
        finished({
          project: {
            directory: 'C:\\travail\\mon-app',
            label: 'JavaScript / TypeScript',
            ecosystem: 'node',
            source: 'lockfile',
            evidence: 'pnpm-lock.yaml',
            origin: 'd’après pnpm-lock.yaml',
            warnings: [],
            description: 'JavaScript / TypeScript pnpm',
          },
          installCommand: 'pnpm install',
          warnings: ['Aucun projet reconnu'],
        }),
      ]),
    );

    const outcome = await streamClone(
      { link: 'octocat/mon-app', folder: 'mon-app', install: true, ignoreScripts: true },
      { fetch: fake.fetch },
    );

    expect(outcome.kind).toBe('done');
    if (outcome.kind === 'done') {
      expect(outcome.result.project?.packageManager).toBeUndefined();
      expect(outcome.result.project?.description).toBe('JavaScript / TypeScript pnpm');
      expect(outcome.result.warnings).toEqual(['Aucun projet reconnu']);
    }
  });

  it('rend le refus du moteur tel quel, sans le transformer en panne', async () => {
    const fake = fakeFetch(
      sse([
        finished({
          ok: false,
          directory: 'C:\\travail\\mon-app',
          issues: ['Le dossier existe déjà et n’est pas vide : un clone n’écrase rien.'],
        }),
      ]),
    );

    const outcome = await streamClone(
      { link: 'octocat/mon-app', folder: 'mon-app', install: false, ignoreScripts: true },
      { fetch: fake.fetch },
    );

    expect(outcome.kind).toBe('done');
    if (outcome.kind === 'done') {
      expect(outcome.result.ok).toBe(false);
      expect(outcome.result.issues.join(' ')).toContain('n’écrase rien');
    }
  });

  it('s’arrête à l’annulation, sans attendre le `done`', async () => {
    const stream = openSse();
    const fake = fakeFetch(stream.response);
    const controller = new AbortController();

    const pending = streamClone(
      { link: 'octocat/mon-app', folder: 'mon-app', install: false, ignoreScripts: true },
      {
        fetch: fake.fetch,
        signal: controller.signal,
        // L'utilisateur annule pendant que la réception est en cours : le
        // `done` n'arrivera jamais, et le suivi doit s'arrêter quand même.
        idleTimeoutMs: 200,
        onProgress: () => controller.abort(),
      },
    );
    stream.push(progresses({ phase: 'receiving', percent: 62, detail: '520/1234' }));

    const outcome = await pending;

    expect(outcome.kind).toBe('cancelled');
  });

  it('borne le silence du serveur au lieu de tourner sans fin', async () => {
    const stream = openSse();
    const fake = fakeFetch(stream.response);

    const outcome = await streamClone(
      { link: 'octocat/mon-app', folder: 'mon-app', install: false, ignoreScripts: true },
      { fetch: fake.fetch, idleTimeoutMs: 20 },
    );

    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') {
      expect(outcome.failure).toEqual<CloneStreamFailure>({ reason: 'timeout', seconds: 1 });
    }
  });

  it('distingue une réponse HTTP en erreur, une charge illisible et un flux coupé', async () => {
    const http = await streamClone(
      { link: 'x', folder: 'y', install: false, ignoreScripts: true },
      { fetch: fakeFetch(new Response('refusé', { status: 500 })).fetch },
    );
    expect(http).toEqual({ kind: 'failed', failure: { reason: 'http', status: 500 } });

    const malformed = await streamClone(
      { link: 'x', folder: 'y', install: false, ignoreScripts: true },
      { fetch: fakeFetch(sse(['data: {oops\n\n'])).fetch },
    );
    expect(malformed).toEqual({ kind: 'failed', failure: { reason: 'malformed' } });

    const incomplete = await streamClone(
      { link: 'x', folder: 'y', install: false, ignoreScripts: true },
      { fetch: fakeFetch(sse([progresses({ phase: 'receiving', percent: 62 })])).fetch },
    );
    expect(incomplete).toEqual({ kind: 'failed', failure: { reason: 'incomplete' } });
  });

  it('découpe les événements à cheval sur deux morceaux du flux, même en CRLF', async () => {
    const whole = (
      progresses({ phase: 'receiving', percent: 62, detail: '520/1234' }) + finished({})
    ).replace(/\n/g, '\r\n');
    const half = Math.floor(whole.length / 2);
    const fake = fakeFetch(sse([whole.slice(0, half), whole.slice(half)]));

    const outcome = await streamClone(
      { link: 'x', folder: 'y', install: false, ignoreScripts: true },
      { fetch: fake.fetch },
    );

    expect(outcome.kind).toBe('done');
  });

  it('rend `cancelled` sans lire le flux quand l’utilisateur a déjà annulé', async () => {
    const fake = fakeFetch(sse([finished({})]));
    const controller = new AbortController();
    controller.abort();

    const outcome = await streamClone(
      { link: 'x', folder: 'y', install: false, ignoreScripts: true },
      { fetch: fake.fetch, signal: controller.signal },
    );

    expect(outcome.kind).toBe('cancelled');
  });
});

describe('les phases annoncées par la route', () => {
  it('donne à chaque phase son pourcentage de départ', async () => {
    const fake = fakeFetch(sse([announced('installing'), finished({})]));
    const seen: ClonePhase[] = [];

    await streamClone(
      { link: 'x', folder: 'y', install: true, ignoreScripts: true },
      { fetch: fake.fetch, onProgress: (progress) => seen.push(progress.phase) },
    );

    expect(seen).toEqual(['installing']);
  });
});

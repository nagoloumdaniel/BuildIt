/**
 * Le suivi de la génération dans un dossier, côté navigateur.
 *
 * Même approche que le clone (`app/clone/client.ts`) : `fetch` plutôt
 * qu'`EventSource`, parce que la génération part d'un `POST` (le manifest, le
 * dossier parent, l'installation demandée), et parce qu'un `AbortSignal` est
 * le seul moyen propre d'arrêter le suivi.
 *
 * Ce module ne décide rien et ne dit rien : il relit chaque événement champ
 * par champ (ce qui vient du réseau n'est pas cru sur parole), pousse les
 * passages à l'écran, et rend une fin parmi trois : aboutie (avec le résultat
 * du serveur, succès ou refus), arrêtée par l'appelant, ou perdue. Les phrases
 * vivent dans le dictionnaire de l'écran.
 *
 * Le silence est borné : une installation peut rester muette longtemps, mais
 * pas indéfiniment. Sans événement pendant `DEFAULT_IDLE_TIMEOUT_MS`, le suivi
 * s'arrête au lieu de tourner sans fin.
 */

/**
 * Dix minutes : `pnpm install` d'un projet neuf ne parle pas pendant qu'il
 * télécharge, et la route ne pousse rien entre `installing` et `done`. Une
 * minute, comme pour le clone, couperait une installation saine.
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 600_000;

/** Ce que le navigateur envoie : exactement ce que la route lit. */
export interface GenerateStreamRequest {
  readonly manifest: unknown;
  /** Le dossier parent absolu, choisi dans l'explorateur de la machine. */
  readonly parent: string;
  readonly install: boolean;
  /** Créer le dépôt GitHub du projet sous ce nom une fois l'écriture finie. */
  readonly github?: { readonly name: string };
}

/** Un passage annoncé par la route, avant la fin. */
export type GenerateProgress =
  | { readonly phase: 'writing' }
  | {
      readonly phase: 'written';
      readonly directory: string;
      readonly files: number;
      readonly bytes: number;
    }
  | { readonly phase: 'installing'; readonly command?: string };

/** Le résultat final, tel que la route le pousse. */
export interface GenerateDone {
  readonly ok: boolean;
  readonly directory: string;
  readonly files: readonly string[];
  readonly bytes: number;
  readonly warnings: readonly string[];
  readonly steps: readonly string[];
  readonly issues: readonly string[];
  readonly installRequested: boolean;
  readonly installed: boolean;
  readonly installCommand?: string;
  readonly installIssues: readonly string[];
  /** L'adresse du dépôt GitHub créé, quand on l'a demandé et qu'il a abouti. */
  readonly repositoryUrl?: string;
  /** Pourquoi la création du dépôt GitHub a échoué ; le projet reste écrit. */
  readonly githubIssues?: readonly string[];
}

export type GenerateStreamFailure =
  | { readonly reason: 'timeout'; readonly seconds: number }
  | { readonly reason: 'network' }
  | { readonly reason: 'http'; readonly status: number }
  | { readonly reason: 'malformed' }
  | { readonly reason: 'incomplete' };

export type GenerateStreamOutcome =
  | { readonly kind: 'done'; readonly result: GenerateDone }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly failure: GenerateStreamFailure };

export type GenerateFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface GenerateStreamOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: GenerateProgress) => void;
  /** Injecté par les tests ; `fetch` sinon. */
  readonly fetch?: GenerateFetch;
  /** `0` désarme la surveillance du silence. */
  readonly idleTimeoutMs?: number;
  readonly url?: string;
}

type ParsedEvent =
  | { readonly type: 'progress'; readonly progress: GenerateProgress }
  | { readonly type: 'done'; readonly result: GenerateDone };

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** La charge utile d'un bloc, ou `undefined` pour un commentaire ou un bloc vide. */
function dataOf(block: string): string | undefined {
  const parts: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('data:')) {
      parts.push(line.slice(5).replace(/^ /, ''));
    }
  }
  return parts.length === 0 ? undefined : parts.join('\n');
}

/**
 * Un bloc devient un événement connu, rien (un type que ce navigateur ne
 * connaît pas encore), ou `'malformed'` : la réponse n'est pas celle attendue.
 */
export function parseGenerateEvent(block: string): ParsedEvent | 'malformed' | undefined {
  const data = dataOf(block);
  if (data === undefined || data.trim() === '') {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return 'malformed';
  }
  const input = record(parsed);
  if (input === undefined) {
    return 'malformed';
  }
  const type = input['type'];
  if (type === 'phase') {
    const phase = input['phase'];
    if (phase === 'writing') {
      return { type: 'progress', progress: { phase: 'writing' } };
    }
    if (phase === 'installing') {
      const command = input['command'];
      return {
        type: 'progress',
        progress: { phase: 'installing', ...(typeof command === 'string' ? { command } : {}) },
      };
    }
    return 'malformed';
  }
  if (type === 'written') {
    const directory = input['directory'];
    const files = count(input['files']);
    const bytes = count(input['bytes']);
    if (typeof directory !== 'string' || files === undefined || bytes === undefined) {
      return 'malformed';
    }
    return { type: 'progress', progress: { phase: 'written', directory, files, bytes } };
  }
  if (type === 'done') {
    const directory = input['directory'];
    if (typeof input['ok'] !== 'boolean' || typeof directory !== 'string') {
      return 'malformed';
    }
    const installCommand = input['installCommand'];
    const repositoryUrl = input['repositoryUrl'];
    return {
      type: 'done',
      result: {
        ok: input['ok'],
        directory,
        files: strings(input['files']),
        bytes: count(input['bytes']) ?? 0,
        warnings: strings(input['warnings']),
        steps: strings(input['steps']),
        issues: strings(input['issues']),
        installRequested: input['installRequested'] === true,
        // Jamais supposé : seul un `true` explicite du serveur dit « installé ».
        installed: input['installed'] === true,
        ...(typeof installCommand === 'string' && installCommand !== '' ? { installCommand } : {}),
        installIssues: strings(input['installIssues']),
        ...(typeof repositoryUrl === 'string' && repositoryUrl !== '' ? { repositoryUrl } : {}),
        ...(strings(input['githubIssues']).length === 0
          ? {}
          : { githubIssues: strings(input['githubIssues']) }),
      },
    };
  }
  return undefined;
}

/**
 * Lance la génération et suit son avancement jusqu'au bout.
 *
 * `cancelled` arrête le **suivi** : la route va au bout de ce qu'elle a
 * commencé, et l'écran doit le dire plutôt que de laisser croire que rien n'a
 * été écrit.
 */
export async function streamGeneration(
  request: GenerateStreamRequest,
  options: GenerateStreamOptions = {},
): Promise<GenerateStreamOutcome> {
  const doFetch: GenerateFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const idle = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const seconds = Math.max(1, Math.round(idle / 1000));
  const controller = new AbortController();
  const caller = options.signal;

  let cancelled = false;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopClock = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
  const abort = (): void => {
    stopClock();
    controller.abort();
  };
  const arm = (): void => {
    stopClock();
    if (idle > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        abort();
      }, idle);
    }
  };
  const onCallerAbort = (): void => {
    cancelled = true;
    abort();
  };

  if (caller?.aborted === true) {
    return { kind: 'cancelled' };
  }
  caller?.addEventListener('abort', onCallerAbort);

  try {
    const response = await doFetch(options.url ?? '/api/generate', {
      method: 'POST',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      return { kind: 'failed', failure: { reason: 'http', status: response.status } };
    }
    const body = response.body;
    if (body === null) {
      return { kind: 'failed', failure: { reason: 'malformed' } };
    }

    arm();
    const reader = body.getReader();
    const decoder = new TextDecoder();
    // Une promesse qui ne rejette jamais : la course avec `read()` reste propre
    // même quand l'annulation n'interrompt pas la lecture (flux simulé).
    const aborted = new Promise<'aborted'>((resolve) => {
      if (controller.signal.aborted) {
        resolve('aborted');
        return;
      }
      controller.signal.addEventListener('abort', () => resolve('aborted'), { once: true });
    });

    let buffer = '';
    try {
      for (;;) {
        const read = await Promise.race([reader.read(), aborted]);
        if (read === 'aborted' || read.done) {
          break;
        }
        arm();
        buffer = `${buffer}${decoder.decode(read.value, { stream: true })}`.replace(/\r\n/g, '\n');

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = parseGenerateEvent(block);
          if (event === 'malformed') {
            return { kind: 'failed', failure: { reason: 'malformed' } };
          }
          if (event?.type === 'done') {
            return { kind: 'done', result: event.result };
          }
          if (event !== undefined) {
            options.onProgress?.(event.progress);
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      void reader.cancel().catch(() => undefined);
    }

    if (cancelled) {
      return { kind: 'cancelled' };
    }
    return {
      kind: 'failed',
      failure: timedOut ? { reason: 'timeout', seconds } : { reason: 'incomplete' },
    };
  } catch {
    if (cancelled) {
      return { kind: 'cancelled' };
    }
    return {
      kind: 'failed',
      failure: timedOut ? { reason: 'timeout', seconds } : { reason: 'network' },
    };
  } finally {
    stopClock();
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

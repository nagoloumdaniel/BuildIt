'use client';

import type { ProjectSummaryView } from '../open/project';
import type { CloneResultView } from './clone';
import {
  type ClonePhase,
  type CloneProgress,
  isClonePhase,
  mergeCloneProgress,
  overallPercent,
} from './progress';

/**
 * Le suivi du clone, côté navigateur.
 *
 * Pourquoi `fetch` et pas `EventSource` : l'événement serveur natif ne sait
 * faire que des `GET`. Ici le clone part d'un `POST` (lien, dossier, options,
 * parent choisi), donc on lit le flux à la main et on y gagne la seule chose
 * qui manquait vraiment : un `AbortSignal` pour arrêter le suivi.
 *
 * Ce que ce module ne fait pas : il ne décide de rien. Il pousse une mesure
 * déjà **monotone** (la phase ne recule jamais), il rend un résultat, et il
 * distingue trois fins aboutie, interrompue par l'utilisateur, interrompue
 * par la liaison. Les phrases qui les racontent vivent dans l'i18n de l'écran.
 *
 * Le silence du serveur est borné : sans événement pendant
 * `DEFAULT_IDLE_TIMEOUT_MS`, le suivi s'arrête au lieu de tourner sans fin.
 * C'est la promesse que l'écran doit tenir voir le `done` manquant, un flux
 * coupé et un serveur muet comme trois échecs distincts, jamais comme une barre
 * qui tourne.
 */

/** Sans événement pendant une minute, on considère le suivi perdu. */
export const DEFAULT_IDLE_TIMEOUT_MS = 60_000;

/** Ce que le navigateur envoie : exactement ce que la route lit. */
export interface CloneStreamRequest {
  readonly link: string;
  readonly folder: string;
  readonly install: boolean;
  readonly ignoreScripts: boolean;
  /** Le dossier parent absolu choisi dans l'explorateur ignoré en hébergé. */
  readonly parent?: string;
}

/** Pourquoi le suivi s'est arrêté la phrase est choisie par l'écran. */
export type CloneStreamFailure =
  | { readonly reason: 'timeout'; readonly seconds: number }
  | { readonly reason: 'network' }
  | { readonly reason: 'http'; readonly status: number }
  | { readonly reason: 'malformed' }
  | { readonly reason: 'incomplete' };

export type CloneStreamOutcome =
  | { readonly kind: 'done'; readonly result: CloneResultView }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly failure: CloneStreamFailure };

/**
 * Le `fetch` injectable : la même forme que celle du dépôt (voir
 * `github/server-deps.ts`), pour que les tests fournissent un faux sans réseau.
 */
export type CloneFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface CloneStreamOptions {
  /** L'annulation demandée par l'utilisateur le bouton « Annuler ». */
  readonly signal?: AbortSignal;
  /** Chaque mesure retenue, déjà fusionnée avec la précédente. */
  readonly onProgress?: (progress: CloneProgress) => void;
  /** Injecté par les tests ; `fetch` sinon. */
  readonly fetch?: CloneFetch;
  /** Borné par défaut à une minute de silence. `0` désarme la surveillance. */
  readonly idleTimeoutMs?: number;
  readonly url?: string;
}

/** Un événement `done`, tel que la route le pousse. */
interface CloneDoneEvent {
  readonly type: 'done';
  readonly ok: boolean;
  readonly directory: string;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly installed: boolean;
  readonly installCommand?: string;
  readonly project?: ProjectSummaryView;
}

type CloneStreamEvent =
  | {
      readonly type: 'progress';
      readonly phase: ClonePhase;
      readonly percent: number;
      readonly detail?: string;
    }
  | { readonly type: 'phase'; readonly phase: ClonePhase }
  | CloneDoneEvent;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(value: unknown): readonly string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? (value as readonly string[])
    : undefined;
}

/**
 * La charge utile d'un bloc d'événement, ou `undefined` pour un bloc vide,
 * un commentaire (`: keep-alive`) ou un champ qu'on ne lit pas.
 */
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
 * Un bloc devient un événement connu, rien du tout (événement d'un autre type),
 * ou `'malformed'` la réponse n'est pas celle qu'on attendait.
 *
 * Rien n'est cru sur parole : ce qui vient du réseau est revalidé champ par
 * champ, y compris la phase et le pourcentage.
 */
export function parseCloneEvent(block: string): CloneStreamEvent | 'malformed' | undefined {
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
  if (type === 'progress') {
    const phase = input['phase'];
    const percent = input['percent'];
    if (!isClonePhase(phase) || typeof percent !== 'number' || !Number.isFinite(percent)) {
      return 'malformed';
    }
    const detail = input['detail'];
    return {
      type: 'progress',
      phase,
      percent,
      ...(typeof detail === 'string' ? { detail } : {}),
    };
  }
  if (type === 'phase') {
    const phase = input['phase'];
    return isClonePhase(phase) ? { type: 'phase', phase } : 'malformed';
  }
  if (type === 'done') {
    const directory = input['directory'];
    // L'essentiel du résultat : a-t-il réussi, et où. Le reste tolère
    // l'absence un clone abouti ne doit pas passer pour illisible parce
    // qu'un champ facultatif manque.
    if (typeof input['ok'] !== 'boolean' || typeof directory !== 'string') {
      return 'malformed';
    }
    const installCommand = input['installCommand'];
    const project = record(input['project']);
    return {
      type: 'done',
      ok: input['ok'],
      directory,
      issues: strings(input['issues']) ?? [],
      warnings: strings(input['warnings']) ?? [],
      installed: input['installed'] === true,
      ...(typeof installCommand === 'string' ? { installCommand } : {}),
      ...(project === undefined ? {} : { project: project as unknown as ProjectSummaryView }),
    };
  }
  // Un type inconnu est une extension du serveur, pas une réponse cassée.
  return undefined;
}

function resultOf(event: CloneDoneEvent): CloneResultView {
  return {
    ok: event.ok,
    directory: event.directory,
    issues: [...event.issues],
    warnings: [...event.warnings],
    installed: event.installed,
    ...(event.installCommand === undefined ? {} : { installCommand: event.installCommand }),
    ...(event.project === undefined ? {} : { project: event.project }),
  };
}

/** La phase annoncée par la route, sans mesure : son pourcentage de départ. */
function phaseProgress(phase: ClonePhase): CloneProgress {
  return { phase, percent: overallPercent(phase, 0) };
}

/**
 * Lance le clone et suit son avancement jusqu'au bout.
 *
 * Rend toujours un résultat : `done` (abouti ou refusé par le moteur),
 * `cancelled` (l'utilisateur a arrêté le **suivi** le clone, lui, peut
 * continuer côté serveur), ou `failed` avec sa raison.
 */
export async function streamClone(
  request: CloneStreamRequest,
  options: CloneStreamOptions = {},
): Promise<CloneStreamOutcome> {
  const doFetch: CloneFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
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

  // Un signal déjà rompu : on n'ouvre même pas la requête. Le clone n'a pas
  // commencé, et il n'y a rien à suivre.
  if (caller?.aborted === true) {
    return { kind: 'cancelled' };
  }
  caller?.addEventListener('abort', onCallerAbort);

  const failure = (): CloneStreamFailure =>
    timedOut ? { reason: 'timeout', seconds } : { reason: 'network' };

  try {
    const response = await doFetch(options.url ?? '/api/clone', {
      method: 'POST',
      headers: { accept: 'text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      stopClock();
      return { kind: 'failed', failure: { reason: 'http', status: response.status } };
    }
    const body = response.body;
    if (body === null) {
      stopClock();
      return { kind: 'failed', failure: { reason: 'malformed' } };
    }

    arm();
    const reader = body.getReader();
    const decoder = new TextDecoder();
    // Une promesse qui ne rejette jamais : la course avec `read()` reste
    // propre même si l'annulation n'interrompt pas la lecture (c'est le cas
    // d'un `fetch` simulé, et d'un flux déjà en tampon).
    const aborted = new Promise<'aborted'>((resolve) => {
      if (controller.signal.aborted) {
        resolve('aborted');
        return;
      }
      controller.signal.addEventListener('abort', () => resolve('aborted'), { once: true });
    });

    let buffer = '';
    let previous: CloneProgress | null = null;

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
          const event = parseCloneEvent(block);
          if (event === 'malformed') {
            return { kind: 'failed', failure: { reason: 'malformed' } };
          }
          if (event !== undefined) {
            if (event.type === 'done') {
              stopClock();
              return { kind: 'done', result: resultOf(event) };
            }
            const next: CloneProgress =
              event.type === 'progress'
                ? {
                    phase: event.phase,
                    percent: event.percent,
                    ...(event.detail === undefined ? {} : { detail: event.detail }),
                  }
                : phaseProgress(event.phase);
            previous = mergeCloneProgress(previous, next);
            options.onProgress?.(previous);
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
    return { kind: 'failed', failure: failure() };
  } finally {
    stopClock();
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

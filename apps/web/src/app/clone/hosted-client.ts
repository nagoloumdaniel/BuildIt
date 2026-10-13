'use client';

import {
  decodeBase64,
  openProjectFolder,
  type WritableDirectory,
  writeFileAt,
} from '../../lib/browser-write';
import type { ProjectSummaryView } from '../open/project';
import {
  type HostedAction,
  type HostedError,
  type HostedPlanView,
  parseHostedError,
  parseHostedEvent,
  parseHostedPlan,
} from './hosted-protocol';

/**
 * La copie hébergée, côté navigateur.
 *
 * Le serveur envoie le dépôt fichier par fichier (NDJSON) ; ce module les
 * écrit dans le dossier choisi par l'utilisateur au fil de l'eau, et compte ce
 * qui est **réellement** écrit : c'est la seule mesure que la barre affiche.
 *
 * La lecture du flux et l'écriture ne s'attendent pas l'une l'autre : le flux
 * est lu aussi vite que le réseau le permet (la fonction serveur se termine
 * vite), et les écritures s'enchaînent derrière, dans l'ordre. Une écriture
 * qui échoue arrête tout, et le nombre de fichiers déjà écrits est rendu : le
 * dossier n'est pas nettoyé (le navigateur ne sait pas supprimer ce qu'il a
 * créé sans redemander), l'écran le dit.
 */

/** Sans rien recevoir pendant une minute, la copie est considérée perdue. */
export const HOSTED_IDLE_TIMEOUT_MS = 60_000;

export type HostedFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Ce qui a arrêté la copie : une erreur du serveur, ou une du navigateur. */
export type HostedFailure =
  | HostedError
  | { readonly code: 'taken'; readonly detail?: string }
  | { readonly code: 'write'; readonly detail?: string }
  | { readonly code: 'malformed' }
  | { readonly code: 'incomplete' }
  | { readonly code: 'timeout'; readonly seconds: number }
  /** L'explorateur du navigateur n'a pas pu s'ouvrir. */
  | { readonly code: 'picker' };

export type HostedProgress =
  | { readonly phase: 'downloading'; readonly received: number }
  | { readonly phase: 'writing'; readonly written: number; readonly total: number };

export interface HostedCopyResult {
  /** `<dossier choisi>/<nom>` : le navigateur ne donne pas le chemin complet. */
  readonly directory: string;
  readonly written: number;
  readonly bytes: number;
  readonly skipped: readonly string[];
  readonly symlinks: readonly string[];
  readonly project?: ProjectSummaryView;
  readonly installCommand?: string;
}

export type HostedCopyOutcome =
  | { readonly kind: 'done'; readonly result: HostedCopyResult }
  | { readonly kind: 'cancelled'; readonly written: number; readonly directory: string }
  | {
      readonly kind: 'failed';
      readonly failure: HostedFailure;
      readonly written: number;
      readonly directory: string;
    };

export interface HostedOptions {
  readonly fetch?: HostedFetch;
  readonly signal?: AbortSignal;
  readonly idleTimeoutMs?: number;
  readonly url?: string;
}

const URL_DEFAULT = '/api/clone-archive';

function post(
  options: HostedOptions,
  action: HostedAction,
  link: string,
  folder: string,
  signal?: AbortSignal,
): Promise<Response> {
  const doFetch: HostedFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  return doFetch(options.url ?? URL_DEFAULT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action, link, folder }),
    cache: 'no-store',
    ...(signal === undefined ? {} : { signal }),
  });
}

/** L'erreur portée par une réponse refusée, ou une erreur HTTP nue. */
async function refusalOf(response: Response): Promise<HostedError> {
  try {
    const body = (await response.json()) as { readonly error?: unknown };
    return parseHostedError(body.error) ?? { code: 'http', status: response.status };
  } catch {
    return { code: 'http', status: response.status };
  }
}

/** La vérification du lien. `undefined` : le serveur n'a pas répondu. */
export async function checkHostedCopy(
  link: string,
  folder: string,
  options: HostedOptions = {},
): Promise<HostedPlanView | undefined> {
  try {
    const response = await post(options, 'plan', link, folder, options.signal);
    if (!response.ok) {
      return undefined;
    }
    return parseHostedPlan(await response.json());
  } catch {
    return undefined;
  }
}

/** Une horloge de silence : `arm()` la relance, `fired` dit si elle a sonné. */
function idleClock(ms: number, onFire: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const state = { fired: false };
  return {
    state,
    arm(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      if (ms > 0) {
        timer = setTimeout(() => {
          state.fired = true;
          onFire();
        }, ms);
      }
    },
    stop(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export interface CopyRequest {
  readonly link: string;
  readonly folder: string;
  /** Le dossier choisi dans l'explorateur ; `<folder>` y sera créé. */
  readonly parent: WritableDirectory;
  readonly onProgress?: (progress: HostedProgress) => void;
}

/**
 * Copie le dépôt dans `<parent>/<folder>/`.
 *
 * Le dossier est réservé **avant** la requête : un dossier déjà rempli est
 * refusé sans rien télécharger.
 */
export async function copyToFolder(
  request: CopyRequest,
  options: HostedOptions = {},
): Promise<HostedCopyOutcome> {
  const opened = await openProjectFolder(request.parent, request.folder);
  if (!opened.ok) {
    return {
      kind: 'failed',
      failure:
        opened.reason === 'taken'
          ? { code: 'taken' }
          : { code: 'write', ...(opened.detail === undefined ? {} : { detail: opened.detail }) },
      written: 0,
      directory: opened.directory,
    };
  }
  const { root, directory } = opened;
  const idle = options.idleTimeoutMs ?? HOSTED_IDLE_TIMEOUT_MS;
  const controller = new AbortController();
  const clock = idleClock(idle, () => controller.abort());
  const caller = options.signal;
  let cancelled = false;
  const onCallerAbort = (): void => {
    cancelled = true;
    controller.abort();
  };
  if (caller?.aborted === true) {
    return { kind: 'cancelled', written: 0, directory };
  }
  caller?.addEventListener('abort', onCallerAbort);

  let written = 0;
  let total = 0;
  let writeError: string | undefined;
  let chain: Promise<void> = Promise.resolve();
  const seconds = Math.max(1, Math.round(idle / 1000));

  // Une erreur du serveur n'efface pas ce qui est déjà arrivé : les fichiers
  // reçus finissent de s'écrire, puis tout s'arrête. Le compte rendu dit
  // exactement ce qui est sur le disque.
  const failed = async (failure: HostedFailure): Promise<HostedCopyOutcome> => {
    clock.stop();
    await chain;
    controller.abort();
    return { kind: 'failed', failure, written, directory };
  };
  const lost = async (): Promise<HostedCopyOutcome> => {
    await chain;
    if (cancelled) {
      return { kind: 'cancelled', written, directory };
    }
    if (writeError !== undefined) {
      return { kind: 'failed', failure: { code: 'write', detail: writeError }, written, directory };
    }
    return {
      kind: 'failed',
      failure: clock.state.fired ? { code: 'timeout', seconds } : { code: 'network' },
      written,
      directory,
    };
  };

  try {
    clock.arm();
    let response: Response;
    try {
      response = await post(options, 'files', request.link, request.folder, controller.signal);
    } catch {
      return await lost();
    }
    if (!response.ok) {
      return await failed(await refusalOf(response));
    }
    const body = response.body;
    if (body === null) {
      return await failed({ code: 'malformed' });
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    const aborted = new Promise<'aborted'>((resolve) => {
      if (controller.signal.aborted) {
        resolve('aborted');
        return;
      }
      controller.signal.addEventListener('abort', () => resolve('aborted'), { once: true });
    });
    let buffer = '';
    let manifest: Omit<HostedCopyResult, 'directory' | 'written'> | undefined;
    let received = 0;

    try {
      for (;;) {
        const pending = reader.read();
        // Annulé, le flux rejette sa lecture en cours : personne ne l'attend
        // plus (la course est déjà gagnée par `aborted`), on l'éteint ici.
        pending.catch(() => undefined);
        const read = await Promise.race([pending, aborted]);
        if (read === 'aborted') {
          break;
        }
        // La dernière ligne peut arriver sans retour à la ligne final : on la
        // termine nous-mêmes pour qu'elle soit lue comme les autres.
        const last = read.done;
        if (last) {
          buffer += `${decoder.decode()}
`;
        } else {
          clock.arm();
          buffer += decoder.decode(read.value, { stream: true });
        }
        let newline = buffer.indexOf('\n');
        while (newline !== -1) {
          const event = parseHostedEvent(buffer.slice(0, newline));
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf('\n');
          if (event === undefined) {
            continue;
          }
          if (event === 'malformed') {
            return await failed({ code: 'malformed' });
          }
          switch (event.type) {
            case 'download':
              request.onProgress?.({ phase: 'downloading', received: event.received });
              break;
            case 'manifest':
              total = event.total;
              manifest = {
                bytes: event.bytes,
                skipped: event.skipped,
                symlinks: event.symlinks,
                ...(event.project === undefined ? {} : { project: event.project }),
                ...(event.installCommand === undefined
                  ? {}
                  : { installCommand: event.installCommand }),
              };
              request.onProgress?.({ phase: 'writing', written: 0, total });
              break;
            case 'file': {
              if (manifest === undefined) {
                return await failed({ code: 'malformed' });
              }
              received += 1;
              const { path, data } = event;
              chain = chain.then(async () => {
                if (writeError !== undefined || controller.signal.aborted) {
                  return;
                }
                try {
                  await writeFileAt(root, path, decodeBase64(data));
                  written += 1;
                  request.onProgress?.({ phase: 'writing', written, total });
                } catch (error) {
                  writeError = `${path} : ${String(error)}`;
                  controller.abort();
                }
              });
              break;
            }
            case 'error':
              return await failed(event.error);
            default: {
              // `done` : tout est parti du serveur. Reste à finir d'écrire.
              if (manifest === undefined || event.sent !== received) {
                return await failed({ code: 'malformed' });
              }
              // Le flux est fini : l'horloge de silence ne doit pas couper les
              // écritures encore en file, qui peuvent prendre plus d'une minute.
              clock.stop();
              await chain;
              if (writeError !== undefined) {
                return {
                  kind: 'failed',
                  failure: { code: 'write', detail: writeError },
                  written,
                  directory,
                };
              }
              if (cancelled) {
                return { kind: 'cancelled', written, directory };
              }
              return { kind: 'done', result: { ...manifest, directory, written } };
            }
          }
        }
        if (last) {
          break;
        }
      }
    } catch {
      // Le flux a rompu en cours de lecture : liaison perdue, ou annulation.
      return await lost();
    } finally {
      void reader.cancel().catch(() => undefined);
    }
    if (cancelled || writeError !== undefined || clock.state.fired) {
      return await lost();
    }
    return await failed({ code: 'incomplete' });
  } finally {
    clock.stop();
    caller?.removeEventListener('abort', onCallerAbort);
  }
}

export type ZipDownloadOutcome =
  | {
      readonly kind: 'done';
      readonly blob: Blob;
      readonly fileName: string;
      readonly bytes: number;
    }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed'; readonly failure: HostedFailure };

/**
 * L'archive du dépôt, pour un navigateur qui ne sait pas écrire dans un
 * dossier. L'avancement est en octets reçus : GitHub n'annonce pas la taille
 * d'une archive fabriquée à la volée, et on n'en invente pas.
 */
export async function downloadRepositoryZip(
  link: string,
  folder: string,
  onBytes?: (received: number) => void,
  options: HostedOptions = {},
): Promise<ZipDownloadOutcome> {
  const caller = options.signal;
  // Une fonction, pas une lecture directe : le compilateur garderait sinon le
  // « faux » vu à l'entrée, alors que l'annulation arrive pendant l'attente.
  const aborted = (): boolean => caller?.aborted === true;
  if (aborted()) {
    return { kind: 'cancelled' };
  }
  try {
    const response = await post(options, 'zip', link, folder, caller);
    if (!response.ok) {
      return { kind: 'failed', failure: await refusalOf(response) };
    }
    const body = response.body;
    if (body === null) {
      return { kind: 'failed', failure: { code: 'malformed' } };
    }
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const read = await reader.read();
      if (read.done) {
        break;
      }
      chunks.push(read.value);
      received += read.value.byteLength;
      onBytes?.(received);
    }
    return {
      kind: 'done',
      blob: new Blob(chunks as BlobPart[], { type: 'application/zip' }),
      fileName: `${folder}.zip`,
      bytes: received,
    };
  } catch {
    return aborted() ? { kind: 'cancelled' } : { kind: 'failed', failure: { code: 'network' } };
  }
}

/** Remet l'archive au navigateur, qui l'enregistre comme tout téléchargement. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

import { parseRemote } from '@buildit/git';
import {
  type ArchiveDownloadFailure,
  type ArchiveFetch,
  type ArchiveLimits,
  boundedBody,
  CLONE_ARCHIVE_LIMITS,
  type ExtractFailure,
  exceedsDeclared,
  extractRepository,
  openArchive,
  type RepositoryFile,
  readBounded,
} from '../../lib/clone-archive';
import { describeIssues } from '../github/session';
import { inspectPickedEntries } from '../open/project';
import { defaultFolder, validFolderName } from './destination';
import type {
  HostedAction,
  HostedCopyRequest,
  HostedError,
  HostedEvent,
  HostedPlanView,
} from './hosted-protocol';

/**
 * La copie d'un dépôt **en mode hébergé**, côté serveur (`/api/clone-archive`).
 *
 * Ce que faisait l'écran avant, en production : il envoyait le lien à
 * `/api/clone`, qui lançait `git clone` **dans la fonction Vercel**, vers
 * `~/buildit/<dossier>`. Il n'y a pas de `git` dans ce runtime, le disque y est
 * en lecture seule hors de `/tmp`, et même un clone réussi serait resté sur une
 * machine que l'utilisateur ne verra jamais. Le clone échouait donc toujours,
 * avec un refus qui ne disait pas pourquoi.
 *
 * Ici, aucun `git` : l'archive GitHub du dépôt est téléchargée et ouverte en
 * mémoire, puis ses fichiers partent un par un vers le navigateur, qui les
 * écrit dans le dossier que l'utilisateur a choisi dans son explorateur.
 *
 * Tout est injectable (`fetch`, jeton, limites) : le module se teste sans
 * réseau et sans requête Next.
 */

export interface HostedPlan {
  readonly view: HostedPlanView;
  readonly github?: { readonly owner: string; readonly repo: string };
}

const ACTIONS: readonly HostedAction[] = ['plan', 'files', 'zip'];

function record(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

/** Le corps de la requête, ou `undefined` si l'action n'est pas connue. */
export function readHostedRequest(body: unknown): HostedCopyRequest | undefined {
  const input = record(body);
  const action = input['action'];
  if (typeof action !== 'string' || !ACTIONS.includes(action as HostedAction)) {
    return undefined;
  }
  const link = input['link'];
  const folder = input['folder'];
  return {
    action: action as HostedAction,
    link: typeof link === 'string' ? link : '',
    folder: typeof folder === 'string' ? folder : '',
  };
}

/**
 * Le lien est-il copiable **ici** ?
 *
 * Seul GitHub rend une archive téléchargeable sans `git` ; un autre hôte
 * (GitLab, un serveur d'entreprise, un lien SSH quelconque) n'a pas d'API
 * commune. Le dire, et donner la commande, vaut mieux que de faire semblant.
 */
export function planHostedCopy(link: string, folder: string): HostedPlan {
  const parsed = parseRemote(link);
  if (!parsed.ok) {
    return {
      view: {
        ok: false,
        label: '',
        url: '',
        folder: '',
        github: false,
        error: { code: 'link' },
        issues: describeIssues(parsed.issues),
      },
    };
  }
  const remote = parsed.value;
  const chosen = folder.trim() === '' ? (defaultFolder(remote) ?? '') : folder.trim();
  const github = remote.github;
  const label = github === undefined ? remote.url : `${github.owner}/${github.repo}`;
  const base = { label, url: remote.url, folder: chosen, github: github !== undefined };
  if (github === undefined) {
    return { view: { ...base, ok: false, error: { code: 'notGithub' }, issues: [] } };
  }
  if (!validFolderName(chosen)) {
    return {
      view: {
        ...base,
        ok: false,
        error: { code: 'folder' },
        issues: [
          'Le nom du dossier n’accepte que lettres, chiffres, points, tirets et soulignés, et aucun séparateur de chemin.',
        ],
      },
      github,
    };
  }
  return { view: { ...base, ok: true, issues: [] }, github };
}

/** L'échec d'ouverture de l'archive, dit dans le vocabulaire de l'écran. */
export function downloadError(failure: ArchiveDownloadFailure): HostedError {
  switch (failure.code) {
    case 'http':
      return { code: 'http', status: failure.status };
    case 'cancelled':
      return { code: 'network' };
    default:
      return { code: failure.code };
  }
}

/** Le statut HTTP qui accompagne une erreur rendue avant le flux. */
export function statusOf(error: HostedError): number {
  switch (error.code) {
    case 'notFound':
      return 404;
    case 'unauthorized':
      return 401;
    case 'rateLimited':
      return 429;
    case 'archiveTooLarge':
      return 413;
    case 'link':
    case 'folder':
    case 'notGithub':
      return 422;
    default:
      return 502;
  }
}

/** Le refus de l'archive, dans le vocabulaire de l'écran. */
export function extractError(failure: ExtractFailure, limits: ArchiveLimits): HostedError {
  switch (failure.reason) {
    case 'tooManyFiles':
      return { code: 'tooManyFiles', limit: limits.maxFiles };
    case 'tooLarge':
      return { code: 'tooLarge', limit: limits.maxTotalBytes };
    case 'fileTooLarge':
      return { code: 'fileTooLarge', limit: limits.maxFileBytes, ...detailOf(failure) };
    case 'unsafePath':
      return { code: 'unsafePath', detail: failure.detail };
    case 'corrupt':
      return { code: 'corrupt', ...detailOf(failure) };
    default:
      // Chiffrée, zip64, méthode inconnue, pas une archive : rien que l'écran
      // puisse corriger. La raison brute part dans le détail.
      return { code: 'unsupported', detail: failure.reason };
  }
}

function detailOf(failure: { readonly detail?: string }): { readonly detail?: string } {
  return failure.detail === undefined ? {} : { detail: failure.detail };
}

export interface HostedDeps {
  readonly fetch?: ArchiveFetch;
  /** Le jeton GitHub du visiteur. Ne sort jamais vers le navigateur. */
  readonly token?: string;
  readonly limits?: ArchiveLimits;
  readonly signal?: AbortSignal;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(error: HostedError): Response {
  return json({ error }, statusOf(error));
}

/** Ne pas inonder le navigateur : un événement de téléchargement tous les 256 Kio. */
const DOWNLOAD_STEP = 256 * 1024;

function line(event: HostedEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

/**
 * Le flux NDJSON des fichiers.
 *
 * `start` télécharge et ouvre l'archive (en poussant les octets reçus), puis
 * annonce le manifeste : nombre de fichiers, octets, noms écartés, projet
 * reconnu. `pull` envoie ensuite **un fichier à la fois**, au rythme où le
 * navigateur lit : le serveur ne décompresse jamais tout le dépôt d'avance.
 */
function filesStream(response: Response, folder: string, limits: ArchiveLimits): Response {
  let files: readonly RepositoryFile[] = [];
  let index = 0;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stop = (error: HostedError): void => {
        controller.enqueue(line({ type: 'error', error }));
        controller.close();
        finished = true;
      };
      let announced = 0;
      let read: Awaited<ReturnType<typeof readBounded>>;
      try {
        read = await readBounded(response, limits.maxArchiveBytes, (received) => {
          if (received - announced >= DOWNLOAD_STEP) {
            announced = received;
            controller.enqueue(line({ type: 'download', received }));
          }
        });
      } catch {
        stop({ code: 'network' });
        return;
      }
      if (!read.ok) {
        stop({ code: 'archiveTooLarge', limit: limits.maxArchiveBytes });
        return;
      }
      controller.enqueue(line({ type: 'download', received: read.data.length }));
      const extracted = extractRepository(read.data, limits);
      if (!extracted.ok) {
        stop(extractError(extracted.failure, limits));
        return;
      }
      const value = extracted.value;
      files = value.files;
      const inspection = inspectPickedEntries({
        name: folder,
        names: value.rootNames,
        ...(value.packageJson === undefined ? {} : { packageJson: value.packageJson }),
      });
      const project = inspection.ok ? inspection.value : undefined;
      const installCommand = project?.plainCommand ?? project?.manualCommand;
      controller.enqueue(
        line({
          type: 'manifest',
          total: files.length,
          bytes: value.bytes,
          skipped: value.skipped,
          symlinks: value.symlinks,
          ...(project === undefined ? {} : { project }),
          ...(installCommand === undefined ? {} : { installCommand }),
        }),
      );
    },
    pull(controller) {
      if (finished) {
        return;
      }
      const file = files[index];
      if (file === undefined) {
        controller.enqueue(line({ type: 'done', sent: index }));
        controller.close();
        finished = true;
        return;
      }
      index += 1;
      let data: Buffer;
      try {
        data = file.read();
      } catch {
        controller.enqueue(line({ type: 'error', error: { code: 'corrupt', detail: file.path } }));
        controller.close();
        finished = true;
        return;
      }
      controller.enqueue(line({ type: 'file', path: file.path, data: data.toString('base64') }));
    },
    cancel() {
      finished = true;
    },
  });

  return new Response(stream, {
    headers: {
      'cache-control': 'no-store, no-transform',
      'content-type': 'application/x-ndjson; charset=utf-8',
      'x-accel-buffering': 'no',
    },
  });
}

/**
 * La réponse de `/api/clone-archive` pour un corps déjà lu.
 *
 * Les refus connus **avant** le flux (lien, hôte, dépôt introuvable, quota)
 * partent avec un vrai statut HTTP et un JSON : l'écran les lit sans avoir à
 * ouvrir de flux.
 */
export async function hostedResponse(body: unknown, deps: HostedDeps = {}): Promise<Response> {
  const request = readHostedRequest(body);
  if (request === undefined) {
    return errorResponse({ code: 'link', detail: 'action' });
  }
  const plan = planHostedCopy(request.link, request.folder);
  if (request.action === 'plan') {
    return json(plan.view);
  }
  if (plan.github === undefined || !plan.view.ok) {
    return errorResponse(plan.view.error ?? { code: 'link' });
  }
  const limits = deps.limits ?? CLONE_ARCHIVE_LIMITS;
  const opened = await openArchive(plan.github.owner, plan.github.repo, {
    ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
    ...(deps.token === undefined ? {} : { token: deps.token }),
    ...(deps.signal === undefined ? {} : { signal: deps.signal }),
  });
  if (!opened.ok) {
    return errorResponse(downloadError(opened.failure));
  }
  if (request.action === 'files') {
    return filesStream(opened.response, plan.view.folder, limits);
  }

  const archive = opened.response.body;
  if (exceedsDeclared(opened.response, limits.maxArchiveBytes)) {
    void archive?.cancel().catch(() => undefined);
    return errorResponse({ code: 'archiveTooLarge', limit: limits.maxArchiveBytes });
  }
  if (archive === null) {
    return errorResponse({ code: 'corrupt' });
  }
  return new Response(boundedBody(archive, limits.maxArchiveBytes), {
    headers: {
      'cache-control': 'no-store, no-transform',
      'content-type': 'application/zip',
      // Le nom est déjà validé (lettres, chiffres, `.`, `-`, `_`) : rien à échapper.
      'content-disposition': `attachment; filename="${plan.view.folder}.zip"`,
    },
  });
}

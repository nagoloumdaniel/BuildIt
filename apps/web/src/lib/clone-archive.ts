import { classifyArchivePath, commonRoot, stripRoot } from './clone-paths';
import { listZip, type ZipFailure, type ZipLimits } from './clone-zip';

/**
 * Récupérer un dépôt GitHub **sans `git`** : l'archive de l'API, ouverte ici.
 *
 * C'est le chemin de la version hébergée. Une fonction Vercel n'a pas de
 * binaire `git`, et même si elle en avait un, elle clonerait sur son propre
 * disque, éphémère, que l'utilisateur ne verra jamais. GitHub, lui, sait rendre
 * l'état d'une branche sous forme de `.zip` (`/repos/{o}/{r}/zipball`) : le
 * serveur le télécharge, l'ouvre, et rend les fichiers au navigateur, qui les
 * écrit dans le dossier choisi.
 *
 * Ce que ce n'est pas, et que l'écran dit avant de commencer : un clone. Pas
 * de `.git`, pas d'historique, pas de branches. Une copie des fichiers de la
 * branche par défaut.
 *
 * Le jeton GitHub de l'utilisateur sert à lire un dépôt privé. Il ne quitte
 * jamais le serveur : il part vers `api.github.com`, et l'archive revient sans
 * lui. La redirection de GitHub vers `codeload.github.com` porte sa propre
 * autorisation de courte durée ; `fetch` retire l'en-tête `authorization` en
 * changeant d'origine, comme le veut la norme.
 */

export { type ArchiveLimits, CLONE_ARCHIVE_LIMITS } from './clone-archive-limits';

/** Le `fetch` injectable, de la même forme que celui des autres modules. */
export type ArchiveFetch = (url: string, init: RequestInit) => Promise<Response>;

export function githubArchiveUrl(owner: string, repo: string): string {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/zipball`;
}

export function archiveHeaders(token?: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'BuildIt',
    'x-github-api-version': '2022-11-28',
    ...(token === undefined || token === '' ? {} : { authorization: `Bearer ${token}` }),
  };
}

export type ArchiveDownloadFailure =
  | { readonly code: 'notFound' }
  | { readonly code: 'unauthorized' }
  | { readonly code: 'rateLimited' }
  | { readonly code: 'http'; readonly status: number }
  | { readonly code: 'network' }
  | { readonly code: 'cancelled' };

export interface ArchiveRequestOptions {
  readonly fetch?: ArchiveFetch;
  readonly token?: string;
  readonly signal?: AbortSignal;
}

function failureOf(response: Response): ArchiveDownloadFailure {
  const status = response.status;
  if (status === 404) {
    return { code: 'notFound' };
  }
  if (status === 401) {
    return { code: 'unauthorized' };
  }
  if (status === 429 || (status === 403 && response.headers.get('x-ratelimit-remaining') === '0')) {
    return { code: 'rateLimited' };
  }
  return { code: 'http', status };
}

/**
 * Ouvre la réponse de l'archive, sans lire le corps.
 *
 * Un jeton refusé (401 : expiré, révoqué) ne doit pas empêcher de copier un
 * dépôt **public** : on réessaie une fois sans lui. Un 404 sans jeton, lui,
 * reste un 404 : GitHub répond ainsi pour un dépôt privé, et l'écran propose
 * de se connecter.
 */
export async function openArchive(
  owner: string,
  repo: string,
  options: ArchiveRequestOptions = {},
): Promise<
  | { readonly ok: true; readonly response: Response }
  | { readonly ok: false; readonly failure: ArchiveDownloadFailure }
> {
  const doFetch: ArchiveFetch = options.fetch ?? ((url, init) => globalThis.fetch(url, init));
  const attempt = (token?: string): Promise<Response> =>
    doFetch(githubArchiveUrl(owner, repo), {
      headers: archiveHeaders(token),
      redirect: 'follow',
      cache: 'no-store',
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });
  try {
    let response = await attempt(options.token);
    if (response.status === 401 && options.token !== undefined && options.token !== '') {
      response = await attempt();
    }
    return response.ok ? { ok: true, response } : { ok: false, failure: failureOf(response) };
  } catch {
    return {
      ok: false,
      failure: options.signal?.aborted === true ? { code: 'cancelled' } : { code: 'network' },
    };
  }
}

/** La taille annoncée dépasse-t-elle déjà la borne ? Sans annonce, on ne sait pas : non. */
export function exceedsDeclared(response: Response, maxBytes: number): boolean {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN);
  return Number.isFinite(declared) && declared > maxBytes;
}

/**
 * Le même corps, relayé tel quel, mais coupé en erreur au-delà de `maxBytes`.
 *
 * C'est la sortie « archive » des navigateurs qui ne savent pas écrire dans un
 * dossier : le serveur relaie l'archive de GitHub sans la garder en mémoire,
 * et la borne tient quand même.
 */
export function boundedBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  let received = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > maxBytes) {
          controller.error(new Error(`Archive au-delà de ${maxBytes} octets.`));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}

/**
 * Lit un corps de réponse en entier, coupé net au-delà de `maxBytes`.
 *
 * GitHub n'annonce presque jamais la taille d'une archive (elle est fabriquée
 * à la volée) : la borne se tient donc en comptant, pas en lisant un en-tête.
 */
export async function readBounded(
  response: Response,
  maxBytes: number,
  onBytes?: (received: number) => void,
): Promise<{ readonly ok: true; readonly data: Buffer } | { readonly ok: false }> {
  if (exceedsDeclared(response, maxBytes)) {
    void response.body?.cancel().catch(() => undefined);
    return { ok: false };
  }
  const body = response.body;
  if (body === null) {
    return { ok: true, data: Buffer.alloc(0) };
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const read = await reader.read();
    if (read.done) {
      break;
    }
    received += read.value.byteLength;
    if (received > maxBytes) {
      void reader.cancel().catch(() => undefined);
      return { ok: false };
    }
    chunks.push(read.value);
    onBytes?.(received);
  }
  return { ok: true, data: Buffer.concat(chunks) };
}

/** Un fichier du dépôt, prêt à partir vers le navigateur. */
export interface RepositoryFile {
  /** Relatif au dossier du dépôt, en `/`, déjà jugé sûr. */
  readonly path: string;
  readonly size: number;
  read(): Buffer;
}

export interface ExtractedRepository {
  /** Le dossier racine de l'archive (`octocat-hello-1a2b3c4`), s'il y en a un. */
  readonly root?: string;
  readonly files: readonly RepositoryFile[];
  /** Somme des tailles des fichiers retenus. */
  readonly bytes: number;
  /** Les noms que Windows n'écrira pas : écartés, et annoncés. */
  readonly skipped: readonly string[];
  readonly symlinks: readonly string[];
  /** Les fichiers du premier niveau, pour reconnaître le projet. */
  readonly rootNames: readonly string[];
  /** Le texte de `package.json`, s'il existe et reste lisible. */
  readonly packageJson?: string;
}

export type ExtractFailure =
  | ZipFailure
  | { readonly reason: 'unsafePath'; readonly detail: string };

export type ExtractResult =
  | { readonly ok: true; readonly value: ExtractedRepository }
  | { readonly ok: false; readonly failure: ExtractFailure };

/** Au-delà d'un mégaoctet, un `package.json` ne sert pas à reconnaître un projet. */
const MAX_PACKAGE_JSON = 1024 * 1024;

/**
 * Ouvre l'archive et juge chaque chemin **avant** qu'un seul octet ne parte.
 *
 * Une entrée hostile (`..`, chemin absolu) refuse toute l'archive ; un nom que
 * Windows n'écrit pas est écarté et listé.
 */
export function extractRepository(buffer: Buffer, limits: ZipLimits): ExtractResult {
  const listing = listZip(buffer, limits);
  if (!listing.ok) {
    return listing;
  }
  const root = commonRoot([...listing.files.map((file) => file.name), ...listing.symlinks]);
  const files: RepositoryFile[] = [];
  const skipped: string[] = [];
  const rootNames: string[] = [];
  let bytes = 0;
  let packageFile: RepositoryFile | undefined;
  for (const file of listing.files) {
    const verdict = classifyArchivePath(stripRoot(file.name, root));
    if (verdict.kind === 'unsafe') {
      return { ok: false, failure: { reason: 'unsafePath', detail: file.name } };
    }
    if (verdict.kind === 'skip') {
      skipped.push(verdict.path);
      continue;
    }
    const kept: RepositoryFile = { path: verdict.path, size: file.size, read: file.read };
    files.push(kept);
    bytes += file.size;
    if (verdict.segments.length === 1) {
      rootNames.push(verdict.path);
      if (verdict.path === 'package.json') {
        packageFile = kept;
      }
    }
  }
  let packageJson: string | undefined;
  if (packageFile !== undefined && packageFile.size <= MAX_PACKAGE_JSON) {
    try {
      packageJson = packageFile.read().toString('utf8');
    } catch {
      // Illisible ici, il le sera aussi à l'envoi : l'erreur viendra là, avec
      // son nom. La reconnaissance du projet s'en passe.
      packageJson = undefined;
    }
  }
  return {
    ok: true,
    value: {
      ...(root === undefined ? {} : { root }),
      files,
      bytes,
      skipped,
      symlinks: listing.symlinks.map((name) => stripRoot(name, root)),
      rootNames,
      ...(packageJson === undefined ? {} : { packageJson }),
    },
  };
}

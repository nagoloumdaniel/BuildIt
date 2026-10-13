import type { ProjectSummaryView } from '../open/project';

/**
 * Le contrat entre `POST /api/clone-archive` et l'écran, en mode hébergé.
 *
 * Partagé par la route et le navigateur : ce fichier n'importe rien de Node,
 * il n'a que des types et une lecture défensive de ce qui arrive du réseau.
 *
 * Trois demandes :
 * - `plan` : le lien est-il copiable ici ? (GitHub oui, le reste non), avec le
 *   nom de dossier proposé et la commande `git clone` ;
 * - `files` : le dépôt, en NDJSON (une ligne JSON par événement), fichier par
 *   fichier, pour que le navigateur les écrive au fil de l'eau ;
 * - `zip` : l'archive telle que GitHub la rend, pour les navigateurs qui ne
 *   savent pas écrire dans un dossier (Firefox, Safari).
 */

export type HostedAction = 'plan' | 'files' | 'zip';

export interface HostedCopyRequest {
  readonly action: HostedAction;
  readonly link: string;
  readonly folder: string;
}

/**
 * Ce qui a arrêté la copie. La phrase est choisie par l'écran, dans sa langue.
 *
 * `notGithub` n'est pas une panne : un lien hors GitHub ne se copie qu'avec
 * `git`, donc sur la machine de l'utilisateur, et l'écran donne la commande.
 */
export type HostedErrorCode =
  | 'link'
  | 'folder'
  | 'notGithub'
  | 'notFound'
  | 'unauthorized'
  | 'rateLimited'
  | 'archiveTooLarge'
  | 'tooManyFiles'
  | 'tooLarge'
  | 'fileTooLarge'
  | 'unsafePath'
  | 'unsupported'
  | 'corrupt'
  | 'http'
  | 'network';

export interface HostedError {
  readonly code: HostedErrorCode;
  /** Le nom de fichier en cause, ou le refus brut du moteur. */
  readonly detail?: string;
  readonly status?: number;
  /** La borne franchie, en octets ou en fichiers selon le code. */
  readonly limit?: number;
}

/** Ce que la vérification rend : assez pour décider, rien qui engage. */
export interface HostedPlanView {
  readonly ok: boolean;
  /** `propriétaire/dépôt` pour GitHub, le lien sinon. */
  readonly label: string;
  /** Le lien tel que `git clone` le prendrait. */
  readonly url: string;
  readonly folder: string;
  readonly github: boolean;
  readonly error?: HostedError;
  /** Les refus du moteur (lien, dossier), tels quels. */
  readonly issues: readonly string[];
}

export type HostedEvent =
  | { readonly type: 'download'; readonly received: number }
  | {
      readonly type: 'manifest';
      readonly total: number;
      readonly bytes: number;
      readonly skipped: readonly string[];
      readonly symlinks: readonly string[];
      readonly project?: ProjectSummaryView;
      readonly installCommand?: string;
    }
  | { readonly type: 'file'; readonly path: string; readonly data: string }
  | { readonly type: 'done'; readonly sent: number }
  | { readonly type: 'error'; readonly error: HostedError };

const CODES: readonly HostedErrorCode[] = [
  'link',
  'folder',
  'notGithub',
  'notFound',
  'unauthorized',
  'rateLimited',
  'archiveTooLarge',
  'tooManyFiles',
  'tooLarge',
  'fileTooLarge',
  'unsafePath',
  'unsupported',
  'corrupt',
  'http',
  'network',
];

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** Une erreur lue sur le réseau, ou `undefined` si elle n'a pas la forme du contrat. */
export function parseHostedError(value: unknown): HostedError | undefined {
  const input = record(value);
  const code = input?.['code'];
  if (input === undefined || typeof code !== 'string' || !CODES.includes(code as HostedErrorCode)) {
    return undefined;
  }
  const detail = input['detail'];
  const status = count(input['status']);
  const limit = count(input['limit']);
  return {
    code: code as HostedErrorCode,
    ...(typeof detail === 'string' ? { detail } : {}),
    ...(status === undefined ? {} : { status }),
    ...(limit === undefined ? {} : { limit }),
  };
}

/** Une ligne du flux `files`, ou `'malformed'`, ou `undefined` (ligne vide, type inconnu). */
export function parseHostedEvent(line: string): HostedEvent | 'malformed' | undefined {
  if (line.trim() === '') {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return 'malformed';
  }
  const input = record(parsed);
  if (input === undefined) {
    return 'malformed';
  }
  switch (input['type']) {
    case 'download': {
      const received = count(input['received']);
      return received === undefined ? 'malformed' : { type: 'download', received };
    }
    case 'manifest': {
      const total = count(input['total']);
      const bytes = count(input['bytes']);
      if (total === undefined || bytes === undefined) {
        return 'malformed';
      }
      const project = record(input['project']);
      const installCommand = input['installCommand'];
      return {
        type: 'manifest',
        total,
        bytes,
        skipped: strings(input['skipped']),
        symlinks: strings(input['symlinks']),
        ...(project === undefined ? {} : { project: project as unknown as ProjectSummaryView }),
        ...(typeof installCommand === 'string' ? { installCommand } : {}),
      };
    }
    case 'file': {
      const path = input['path'];
      const data = input['data'];
      return typeof path === 'string' && typeof data === 'string'
        ? { type: 'file', path, data }
        : 'malformed';
    }
    case 'done': {
      const sent = count(input['sent']);
      return sent === undefined ? 'malformed' : { type: 'done', sent };
    }
    case 'error': {
      const error = parseHostedError(input['error']);
      return error === undefined ? 'malformed' : { type: 'error', error };
    }
    default:
      return undefined;
  }
}

/** La vérification lue sur le réseau, revalidée champ par champ. */
export function parseHostedPlan(value: unknown): HostedPlanView | undefined {
  const input = record(value);
  if (input === undefined || typeof input['ok'] !== 'boolean') {
    return undefined;
  }
  const label = input['label'];
  const url = input['url'];
  const folder = input['folder'];
  const error = parseHostedError(input['error']);
  return {
    ok: input['ok'],
    label: typeof label === 'string' ? label : '',
    url: typeof url === 'string' ? url : '',
    folder: typeof folder === 'string' ? folder : '',
    github: input['github'] === true,
    ...(error === undefined ? {} : { error }),
    issues: strings(input['issues']),
  };
}

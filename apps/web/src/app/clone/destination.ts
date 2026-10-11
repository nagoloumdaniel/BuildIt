import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import type { GitRemote } from '@project-factory/git';

/**
 * Où le web clone (§6.22, §18bis).
 *
 * Le dossier de destination est **relatif à une racine serveur** et rien
 * d'autre : un chemin absolu venu du navigateur serait une écriture de fichier
 * arbitraire. La racine est celle de la génération (`actions.ts`) — même
 * variable, même défaut —, recopiée ici parce que `actions.ts` est réservé au
 * moteur et n'exporte pas la sienne.
 */

export function webWorkspaceRoot(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const configured = env['PF_WEB_WORKSPACE'];
  return resolve(
    configured === undefined || configured === '' ? join(homedir(), 'project-factory') : configured,
  );
}

/** Un segment de dossier : pas de séparateur, pas de chemin spécial. */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

export interface Destination {
  /** Le dossier tel qu'il sera affiché, en séparateurs `/`. */
  readonly folder: string;
  readonly directory: string;
}

export type DestinationResult =
  | { readonly ok: true; readonly value: Destination }
  | { readonly ok: false; readonly issues: readonly string[] };

const BAD_SEGMENT =
  'Choisissez un dossier simple, relatif à la racine de travail : lettres, chiffres, points, tirets et soulignés.';

/**
 * Valide un dossier de destination et le résout sous `root`.
 *
 * Refusé : vide, absolu (`C:\…`, `/…`), caractères de contrôle, segment `.` ou
 * `..`, et tout ce qui sortirait de la racine après résolution.
 */
export function resolveDestination(folder: unknown, root: string): DestinationResult {
  if (typeof folder !== 'string' || folder.trim() === '') {
    return { ok: false, issues: ['Indiquez un dossier de destination.'] };
  }
  const value = folder.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return { ok: false, issues: ['Le nom du dossier contient des caractères de contrôle.'] };
  }
  if (isAbsolute(value)) {
    return {
      ok: false,
      issues: [
        'Le dossier de destination est relatif à la racine de travail : un chemin absolu n’est pas accepté.',
      ],
    };
  }
  const segments = value.split(/[\\/]+/).filter((segment) => segment !== '');
  if (segments.length === 0) {
    return { ok: false, issues: [BAD_SEGMENT] };
  }
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !SEGMENT.test(segment)) {
      return { ok: false, issues: [BAD_SEGMENT] };
    }
  }
  const directory = resolve(root, ...segments);
  if (directory !== root && !directory.startsWith(root + sep)) {
    return {
      ok: false,
      issues: ['Le dossier de destination sort de la racine de travail.'],
    };
  }
  return { ok: true, value: { folder: segments.join('/'), directory } };
}

/**
 * L'état du dossier de destination, **sans rien écrire**.
 *
 * `free` : inexistant ; `empty` : dossier vide ; `taken` : autre chose (fichier
 * ou dossier non vide). C'est le bloquant du §6.22, vérifié avant d'appeler Git.
 */
export type DestinationState = 'free' | 'empty' | 'taken';

export async function destinationState(directory: string): Promise<DestinationState> {
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) {
      return 'taken';
    }
    return (await readdir(directory)).length === 0 ? 'empty' : 'taken';
  } catch {
    return 'free';
  }
}

/** Le dossier proposé par défaut : le nom du dépôt, quand il est utilisable tel quel. */
export function defaultFolder(remote: GitRemote): string | undefined {
  const name = (
    remote.github?.repo ??
    basename(remote.url.replace(/[:/]+$/, '').replace(/.*[:/]/, '')).replace(/\.git$/, '')
  ).trim();
  return SEGMENT.test(name) && name !== '.' && name !== '..' ? name : undefined;
}

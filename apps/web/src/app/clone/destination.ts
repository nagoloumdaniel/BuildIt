import { readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import type { GitRemote } from '@buildit/git';

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
    configured === undefined || configured === '' ? join(homedir(), 'buildit') : configured,
  );
}

/** Un segment de dossier : pas de séparateur, pas de chemin spécial. */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

export interface Destination {
  /** Le dossier tel qu'il sera affiché, en séparateurs `/`. */
  readonly folder: string;
  readonly directory: string;
}

/**
 * Ce qui a été refusé : le dossier **parent** choisi (inexistant, illisible,
 * pas un dossier) ou le **nom** du sous-dossier (vide, séparateur de chemin,
 * segment interdit). L'écran en a besoin pour proposer le bon geste : rouvrir
 * l'explorateur dans un cas, corriger le nom dans l'autre.
 */
export type DestinationRefusal = 'parent' | 'folder';

export type DestinationResult =
  | { readonly ok: true; readonly value: Destination }
  | {
      readonly ok: false;
      readonly reason: DestinationRefusal;
      readonly issues: readonly string[];
    };

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
    return { ok: false, reason: 'folder', issues: ['Indiquez un dossier de destination.'] };
  }
  const value = folder.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return {
      ok: false,
      reason: 'folder',
      issues: ['Le nom du dossier contient des caractères de contrôle.'],
    };
  }
  if (isAbsolute(value)) {
    return {
      ok: false,
      reason: 'folder',
      issues: [
        'Le dossier de destination est relatif à la racine de travail : un chemin absolu n’est pas accepté.',
      ],
    };
  }
  const segments = value.split(/[\\/]+/).filter((segment) => segment !== '');
  if (segments.length === 0) {
    return { ok: false, reason: 'folder', issues: [BAD_SEGMENT] };
  }
  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !SEGMENT.test(segment)) {
      return { ok: false, reason: 'folder', issues: [BAD_SEGMENT] };
    }
  }
  const directory = resolve(root, ...segments);
  if (directory !== root && !directory.startsWith(root + sep)) {
    return {
      ok: false,
      reason: 'folder',
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

/**
 * Le dossier **parent** choisi dans l'explorateur de la machine (mode local).
 *
 * C'est la correction d'un vrai défaut d'usage : la destination était
 * « relative à une racine de travail » que l'utilisateur ne voyait pas, ne
 * choisissait pas, et dont il ignorait l'existence — un clone atterrissait
 * dans `~/buildit/<nom>` sans que rien ne le dise clairement, et un échec
 * ressemblait à « le clonage ne marche pas ».
 *
 * En local, le parent est désormais un **chemin absolu choisi dans
 * l'explorateur** : l'utilisateur voit où ça va, et un dossier inaccessible le
 * dit avec ce mot-là. La racine de travail reste la règle en hébergé
 * (`resolveDestination`), où aucun chemin absolu venu du navigateur ne peut
 * être cru : ce serait une écriture de fichier arbitraire sur le serveur.
 */
export async function resolveAbsoluteDestination(
  parent: unknown,
  folder: unknown,
): Promise<DestinationResult> {
  if (typeof parent !== 'string' || parent.trim() === '') {
    return {
      ok: false,
      reason: 'parent',
      issues: ['Choisissez le dossier où le dépôt doit atterrir.'],
    };
  }
  const parentPath = parent.trim();
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\u0000-\u001f\u007f]/.test(parentPath)) {
    return {
      ok: false,
      reason: 'parent',
      issues: ['Le chemin du dossier contient des caractères de contrôle.'],
    };
  }
  if (!isAbsolute(parentPath)) {
    return {
      ok: false,
      reason: 'parent',
      issues: [
        'Choisissez le dossier dans l’explorateur : un chemin relatif ne désigne pas le même endroit selon d’où le serveur a été lancé.',
      ],
    };
  }
  const root = resolve(parentPath);

  try {
    const info = await stat(root);
    if (!info.isDirectory()) {
      return { ok: false, reason: 'parent', issues: [`« ${root} » n’est pas un dossier.`] };
    }
  } catch {
    return {
      ok: false,
      reason: 'parent',
      issues: [
        `Le dossier ${root} n’est pas accessible : il n’existe pas, ou ce compte n’a pas le droit de le lire. Choisissez-en un autre dans l’explorateur.`,
      ],
    };
  }

  if (typeof folder !== 'string' || folder.trim() === '') {
    return { ok: false, reason: 'folder', issues: ['Indiquez le nom du dossier à créer.'] };
  }
  const name = folder.trim();
  if (name === '.' || name === '..' || !SEGMENT.test(name)) {
    return {
      ok: false,
      reason: 'folder',
      issues: [
        'Le nom du dossier n’accepte que lettres, chiffres, points, tirets et soulignés, et aucun séparateur de chemin.',
      ],
    };
  }

  return { ok: true, value: { folder: name, directory: join(root, name) } };
}

/** Le dossier proposé par défaut : le nom du dépôt, quand il est utilisable tel quel. */
export function defaultFolder(remote: GitRemote): string | undefined {
  const name = (
    remote.github?.repo ??
    basename(remote.url.replace(/[:/]+$/, '').replace(/.*[:/]/, '')).replace(/\.git$/, '')
  ).trim();
  return SEGMENT.test(name) && name !== '.' && name !== '..' ? name : undefined;
}

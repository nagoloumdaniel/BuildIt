import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { SkeletonFile } from '@buildit/manifest';
import {
  baseFilesFor,
  MANIFEST_FILE,
  missingBaseFiles,
  type ProjectShape,
  projectShape,
} from './base-files';

/**
 * Les fichiers de base d'un projet local, **côté serveur** — seulement en
 * local (`pf web`), où le serveur est sur la machine de l'utilisateur. En
 * hébergé, le même calcul tourne dans le navigateur (`base-files.ts`).
 *
 * Le chemin est déjà validé par l'appelant (`resolveLocalDirectory`).
 */

export interface BaseFilesPlan {
  readonly shape: ProjectShape;
  readonly missing: readonly SkeletonFile[];
}

export type ApplyBaseFilesResult =
  | { readonly ok: true; readonly written: readonly string[] }
  | { readonly ok: false; readonly written: readonly string[]; readonly issues: readonly string[] };

const MAX_TEXT_BYTES = 1_000_000;

async function readSmall(path: string): Promise<string | undefined> {
  try {
    const info = await stat(path);
    return info.size > MAX_TEXT_BYTES ? undefined : await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function planBaseFiles(directory: string): Promise<BaseFilesPlan> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const shape = projectShape({
    folder: basename(directory),
    files: entries.filter((entry) => entry.isFile()).map((entry) => entry.name),
    dirs: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name),
    packageJson: await readSmall(join(directory, 'package.json')),
    manifest: await readSmall(join(directory, MANIFEST_FILE)),
  });
  const files = baseFilesFor(shape);
  const present = new Set<string>();
  for (const file of files) {
    if (await exists(join(directory, ...file.path.split('/')))) {
      present.add(file.path);
    }
  }
  return { shape, missing: missingBaseFiles(files, (path) => present.has(path)) };
}

/** Écrit ce qui manque. `wx` : un fichier apparu entre-temps n'est pas écrasé. */
export async function applyBaseFiles(directory: string): Promise<ApplyBaseFilesResult> {
  const { missing } = await planBaseFiles(directory);
  const written: string[] = [];
  for (const file of missing) {
    const target = join(directory, ...file.path.split('/'));
    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.contents, { encoding: 'utf8', flag: 'wx' });
      written.push(file.path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        continue;
      }
      return { ok: false, written, issues: [`${file.path} : ${String(error)}`] };
    }
  }
  return { ok: true, written };
}

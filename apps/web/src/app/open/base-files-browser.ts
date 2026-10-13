'use client';

import type { SkeletonFile } from '@buildit/manifest';
import { type WritableDirectory, writeFileAt } from '../../lib/browser-write';
import { createBrowserZip, downloadBytes } from '../../lib/zip-browser';
import type { DirectoryHandle } from './browser-picker';

/**
 * Les fichiers de base d'un projet ouvert **dans le navigateur** (hébergé) :
 * - Chrome, Edge : écrits dans le dossier, par sa poignée ;
 * - Firefox, Safari : en archive `.zip`, à décompresser à la racine du projet.
 * Jamais d'écrasement : un fichier présent est sauté.
 */

export type BrowserBaseResult =
  | { readonly ok: true; readonly written: readonly string[] }
  | { readonly ok: false; readonly reason: 'denied' | 'failed'; readonly detail?: string };

async function existsIn(root: WritableDirectory, path: string): Promise<boolean> {
  const segments = path.split('/');
  try {
    let folder = root;
    for (const segment of segments.slice(0, -1)) {
      folder = await folder.getDirectoryHandle(segment);
    }
    await folder.getFileHandle(segments.at(-1) ?? path);
    return true;
  } catch {
    return false;
  }
}

/** Vrai si ce sous-dossier existe sous la poignée. */
export async function dirExistsInHandle(handle: DirectoryHandle, path: string): Promise<boolean> {
  try {
    let folder = handle as unknown as WritableDirectory;
    for (const segment of path.split('/')) {
      folder = await folder.getDirectoryHandle(segment);
    }
    return true;
  } catch {
    return false;
  }
}

export async function missingInHandle(
  handle: DirectoryHandle,
  files: readonly SkeletonFile[],
): Promise<SkeletonFile[]> {
  const root = handle as unknown as WritableDirectory;
  const missing: SkeletonFile[] = [];
  for (const file of files) {
    if (!(await existsIn(root, file.path))) {
      missing.push(file);
    }
  }
  return missing;
}

export async function writeMissingToHandle(
  handle: DirectoryHandle,
  files: readonly SkeletonFile[],
): Promise<BrowserBaseResult> {
  // Le dossier a été ouvert en lecture : l'écriture se demande, au clic.
  if (handle.requestPermission !== undefined) {
    const permission = await handle.requestPermission({ mode: 'readwrite' }).catch(() => 'denied');
    if (permission !== 'granted') {
      return { ok: false, reason: 'denied' };
    }
  }
  const root = handle as unknown as WritableDirectory;
  const encoder = new TextEncoder();
  const written: string[] = [];
  for (const file of files) {
    if (await existsIn(root, file.path)) {
      continue;
    }
    try {
      await writeFileAt(root, file.path, encoder.encode(file.contents));
      written.push(file.path);
    } catch (error) {
      return { ok: false, reason: 'failed', detail: `${file.path} : ${String(error)}` };
    }
  }
  return { ok: true, written };
}

/** Le repli sans écriture possible : l'archive des seuls fichiers manquants. */
export function downloadMissing(folder: string, files: readonly SkeletonFile[]): void {
  const bytes = createBrowserZip(files.map((file) => ({ path: file.path, text: file.contents })));
  downloadBytes(bytes, `${folder}-fichiers-de-base.zip`);
}

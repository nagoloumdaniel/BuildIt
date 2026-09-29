import { readFile } from 'node:fs/promises';
import { type Manifest, migrateManifest } from '@project-factory/manifest';
import { printIssues } from './format.js';
import type { Io } from './io.js';

/** Fichier lu par `pf graph` et `pf add` quand aucun n'est nommé. */
export const DEFAULT_MANIFEST_FILE = 'pf.manifest.json';

/**
 * Lit un manifest sur le disque : JSON, puis migration vers la version
 * courante, qui valide le résultat. Chaque échec est affiché ; `undefined` veut dire « déjà dit ».
 */
export async function readManifestFile(io: Io, path: string): Promise<Manifest | undefined> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    io.err(`✗ Impossible de lire « ${path} ».`);
    io.err('  → Vérifiez le chemin, ou créez un projet : pf create <nom> --preset <preset>.');
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    io.err(`✗ « ${path} » n'est pas du JSON valide : ${(error as Error).message}`);
    return undefined;
  }
  const parsed = migrateManifest(json);
  if (!parsed.ok) {
    printIssues(io, parsed.issues);
    return undefined;
  }
  return parsed.value;
}

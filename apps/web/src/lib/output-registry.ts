import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { sameDirectory } from './delete-project';

/**
 * Le registre des dossiers que BuildIt a lui-même générés.
 *
 * Pourquoi il existe : un projet peut désormais être écrit dans n'importe quel
 * dossier choisi dans l'explorateur, pas seulement sous `~/buildit`. L'écran
 * des projets doit pouvoir le supprimer, mais une suppression récursive d'un
 * chemin venu du navigateur est une suppression de fichier arbitraire. La
 * preuve que le dossier est bien un projet généré ne peut donc venir que du
 * serveur qui l'a écrit : c'est ce fichier, posé dans le dossier de travail,
 * et écrit **seulement** par la route de génération après une écriture
 * réussie.
 *
 * Il ne contient que des chemins absolus, résolus par le serveur. Il est relu
 * comme une donnée hostile (un humain peut l'éditer) : tout ce qui n'est pas
 * une chaîne absolue est écarté, et la règle de suppression
 * (`deletionTarget`) garde ses propres refus en plus.
 */

export const REGISTRY_FILE = '.buildit-generated.json';

/** Au-delà, les plus anciens tombent : un registre sans fin ne sert personne. */
export const MAX_REGISTERED = 500;

export function registryPath(root: string): string {
  return join(root, REGISTRY_FILE);
}

/** Un chemin absolu, Windows ou POSIX, sans caractère de contrôle. */
function isAbsolutePath(value: string): boolean {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');
}

/** Le texte du registre, relu sans lever : une entrée corrompue vaut une liste vide. */
export function parseRegistry(text: string): readonly string[] {
  try {
    const parsed: unknown = JSON.parse(text);
    const list =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)['directories']
        : undefined;
    if (!Array.isArray(list)) {
      return [];
    }
    return list.filter(
      (entry): entry is string => typeof entry === 'string' && isAbsolutePath(entry),
    );
  } catch {
    return [];
  }
}

export async function readRegistry(root: string): Promise<readonly string[]> {
  try {
    return parseRegistry(await readFile(registryPath(root), 'utf8'));
  } catch {
    // Pas encore de registre : aucun projet n'a été écrit hors du dossier de
    // travail, et c'est la règle de l'enfant direct qui s'applique seule.
    return [];
  }
}

/**
 * Écrit le registre d'un seul geste : fichier temporaire puis renommage. Un
 * arrêt au milieu laisse l'ancien registre entier, jamais un JSON coupé.
 */
async function writeRegistry(root: string, directories: readonly string[]): Promise<void> {
  await mkdir(root, { recursive: true });
  const path = registryPath(root);
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(
    temporary,
    `${JSON.stringify({ directories: directories.slice(0, MAX_REGISTERED) }, null, 2)}\n`,
    'utf8',
  );
  await rename(temporary, path);
}

/** Retient un dossier que BuildIt vient d'écrire. Le plus récent passe en tête. */
export async function registerGenerated(root: string, directory: string): Promise<void> {
  const absolute = resolve(directory);
  const existing = (await readRegistry(root)).filter((entry) => !sameDirectory(entry, absolute));
  await writeRegistry(root, [absolute, ...existing]);
}

/** Oublie un dossier supprimé : il ne doit plus ouvrir de droit de suppression. */
export async function unregisterGenerated(root: string, directory: string): Promise<void> {
  const existing = await readRegistry(root);
  const next = existing.filter((entry) => !sameDirectory(entry, directory));
  if (next.length !== existing.length) {
    await writeRegistry(root, next);
  }
}

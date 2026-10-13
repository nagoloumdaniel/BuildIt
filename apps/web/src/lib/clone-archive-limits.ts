import type { ZipLimits } from './clone-zip';

/**
 * Les bornes d'une copie hébergée, à part du reste de `clone-archive.ts`.
 *
 * Elles sont lues des deux côtés : par le serveur, qui les applique, et par
 * l'écran, qui les annonce **avant** que l'utilisateur ne commence. Le module
 * voisin importe `node:zlib` ; celui-ci n'importe qu'un type, et peut donc
 * partir dans le paquet du navigateur.
 *
 * Choisies pour qu'une fonction serverless tienne l'archive en mémoire et que
 * le navigateur reçoive les fichiers sans s'étouffer. Un dépôt plus gros n'est
 * pas refusé « parce que » : il relève d'un vrai `git clone`, et l'écran donne
 * la commande.
 */

export interface ArchiveLimits extends ZipLimits {
  /** Taille de l'archive compressée téléchargée depuis GitHub. */
  readonly maxArchiveBytes: number;
}

const MB = 1024 * 1024;

export const CLONE_ARCHIVE_LIMITS: ArchiveLimits = {
  maxArchiveBytes: 50 * MB,
  maxFiles: 5000,
  maxTotalBytes: 100 * MB,
  maxFileBytes: 25 * MB,
};

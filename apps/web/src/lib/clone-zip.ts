import { crc32, inflateRawSync } from 'node:zlib';

/**
 * Un lecteur `.zip` minimal, pour l'archive d'un dépôt GitHub.
 *
 * Pourquoi le lire nous-mêmes : en hébergé, il n'y a pas de `git` dans une
 * fonction Vercel. GitHub sait rendre un dépôt sous forme d'archive ; reste à
 * l'ouvrir. Aucune dépendance zip n'existe dans le monorepo (voir `zip.ts`,
 * l'écrivain voisin), et Node fournit les deux pièces qui comptent :
 * `inflateRawSync` (la méthode 8, « deflate », celle de GitHub) et `crc32`.
 *
 * Le lecteur est **paresseux** : il lit le répertoire central (les noms et les
 * tailles annoncées), applique les limites **avant** de décompresser quoi que
 * ce soit, puis chaque fichier ne se décompresse qu'à la demande. Le serveur
 * ne tient ainsi jamais tout le dépôt décompressé en mémoire à la fois.
 *
 * Ce qu'on refuse, et pourquoi :
 * - le chiffrement : rien à en faire sans mot de passe ;
 * - zip64 : au-delà de 4 Go ou 65 535 entrées, bien au-dessus de nos limites ;
 * - toute méthode autre que « stocké » (0) et « deflate » (8) ;
 * - une taille réelle qui ne correspond pas à la taille annoncée : c'est le
 *   signe d'une « bombe » qui ment pour passer les limites, et
 *   `maxOutputLength` coupe la décompression avant qu'elle n'explose.
 *
 * Les liens symboliques ne sont pas suivis : ils sont listés à part, jamais
 * écrits. Un lien dans un dépôt pointe souvent hors du dépôt, et le navigateur
 * ne saurait de toute façon pas en créer un.
 */

export interface ZipLimits {
  /** Au-delà, l'archive est refusée en entier : c'est un `git clone` qu'il faut. */
  readonly maxFiles: number;
  /** Somme des tailles décompressées annoncées. */
  readonly maxTotalBytes: number;
  /** Taille décompressée d'un seul fichier. */
  readonly maxFileBytes: number;
}

export type ZipFailureReason =
  | 'notZip'
  | 'zip64'
  | 'encrypted'
  | 'method'
  | 'tooManyFiles'
  | 'tooLarge'
  | 'fileTooLarge'
  | 'corrupt';

export interface ZipFailure {
  readonly reason: ZipFailureReason;
  /** Le nom de l'entrée en cause, quand il y en a une. */
  readonly detail?: string;
}

/** Une erreur levée par `read()` : l'entrée ne tient pas sa promesse. */
export class ZipEntryError extends Error {
  readonly reason: ZipFailureReason;
  readonly entry: string;

  constructor(reason: ZipFailureReason, entry: string) {
    super(`${reason}: ${entry}`);
    this.name = 'ZipEntryError';
    this.reason = reason;
    this.entry = entry;
  }
}

export interface ZipFile {
  /** Le nom brut, tel que l'archive le donne (séparateurs `/`). */
  readonly name: string;
  /** La taille décompressée annoncée, déjà passée par les limites. */
  readonly size: number;
  /** Décompresse et vérifie (taille, CRC). Lève `ZipEntryError`. */
  read(): Buffer;
}

export type ZipListing =
  | {
      readonly ok: true;
      readonly files: readonly ZipFile[];
      /** Les liens symboliques rencontrés : jamais écrits, toujours annoncés. */
      readonly symlinks: readonly string[];
    }
  | { readonly ok: false; readonly failure: ZipFailure };

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const EOCD_SIZE = 22;
/** Le commentaire de fin d'archive fait au plus 65 535 octets. */
const MAX_COMMENT = 0xffff;
/** L'hôte « Unix » de l'octet haut de « version made by ». */
const HOST_UNIX = 3;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

function fail(reason: ZipFailureReason, detail?: string): ZipListing {
  return { ok: false, failure: detail === undefined ? { reason } : { reason, detail } };
}

/** La position de la fin d'archive, cherchée depuis la fin (le commentaire peut suivre). */
function findEnd(buffer: Buffer): number {
  const lowest = Math.max(0, buffer.length - EOCD_SIZE - MAX_COMMENT);
  for (let at = buffer.length - EOCD_SIZE; at >= lowest; at -= 1) {
    if (buffer.readUInt32LE(at) === EOCD_SIGNATURE) {
      return at;
    }
  }
  return -1;
}

interface CentralEntry {
  readonly name: string;
  readonly method: number;
  readonly crc: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
}

function readerFor(buffer: Buffer, entry: CentralEntry): () => Buffer {
  return () => {
    const at = entry.localOffset;
    if (at + 30 > buffer.length || buffer.readUInt32LE(at) !== LOCAL_SIGNATURE) {
      throw new ZipEntryError('corrupt', entry.name);
    }
    const start = at + 30 + buffer.readUInt16LE(at + 26) + buffer.readUInt16LE(at + 28);
    const end = start + entry.compressedSize;
    if (end > buffer.length) {
      throw new ZipEntryError('corrupt', entry.name);
    }
    const raw = buffer.subarray(start, end);
    let data: Buffer;
    if (entry.method === 0) {
      data = Buffer.from(raw);
    } else {
      try {
        // `maxOutputLength` borne la décompression à ce qui a été annoncé (et
        // validé par les limites) : une archive qui ment est coupée net.
        data = inflateRawSync(raw, { maxOutputLength: Math.max(1, entry.size) });
      } catch {
        throw new ZipEntryError('corrupt', entry.name);
      }
    }
    if (data.length !== entry.size || crc32(data) !== entry.crc) {
      throw new ZipEntryError('corrupt', entry.name);
    }
    return data;
  };
}

/**
 * Le contenu d'une archive : ses fichiers (à lire à la demande) et ses liens.
 *
 * Les limites sont appliquées aux tailles **annoncées** ; `read()` vérifie
 * ensuite que chaque fichier tient parole.
 */
export function listZip(buffer: Buffer, limits: ZipLimits): ZipListing {
  if (buffer.length < EOCD_SIZE) {
    return fail('notZip');
  }
  const end = findEnd(buffer);
  if (end === -1) {
    return fail('notZip');
  }
  const count = buffer.readUInt16LE(end + 10);
  const centralSize = buffer.readUInt32LE(end + 12);
  const centralOffset = buffer.readUInt32LE(end + 16);
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    return fail('zip64');
  }
  if (centralOffset + centralSize > end) {
    return fail('corrupt');
  }

  const files: ZipFile[] = [];
  const symlinks: string[] = [];
  let total = 0;
  let at = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > end || buffer.readUInt32LE(at) !== CENTRAL_SIGNATURE) {
      return fail('corrupt');
    }
    const madeBy = buffer.readUInt16LE(at + 4);
    const flags = buffer.readUInt16LE(at + 8);
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const compressedSize = buffer.readUInt32LE(at + 20);
    const size = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const external = buffer.readUInt32LE(at + 38);
    const localOffset = buffer.readUInt32LE(at + 42);
    const nameEnd = at + 46 + nameLength;
    if (nameEnd > end) {
      return fail('corrupt');
    }
    const name = buffer.toString('utf8', at + 46, nameEnd);
    at = nameEnd + extraLength + commentLength;

    if (name.endsWith('/')) {
      // Un dossier : il naîtra de ses fichiers. Un dossier vide ne s'écrit pas,
      // comme dans un clone git, qui ne connaît pas les dossiers vides.
      continue;
    }
    if (madeBy >> 8 === HOST_UNIX && ((external >>> 16) & S_IFMT) === S_IFLNK) {
      symlinks.push(name);
      continue;
    }
    if ((flags & 0x1) !== 0) {
      return fail('encrypted', name);
    }
    if (method !== 0 && method !== 8) {
      return fail('method', name);
    }
    if (size > limits.maxFileBytes) {
      return fail('fileTooLarge', name);
    }
    total += size;
    if (total > limits.maxTotalBytes) {
      return fail('tooLarge');
    }
    if (files.length + 1 > limits.maxFiles) {
      return fail('tooManyFiles');
    }
    const entry: CentralEntry = { name, method, crc, compressedSize, size, localOffset };
    files.push({ name, size, read: readerFor(buffer, entry) });
  }
  return { ok: true, files, symlinks };
}

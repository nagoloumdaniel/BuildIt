/**
 * Lire un `.zip` **dans le navigateur**, sans Node : la liste des fichiers et
 * le texte de quelques-uns (`package.json`, `pf.manifest.json`).
 *
 * Sert sur iPhone, iPad et Android, où `<input webkitdirectory>` n'ouvre pas
 * de dossier : le visiteur choisit l'archive de son projet à la place.
 *
 * Entrées STORED (0) et DEFLATE (8) ce que produisent Fichiers (iOS),
 * l'explorateur Windows, macOS, `zip` et GitHub. DEFLATE passe par
 * `DecompressionStream('deflate-raw')`, natif dans Safari 16.4+, Chrome 80+,
 * Firefox 113+. Zip64 et chiffrement : refusés, dit.
 */

export interface ZipReadEntry {
  /** Chemin POSIX dans l'archive. */
  readonly path: string;
  readonly method: number;
  readonly compressedSize: number;
  readonly size: number;
  readonly localOffset: number;
  readonly encrypted: boolean;
}

export class ZipReadError extends Error {
  constructor(readonly reason: 'not-zip' | 'zip64' | 'encrypted' | 'method' | 'corrupt') {
    super(`zip: ${reason}`);
  }
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let at = view.byteLength - 22; at >= min; at -= 1) {
    if (view.getUint32(at, true) === EOCD) return at;
  }
  throw new ZipReadError('not-zip');
}

/** Le répertoire central : noms et emplacements, sans rien décompresser. */
export function listZipEntries(bytes: Uint8Array): ZipReadEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 22) throw new ZipReadError('not-zip');
  const eocd = findEocd(view);
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || offset === 0xffffffff) throw new ZipReadError('zip64');
  const decoder = new TextDecoder();
  const entries: ZipReadEntry[] = [];
  let at = offset;
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.byteLength || view.getUint32(at, true) !== CENTRAL) {
      throw new ZipReadError('corrupt');
    }
    const flags = view.getUint16(at + 8, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    entries.push({
      path: name.replace(/\\/g, '/'),
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
      encrypted: (flags & 1) === 1,
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Le contenu d'une entrée, décompressé. */
export async function readZipEntry(bytes: Uint8Array, entry: ZipReadEntry): Promise<Uint8Array> {
  if (entry.encrypted) throw new ZipReadError('encrypted');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localOffset;
  if (at + 30 > bytes.byteLength || view.getUint32(at, true) !== LOCAL) {
    throw new ZipReadError('corrupt');
  }
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (data.byteLength !== entry.compressedSize) throw new ZipReadError('corrupt');
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data);
  throw new ZipReadError('method');
}

import { crc32 } from 'node:zlib';

/**
 * Un lecteur `.zip` minimal entrées `STORED` (non compressées).
 *
 * Phase 12 (§3) : en mode hébergé, la génération écrit dans un répertoire
 * temporaire isolé par requête puis produit une archive téléchargeable au
 * lieu d'écrire dans un dossier partagé entre visiteurs. Aucune dépendance de
 * zip n'existait dans le monorepo (`archiver`, `jszip`, `adm-zip`…) ; le
 * format ZIP est documenté et petit pour des entrées non compressées, et
 * `node:zlib` expose `crc32` nativement depuis Node 24 en ajouter une
 * dépendance pour ça serait disproportionné.
 *
 * Pas de compression : les projets générés sont surtout du texte (code
 * source, JSON), de taille modeste pour un configurateur, et la simplicité
 * du format réduit la surface à faire fonctionner correctement.
 */

export interface ZipEntry {
  /** Chemin dans l'archive, toujours en `/` jamais un chemin Windows. */
  readonly path: string;
  readonly data: Buffer;
}

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const VERSION = 20;

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function createZip(entries: readonly ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(normalizePath(entry.path), 'utf8');
    const checksum = crc32(entry.data);
    const size = entry.data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_SIGNATURE, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_SIGNATURE, 0);
    central.writeUInt16LE(VERSION, 4); // version made by
    central.writeUInt16LE(VERSION, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // time
    central.writeUInt16LE(0, 14); // date
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // relative offset of local header

    centralParts.push(central, name);

    offset += local.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(EOCD_SIGNATURE, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with CD
  eocd.writeUInt16LE(entries.length, 8); // entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirectory.length, 12); // size of CD
  eocd.writeUInt32LE(offset, 16); // offset of CD
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

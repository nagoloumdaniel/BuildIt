import { crc32, deflateRawSync } from 'node:zlib';

/**
 * Fabrique d'archives `.zip` **pour les tests** du lecteur et de la copie
 * hébergée.
 *
 * `zip.ts` n'écrit que des entrées « stockées » et bien formées ; les tests
 * ont besoin du reste : deflate (la méthode de GitHub), liens symboliques,
 * drapeau de chiffrement, tailles ou CRC qui mentent. Chaque champ se force
 * entrée par entrée.
 */

export interface FixtureEntry {
  readonly name: string;
  readonly data?: Buffer | string;
  /** 0 (stocké) ou 8 (deflate, par défaut). Autre valeur : écrite telle quelle. */
  readonly method?: number;
  readonly flags?: number;
  /** Octet haut de « version made by » : 3 = Unix. */
  readonly host?: number;
  /** Mode Unix, posé dans les attributs externes (`0o120777` : lien). */
  readonly mode?: number;
  /** Taille décompressée annoncée, si elle doit mentir. */
  readonly declaredSize?: number;
  readonly crc?: number;
}

export function buildZip(entries: readonly FixtureEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? '', 'utf8');
    const method = entry.method ?? 8;
    const stored = method === 8 ? deflateRawSync(data) : data;
    const checksum = entry.crc ?? crc32(data);
    const size = entry.declaredSize ?? data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, stored);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(((entry.host ?? 0) << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(entry.flags ?? 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((entry.mode ?? 0) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + stored.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

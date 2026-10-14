import { describe, expect, it } from 'vitest';
import { createZip } from './zip';

/**
 * Archive `.zip` téléchargeable (Phase 12, §3) : la génération hébergée ne
 * doit jamais écrire dans un dossier partagé entre visiteurs elle rend un
 * fichier. Format minimal (entrées non compressées, `STORED`) : pas de
 * dépendance ajoutée (aucune lib de zip n'existait dans le monorepo), et
 * `node:zlib` expose `crc32` depuis Node 24 (celui de ce dépôt).
 */

function readU32LE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

describe('createZip', () => {
  it('produit une archive qui commence par la signature locale PK\\x03\\x04', () => {
    const zip = createZip([{ path: 'a.txt', data: Buffer.from('hello') }]);
    expect(zip.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
  });

  it('contient le nom de chaque fichier et ses octets', () => {
    const zip = createZip([
      { path: 'a.txt', data: Buffer.from('hello') },
      { path: 'dossier/b.txt', data: Buffer.from('monde') },
    ]);
    const text = zip.toString('latin1');
    expect(text).toContain('a.txt');
    expect(text).toContain('dossier/b.txt');
    expect(zip.includes(Buffer.from('hello'))).toBe(true);
    expect(zip.includes(Buffer.from('monde'))).toBe(true);
  });

  it('termine par un End Of Central Directory valide, qui compte les bonnes entrées', () => {
    const entries = [
      { path: 'a.txt', data: Buffer.from('hello') },
      { path: 'b.txt', data: Buffer.from('monde') },
    ];
    const zip = createZip(entries);
    const eocdSignature = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    expect(eocdSignature).toBeGreaterThan(-1);
    const totalEntries = zip.readUInt16LE(eocdSignature + 10);
    expect(totalEntries).toBe(entries.length);
  });

  it('une archive vide reste un zip valide (EOCD seul, zéro entrée)', () => {
    const zip = createZip([]);
    expect(readU32LE(zip, 0)).toBe(0x06054b50);
  });
});

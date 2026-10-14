import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { listZip, ZipEntryError, type ZipLimits } from './clone-zip';
import { buildZip } from './clone-zip.fixture';
import { createZip } from './zip';

/** Le lecteur zip : limites avant décompression, et rien n'est cru sur parole. */

const LIMITS: ZipLimits = { maxFiles: 10, maxTotalBytes: 10_000, maxFileBytes: 5_000 };

function names(buffer: Buffer, limits: ZipLimits = LIMITS): readonly string[] {
  const listing = listZip(buffer, limits);
  if (!listing.ok) {
    throw new Error(listing.failure.reason);
  }
  return listing.files.map((file) => file.name);
}

describe('listZip lecture', () => {
  it('lit les entrées deflate et stockées, à la demande', () => {
    const zip = buildZip([
      { name: 'repo/README.md', data: '# Bonjour\n' },
      { name: 'repo/raw.bin', data: Buffer.from([0, 1, 2, 255]), method: 0 },
      { name: 'repo/empty.txt', data: '' },
    ]);
    const listing = listZip(zip, LIMITS);
    expect(listing.ok).toBe(true);
    if (!listing.ok) {
      return;
    }
    expect(listing.files.map((file) => [file.name, file.size])).toEqual([
      ['repo/README.md', 10],
      ['repo/raw.bin', 4],
      ['repo/empty.txt', 0],
    ]);
    expect(listing.files[0]?.read().toString('utf8')).toBe('# Bonjour\n');
    expect([...(listing.files[1]?.read() ?? [])]).toEqual([0, 1, 2, 255]);
    expect(listing.files[2]?.read().length).toBe(0);
  });

  it('lit aussi ce qu’écrit zip.ts, l’écrivain voisin', () => {
    const zip = createZip([{ path: 'a/b.txt', data: Buffer.from('x') }]);
    expect(names(zip)).toEqual(['a/b.txt']);
  });

  it('ignore les dossiers et met les liens symboliques à part', () => {
    const zip = buildZip([
      { name: 'repo/', data: '' },
      { name: 'repo/link', data: '../../etc/passwd', host: 3, mode: 0o120777 },
      { name: 'repo/file', data: 'x', host: 3, mode: 0o100644 },
    ]);
    const listing = listZip(zip, LIMITS);
    expect(listing).toMatchObject({ ok: true, symlinks: ['repo/link'] });
    expect(names(zip)).toEqual(['repo/file']);
  });

  it('trouve la fin d’archive derrière un commentaire', () => {
    const zip = buildZip([{ name: 'a.txt', data: 'a' }]);
    const comment = Buffer.from('un commentaire');
    const withComment = Buffer.concat([zip, comment]);
    withComment.writeUInt16LE(comment.length, zip.length - 2);
    expect(names(withComment)).toEqual(['a.txt']);
  });
});

describe('listZip refus', () => {
  it('refuse ce qui n’est pas une archive', () => {
    expect(listZip(Buffer.from('court'), LIMITS)).toEqual({
      ok: false,
      failure: { reason: 'notZip' },
    });
    expect(listZip(Buffer.alloc(100, 1), LIMITS)).toMatchObject({
      ok: false,
      failure: { reason: 'notZip' },
    });
  });

  it('refuse zip64, le chiffrement et une méthode inconnue', () => {
    const zip64 = buildZip([{ name: 'a', data: 'a' }]);
    zip64.writeUInt16LE(0xffff, zip64.length - 22 + 10);
    expect(listZip(zip64, LIMITS)).toMatchObject({ ok: false, failure: { reason: 'zip64' } });

    expect(listZip(buildZip([{ name: 'secret', data: 'x', flags: 1 }]), LIMITS)).toEqual({
      ok: false,
      failure: { reason: 'encrypted', detail: 'secret' },
    });
    expect(listZip(buildZip([{ name: 'bz', data: 'x', method: 12 }]), LIMITS)).toEqual({
      ok: false,
      failure: { reason: 'method', detail: 'bz' },
    });
  });

  it('applique les limites sur les tailles annoncées, avant toute décompression', () => {
    const many = buildZip(Array.from({ length: 3 }, (_, index) => ({ name: `f${index}` })));
    expect(listZip(many, { ...LIMITS, maxFiles: 2 })).toEqual({
      ok: false,
      failure: { reason: 'tooManyFiles' },
    });
    const big = buildZip([{ name: 'gros', data: 'x'.repeat(6000) }]);
    expect(listZip(big, LIMITS)).toEqual({
      ok: false,
      failure: { reason: 'fileTooLarge', detail: 'gros' },
    });
    const total = buildZip([
      { name: 'a', data: 'x'.repeat(4000) },
      { name: 'b', data: 'x'.repeat(4000) },
      { name: 'c', data: 'x'.repeat(4000) },
    ]);
    expect(listZip(total, LIMITS)).toEqual({ ok: false, failure: { reason: 'tooLarge' } });
  });

  it('refuse un répertoire central qui déborde ou qui ment', () => {
    const outside = buildZip([{ name: 'a', data: 'a' }]);
    outside.writeUInt32LE(outside.length, outside.length - 22 + 16);
    expect(listZip(outside, LIMITS)).toMatchObject({ ok: false, failure: { reason: 'corrupt' } });

    const badSignature = buildZip([{ name: 'a', data: 'a' }]);
    const central = badSignature.readUInt32LE(badSignature.length - 22 + 16);
    badSignature.writeUInt32LE(0, central);
    expect(listZip(badSignature, LIMITS)).toMatchObject({
      ok: false,
      failure: { reason: 'corrupt' },
    });

    const longName = buildZip([{ name: 'a', data: 'a' }]);
    const at = longName.readUInt32LE(longName.length - 22 + 16);
    longName.writeUInt16LE(500, at + 28);
    expect(listZip(longName, LIMITS)).toMatchObject({ ok: false, failure: { reason: 'corrupt' } });
  });
});

describe('ZipFile.read l’entrée tient-elle parole ?', () => {
  function onlyFile(zip: Buffer) {
    const listing = listZip(zip, LIMITS);
    if (!listing.ok || listing.files[0] === undefined) {
      throw new Error('archive attendue');
    }
    return listing.files[0];
  }

  function reasonOf(read: () => unknown): string | undefined {
    try {
      read();
      return undefined;
    } catch (error) {
      return error instanceof ZipEntryError ? `${error.reason}:${error.entry}` : 'autre';
    }
  }

  it('refuse une taille annoncée plus petite que la réalité (bombe)', () => {
    const file = onlyFile(buildZip([{ name: 'bombe', data: 'x'.repeat(3000), declaredSize: 10 }]));
    expect(reasonOf(() => file.read())).toBe('corrupt:bombe');
  });

  it('refuse une taille annoncée plus grande, un CRC faux, un deflate cassé', () => {
    expect(
      reasonOf(() => onlyFile(buildZip([{ name: 'a', data: 'abc', declaredSize: 4 }])).read()),
    ).toBe('corrupt:a');
    expect(reasonOf(() => onlyFile(buildZip([{ name: 'a', data: 'abc', crc: 1 }])).read())).toBe(
      'corrupt:a',
    );
    const broken = buildZip([{ name: 'a', data: 'abcdef' }]);
    // Les octets compressés commencent après l'en-tête local (30) et le nom (1).
    broken.fill(0xff, 31, 31 + deflateRawSync(Buffer.from('abcdef')).length);
    expect(reasonOf(() => onlyFile(broken).read())).toBe('corrupt:a');
  });

  it('refuse un en-tête local absent ou des données hors de l’archive', () => {
    const noLocal = buildZip([{ name: 'a', data: 'abc' }]);
    noLocal.writeUInt32LE(0, 0);
    expect(reasonOf(() => onlyFile(noLocal).read())).toBe('corrupt:a');

    const farOffset = buildZip([{ name: 'a', data: 'abc' }]);
    const at = farOffset.readUInt32LE(farOffset.length - 22 + 16);
    farOffset.writeUInt32LE(farOffset.length - 10, at + 42);
    expect(reasonOf(() => onlyFile(farOffset).read())).toBe('corrupt:a');

    const longData = buildZip([{ name: 'a', data: 'abc', method: 0 }]);
    const central = longData.readUInt32LE(longData.length - 22 + 16);
    longData.writeUInt32LE(5000, central + 20);
    expect(reasonOf(() => onlyFile(longData).read())).toBe('corrupt:a');
  });

  it('nomme l’erreur', () => {
    const error = new ZipEntryError('corrupt', 'x');
    expect(error.name).toBe('ZipEntryError');
    expect(error.message).toBe('corrupt: x');
  });
});

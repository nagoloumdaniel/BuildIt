import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readRegistry, registerGenerated } from '../../../lib/output-registry';
import {
  checkOutputDestinationAction,
  deleteProjectAction,
  generateZipAction,
} from '../../actions';
import { saasManifest } from './fixtures';

/**
 * Les Server Actions de la sortie : l'archive (dans les deux modes), la
 * vérification du dossier choisi, et la suppression d'un projet écrit hors du
 * dossier de travail grâce au registre.
 */

const created: string[] = [];

afterEach(async () => {
  // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
  delete process.env['PF_HOSTED'];
  // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
  delete process.env['PF_WEB_WORKSPACE'];
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function temporary(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  created.push(path);
  return path;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('generateZipAction — une archive, en local comme en hébergé', () => {
  it('rend une archive du projet entier, rangée sous le nom du projet, sans dossier', async () => {
    const result = await generateZipAction(saasManifest('archive-locale'));
    expect(result.ok).toBe(true);
    expect(result.directory).toBe('');
    expect(result.files).toContain('package.json');
    const zip = Buffer.from(result.zipBase64 ?? '', 'base64');
    expect(zip.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
    expect(zip.includes(Buffer.from('archive-locale/package.json'))).toBe(true);
  });

  it('marche aussi en hébergé', async () => {
    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_HOSTED'] = '1';
    const result = await generateZipAction(saasManifest('archive-hebergee'));
    expect(result.ok).toBe(true);
    expect(typeof result.zipBase64).toBe('string');
  });

  it('refuse un manifest invalide, sans archive', async () => {
    const result = await generateZipAction({ name: '../evade' });
    expect(result.ok).toBe(false);
    expect(result.zipBase64).toBeUndefined();
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('checkOutputDestinationAction — le dossier, vérifié sans rien écrire', () => {
  it('accepte un parent lisible dont le sous-dossier n’existe pas', async () => {
    const parent = await temporary('pf-dest-libre-');
    const checked = await checkOutputDestinationAction(parent, 'mon-projet');
    expect(checked).toEqual({ ok: true, directory: join(parent, 'mon-projet'), issues: [] });
    expect(await readdir(parent)).toEqual([]);
  });

  it('refuse un sous-dossier déjà rempli, en nommant le dossier', async () => {
    const parent = await temporary('pf-dest-pris-');
    await mkdir(join(parent, 'mon-projet'));
    await writeFile(join(parent, 'mon-projet', 'x.txt'), 'x', 'utf8');
    const checked = await checkOutputDestinationAction(parent, 'mon-projet');
    expect(checked.ok).toBe(false);
    expect(checked.directory).toBe(join(parent, 'mon-projet'));
    expect(checked.issues.join(' ')).toContain(join(parent, 'mon-projet'));
  });

  it('refuse un parent inaccessible, et tout en hébergé', async () => {
    const missing = await checkOutputDestinationAction(join(tmpdir(), 'pf-absent-zzz'), 'a');
    expect(missing.ok).toBe(false);
    expect(missing.directory).toBe('');

    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_HOSTED'] = '1';
    const hosted = await checkOutputDestinationAction(await temporary('pf-dest-h-'), 'a');
    expect(hosted.ok).toBe(false);
    expect(hosted.issues.join(' ')).toContain('pf web');
  });
});

describe('deleteProjectAction — un projet écrit ailleurs', () => {
  it('supprime un dossier inscrit au registre, puis l’en retire', async () => {
    const root = await temporary('pf-del-travail-');
    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_WEB_WORKSPACE'] = root;
    const elsewhere = join(await temporary('pf-del-ailleurs-'), 'mon-projet');
    await mkdir(elsewhere);
    await writeFile(join(elsewhere, 'package.json'), '{}', 'utf8');
    await registerGenerated(root, elsewhere);

    const result = await deleteProjectAction(elsewhere);
    expect(result).toEqual({ ok: true, directory: elsewhere, issues: [] });
    expect(await exists(elsewhere)).toBe(false);
    expect(await readRegistry(root)).toEqual([]);
  });

  it('refuse un dossier ailleurs qui n’est pas au registre, sans y toucher', async () => {
    const root = await temporary('pf-del-travail-');
    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_WEB_WORKSPACE'] = root;
    const elsewhere = join(await temporary('pf-del-inconnu-'), 'mon-projet');
    await mkdir(elsewhere);

    const result = await deleteProjectAction(elsewhere);
    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('BuildIt n’a pas écrit ce dossier');
    expect(await exists(elsewhere)).toBe(true);
  });

  it('un dossier inscrit mais déjà parti est un succès, et quitte le registre', async () => {
    const root = await temporary('pf-del-travail-');
    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_WEB_WORKSPACE'] = root;
    const gone = join(await temporary('pf-del-parti-'), 'mon-projet');
    await registerGenerated(root, gone);

    expect((await deleteProjectAction(gone)).ok).toBe(true);
    expect(await readRegistry(root)).toEqual([]);
  });
});

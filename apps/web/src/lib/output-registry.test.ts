import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_REGISTERED,
  parseRegistry,
  readRegistry,
  registerGenerated,
  registryPath,
  unregisterGenerated,
} from './output-registry';

/**
 * Le registre des dossiers générés hors du dossier de travail : la seule
 * preuve, côté serveur, qu'un dossier quelconque est un projet BuildIt et peut
 * donc être supprimé depuis l'écran des projets.
 */

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-registre-'));
  created.push(root);
  return root;
}

describe('parseRegistry un fichier relu comme une donnée hostile', () => {
  it('garde les chemins absolus, Windows comme POSIX', () => {
    const text = JSON.stringify({
      directories: ['C:\\Projets\\app', '/home/moi/app', 'D:/x/y', '\\\\serveur\\partage\\app'],
    });
    expect(parseRegistry(text)).toEqual([
      'C:\\Projets\\app',
      '/home/moi/app',
      'D:/x/y',
      '\\\\serveur\\partage\\app',
    ]);
  });

  it('écarte ce qui n’est pas un chemin absolu propre', () => {
    const text = JSON.stringify({
      directories: ['relatif/app', '', 42, null, 'C:\\a\u0000b', '../evade'],
    });
    expect(parseRegistry(text)).toEqual([]);
  });

  it('un JSON cassé ou d’une autre forme vaut une liste vide', () => {
    expect(parseRegistry('{')).toEqual([]);
    expect(parseRegistry('[]')).toEqual([]);
    expect(parseRegistry('null')).toEqual([]);
    expect(parseRegistry(JSON.stringify({ directories: 'C:\\x' }))).toEqual([]);
  });
});

describe('registerGenerated / unregisterGenerated sur un vrai disque', () => {
  it('sans fichier, le registre est vide', async () => {
    const root = await temporaryRoot();
    expect(await readRegistry(join(root, 'absent'))).toEqual([]);
  });

  it('retient un dossier, le plus récent en tête, sans doublon', async () => {
    const root = await temporaryRoot();
    const first = join(root, 'ailleurs', 'premier');
    const second = join(root, 'ailleurs', 'second');
    await registerGenerated(root, first);
    await registerGenerated(root, second);
    await registerGenerated(root, first);

    expect(await readRegistry(root)).toEqual([first, second]);
    // Le fichier est du JSON lisible, posé dans le dossier de travail.
    const raw = JSON.parse(await readFile(registryPath(root), 'utf8'));
    expect(raw.directories).toHaveLength(2);
  });

  it('crée le dossier de travail s’il n’existe pas encore', async () => {
    const root = join(await temporaryRoot(), 'pas-encore');
    await registerGenerated(root, join(root, '..', 'projet'));
    expect(await readRegistry(root)).toHaveLength(1);
  });

  it('oublie un dossier supprimé, et ne réécrit rien quand il n’y était pas', async () => {
    const root = await temporaryRoot();
    const kept = join(root, 'garde');
    const gone = join(root, 'parti');
    await registerGenerated(root, kept);
    await registerGenerated(root, gone);

    await unregisterGenerated(root, gone.toUpperCase());
    expect(await readRegistry(root)).toEqual([kept]);

    await unregisterGenerated(root, join(root, 'inconnu'));
    expect(await readRegistry(root)).toEqual([kept]);
  });

  it('borne sa taille : les plus anciens tombent', async () => {
    const root = await temporaryRoot();
    const many = Array.from({ length: MAX_REGISTERED + 5 }, (_, index) => join(root, `p${index}`));
    await writeFile(registryPath(root), JSON.stringify({ directories: many }), 'utf8');
    await registerGenerated(root, join(root, 'nouveau'));

    const registry = await readRegistry(root);
    expect(registry).toHaveLength(MAX_REGISTERED);
    expect(registry[0]).toBe(join(root, 'nouveau'));
  });
});

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { registerGenerated } from '../../../lib/output-registry';
import { openProjectFolderAction } from '../../actions';
import { folderOpener, type OpenFolderDeps, openProjectFolder } from './open-folder';

/**
 * Ouvrir un dossier, c'est lancer un programme sur un chemin venu du
 * navigateur : ces tests prouvent d'abord les refus, puis que le programme
 * lancé reçoit le chemin du registre, sans shell.
 */

const created: string[] = [];

afterEach(async () => {
  delete process.env['PF_WEB_WORKSPACE'];
  delete process.env['PF_HOSTED'];
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-open-'));
  created.push(root);
  return root;
}

function deps(root: string, overrides: Partial<OpenFolderDeps> = {}) {
  const launched: { command: string; args: readonly string[] }[] = [];
  const value: OpenFolderDeps = {
    hosted: false,
    registryRoot: root,
    platform: 'win32',
    launch: async (command, args) => {
      launched.push({ command, args });
      return true;
    },
    ...overrides,
  };
  return { value, launched };
}

describe('folderOpener le gestionnaire de fichiers de chaque système', () => {
  it('explorer.exe sous Windows, open sous macOS, xdg-open ailleurs', () => {
    expect(folderOpener('win32', 'C:\\p')).toEqual({ command: 'explorer.exe', args: ['C:\\p'] });
    expect(folderOpener('darwin', '/p')).toEqual({ command: 'open', args: ['/p'] });
    expect(folderOpener('linux', '/p')).toEqual({ command: 'xdg-open', args: ['/p'] });
  });
});

describe('openProjectFolder les refus', () => {
  it('refuse en hébergé, avant de lire quoi que ce soit', async () => {
    const root = await workspace();
    const { value, launched } = deps(root, { hosted: true });
    expect(await openProjectFolder(join(root, 'app'), value)).toEqual({
      ok: false,
      reason: 'hosted',
    });
    expect(launched).toHaveLength(0);
  });

  it('refuse un chemin vide ou qui n’est pas une chaîne', async () => {
    const root = await workspace();
    const { value, launched } = deps(root);
    expect(await openProjectFolder('  ', value)).toEqual({ ok: false, reason: 'empty' });
    expect(await openProjectFolder(42, value)).toEqual({ ok: false, reason: 'empty' });
    expect(launched).toHaveLength(0);
  });

  it('refuse un dossier que BuildIt n’a pas inscrit au registre, même s’il existe', async () => {
    const root = await workspace();
    const other = join(root, 'pas-un-projet');
    await mkdir(other);
    const { value, launched } = deps(root);
    expect(await openProjectFolder(other, value)).toEqual({ ok: false, reason: 'notRegistered' });
    expect(launched).toHaveLength(0);
  });

  it('refuse un dossier inscrit mais disparu, ou devenu un fichier', async () => {
    const root = await workspace();
    const gone = join(root, 'parti');
    const file = join(root, 'fichier');
    await writeFile(file, 'x');
    await registerGenerated(root, gone);
    await registerGenerated(root, file);
    const { value, launched } = deps(root);
    expect(await openProjectFolder(gone, value)).toEqual({ ok: false, reason: 'missing' });
    expect(await openProjectFolder(file, value)).toEqual({ ok: false, reason: 'missing' });
    expect(launched).toHaveLength(0);
  });

  it('dit l’échec quand le programme ne démarre pas', async () => {
    const root = await workspace();
    const project = join(root, 'app');
    await mkdir(project);
    await registerGenerated(root, project);
    const { value } = deps(root, { launch: async () => false });
    expect(await openProjectFolder(project, value)).toEqual({ ok: false, reason: 'failed' });
  });
});

describe('openProjectFolder l’ouverture', () => {
  it('lance le gestionnaire du système sur le chemin du registre', async () => {
    const root = await workspace();
    const project = join(root, 'mon projet');
    await mkdir(project);
    await registerGenerated(root, project);
    const { value, launched } = deps(root, { platform: 'linux' });
    // Une autre écriture du même dossier (barre finale) désigne la même entrée.
    const outcome = await openProjectFolder(`${project}/`, value);
    expect(outcome).toEqual({ ok: true, directory: project });
    expect(launched).toEqual([{ command: 'xdg-open', args: [project] }]);
  });
});

describe('openProjectFolderAction les refus de l’action', () => {
  it('refuse en mode hébergé', async () => {
    process.env['PF_HOSTED'] = '1';
    const outcome = await openProjectFolderAction('C:\\Projets\\app');
    expect(outcome).toEqual({ ok: false, reason: 'hosted' });
  });

  it('refuse une entrée vide ou hostile', async () => {
    process.env['PF_WEB_WORKSPACE'] = await workspace();
    expect(await openProjectFolderAction(undefined)).toEqual({ ok: false, reason: 'empty' });
    expect(await openProjectFolderAction({ path: '/' })).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuse un dossier hors du registre du dossier de travail', async () => {
    const root = await workspace();
    process.env['PF_WEB_WORKSPACE'] = root;
    expect(await openProjectFolderAction(tmpdir())).toEqual({
      ok: false,
      reason: 'notRegistered',
    });
  });

  it('refuse un dossier inscrit qui n’existe plus', async () => {
    const root = await workspace();
    process.env['PF_WEB_WORKSPACE'] = root;
    await registerGenerated(root, join(root, 'disparu'));
    expect(await openProjectFolderAction(join(root, 'disparu'))).toEqual({
      ok: false,
      reason: 'missing',
    });
  });
});

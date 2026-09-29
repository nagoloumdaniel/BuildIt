import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { configDir } from './key.js';

// Valeur de test, pas une clé : elle ne doit jamais réapparaître en sortie.
const KEY = 'test-cle-factice-0123456789';

async function env(): Promise<{ PF_CONFIG_DIR: string }> {
  return { PF_CONFIG_DIR: join(await mkdtemp(join(tmpdir(), 'pf-key-')), 'config') };
}

describe('pf key', () => {
  it('set lit l’entrée standard, écrit un fichier 0600 dans un dossier 0700', async () => {
    const vars = await env();
    const io = fakeIo({ env: vars, stdin: `${KEY}\n` });
    expect(await run(['key', 'set'], io)).toBe(0);
    const file = join(vars.PF_CONFIG_DIR, 'credentials.json');
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ llmApiKey: KEY });
    if (process.platform !== 'win32') {
      expect((await stat(file)).mode & 0o777).toBe(0o600);
      expect((await stat(vars.PF_CONFIG_DIR)).mode & 0o777).toBe(0o700);
    }
    expect(io.text().out).not.toContain(KEY);
  });

  it('set resserre les droits d’un fichier existant trop ouvert', async () => {
    const vars = await env();
    await run(['key', 'set'], fakeIo({ env: vars, stdin: 'ancienne' }));
    const file = join(vars.PF_CONFIG_DIR, 'credentials.json');
    await writeFile(file, '{}', { mode: 0o644 });
    const { chmod } = await import('node:fs/promises');
    await chmod(file, 0o644);
    await run(['key', 'set'], fakeIo({ env: vars, stdin: KEY }));
    if (process.platform !== 'win32') {
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    }
  });

  it('dans un terminal, la saisie est masquée', async () => {
    const vars = await env();
    const io = fakeIo({ env: vars, interactive: true, answers: [KEY] });
    expect(await run(['key', 'set'], io)).toBe(0);
    expect(io.asked).toEqual(['Clé API :']);
  });

  it('refuse une clé en argument, sans l’écrire ni la répéter', async () => {
    const vars = await env();
    const io = fakeIo({ env: vars });
    expect(await run(['key', 'set', KEY], io)).toBe(2);
    expect(io.text().err).toContain('jamais en argument');
    expect(io.text().err).not.toContain(KEY);
    expect(io.text().out).not.toContain(KEY);
    await expect(readFile(join(vars.PF_CONFIG_DIR, 'credentials.json'))).rejects.toThrow();
  });

  it('refuse une clé vide', async () => {
    expect(await run(['key', 'set'], fakeIo({ env: await env(), stdin: '  \n' }))).toBe(2);
  });

  it('status dit si une clé est définie, sans jamais l’afficher', async () => {
    const vars = await env();
    const before = fakeIo({ env: vars });
    expect(await run(['key', 'status'], before)).toBe(0);
    expect(before.text().out).toContain('non définie');

    await run(['key', 'set'], fakeIo({ env: vars, stdin: KEY }));
    const after = fakeIo({ env: vars });
    expect(await run(['key', 'status'], after)).toBe(0);
    expect(after.text().out).toContain('définie');
    expect(after.text().out).not.toContain('non définie');
    // Pas même en partie.
    for (let i = 0; i + 4 <= KEY.length; i += 1) {
      expect(after.text().out).not.toContain(KEY.slice(i, i + 4 + 6));
    }
  });

  it('status traite un fichier illisible comme « non définie »', async () => {
    const vars = await env();
    await run(['key', 'set'], fakeIo({ env: vars, stdin: KEY }));
    await writeFile(join(vars.PF_CONFIG_DIR, 'credentials.json'), 'pas du json');
    const io = fakeIo({ env: vars });
    await run(['key', 'status'], io);
    expect(io.text().out).toContain('non définie');
    await writeFile(join(vars.PF_CONFIG_DIR, 'credentials.json'), 'null');
    const io2 = fakeIo({ env: vars });
    await run(['key', 'status'], io2);
    expect(io2.text().out).toContain('non définie');
  });

  it('clear supprime la clé, et ne se plaint pas si elle n’existe pas', async () => {
    const vars = await env();
    await run(['key', 'set'], fakeIo({ env: vars, stdin: KEY }));
    expect(await run(['key', 'clear'], fakeIo({ env: vars }))).toBe(0);
    expect(await run(['key', 'clear'], fakeIo({ env: vars }))).toBe(0);
    const io = fakeIo({ env: vars });
    await run(['key', 'status'], io);
    expect(io.text().out).toContain('non définie');
  });

  it('sans action : l’aide, code 2 ; --help : code 0 ; action inconnue : code 2', async () => {
    expect(await run(['key'], fakeIo())).toBe(2);
    expect(await run(['key', '--help'], fakeIo())).toBe(0);
    expect(await run(['key', 'show'], fakeIo())).toBe(2);
  });
});

describe('configDir', () => {
  it('PF_CONFIG_DIR d’abord', () => {
    expect(configDir({ PF_CONFIG_DIR: '/x', XDG_CONFIG_HOME: '/y' }, 'linux')).toBe('/x');
  });

  it('APPDATA sous Windows', () => {
    expect(configDir({ APPDATA: 'C:/AppData' }, 'win32')).toBe(
      join('C:/AppData', 'project-factory'),
    );
  });

  it('XDG_CONFIG_HOME, puis ~/.config', () => {
    expect(configDir({ XDG_CONFIG_HOME: '/xdg' }, 'linux')).toBe(join('/xdg', 'project-factory'));
    expect(configDir({ HOME: '/home/u' }, 'darwin')).toBe(
      join('/home/u', '.config', 'project-factory'),
    );
    expect(configDir({ USERPROFILE: '/p' }, 'linux')).toBe(
      join('/p', '.config', 'project-factory'),
    );
    expect(configDir({}, 'linux')).toBe(join('.', '.config', 'project-factory'));
  });
});

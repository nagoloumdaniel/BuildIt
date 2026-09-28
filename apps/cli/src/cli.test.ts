import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HELP, run, VERSION } from './cli.js';
import { PENDING } from './commands/pending.js';
import { fakeIo } from './fake-io.js';

describe('pf', () => {
  it('affiche sa version, celle du paquet', async () => {
    const io = fakeIo();
    expect(await run(['--version'], io)).toBe(0);
    expect(io.stdout).toEqual([VERSION]);
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it.each([['--help'], ['-h'], ['help']])('affiche l’aide avec %s', async (flag) => {
    const io = fakeIo();
    expect(await run([flag], io)).toBe(0);
    expect(io.text().out).toBe(HELP);
  });

  it('l’aide nomme chaque commande livrée et celles à venir', () => {
    for (const command of ['create', 'template', 'generate', 'graph', 'add', 'key']) {
      expect(HELP).toContain(command);
    }
    for (const command of Object.keys(PENDING)) {
      expect(HELP).toContain(command);
    }
  });

  it('propose la commande la plus proche d’une faute de frappe', async () => {
    const io = fakeIo();
    expect(await run(['creat'], io)).toBe(2);
    expect(io.text().err).toContain('Vouliez-vous dire « pf create » ?');
  });

  it('renvoie vers l’aide quand rien n’est proche', async () => {
    const io = fakeIo();
    expect(await run(['zzzzzzzzzz'], io)).toBe(2);
    expect(io.text().err).toContain('pf --help');
  });

  it.each(Object.keys(PENDING))('pf %s existe et dit quand il arrive, code 2', async (command) => {
    const io = fakeIo();
    expect(await run([command], io)).toBe(2);
    expect(io.text().err).toMatch(/pas encore disponible : (Phase 7B|Phase 9|V1|V2)/);
  });

  it('un drapeau inconnu est une erreur d’usage, pas un plantage', async () => {
    const io = fakeIo();
    expect(await run(['create', '--bogus'], io)).toBe(2);
    expect(io.text().err).toContain('--bogus');
    expect(io.text().err).toContain('pf create --help');
  });

  it('une erreur inattendue devient un message et le code 1', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pf-cli-'));
    const blocker = join(dir, 'fichier');
    await writeFile(blocker, '');
    // Le répertoire de configuration est un fichier : mkdir échoue.
    const io = fakeIo({ env: { PF_CONFIG_DIR: join(blocker, 'sous-dossier') }, stdin: 'cle' });
    expect(await run(['key', 'set'], io)).toBe(1);
    expect(io.text().err).toMatch(/^✗ Erreur inattendue/);
  });

  describe('menu d’accueil', () => {
    it('hors terminal, affiche l’aide sans rien demander', async () => {
      const io = fakeIo();
      expect(await run([], io)).toBe(0);
      expect(io.text().out).toBe(HELP);
      expect(io.asked).toEqual([]);
    });

    it('propose créer, et cloner / ouvrir désactivés jusqu’à la Phase 7B', async () => {
      const io = fakeIo({ interactive: true, answers: ['help'] });
      expect(await run([], io)).toBe(0);
      const choices = io.offered[0] ?? [];
      expect(choices.map((choice) => [choice.value, choice.disabled === true])).toEqual([
        ['create', false],
        ['clone', true],
        ['open', true],
        ['help', false],
      ]);
    });
  });
});

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeWorld } from '../fake-world.js';

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pf-open-'));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

const NODE = { 'package.json': '{}', 'yarn.lock': '' };
const ok = () => ({ exitCode: 0, output: '' });

describe('pf open', () => {
  it('--help', async () => {
    expect(await run(['open', '--help'], fakeIo())).toBe(0);
    expect(await run(['install', '--help'], fakeIo())).toBe(0);
  });

  // Gate 7B : aucune installation sans confirmation ou --yes explicite.
  it('hors terminal, sans --yes : montre la commande, ne lance rien', async () => {
    const world = fakeWorld({ yarn: ok });
    const io = fakeIo({ runner: world });
    expect(await run(['open', await project(NODE)], io)).toBe(0);
    expect(world.calls).toEqual([]);
    expect(io.text().out).toContain('Rien n’a été installé. Pour installer : yarn install');
  });

  it('--yes : installe', async () => {
    const world = fakeWorld({ yarn: ok });
    expect(await run(['open', await project(NODE), '--yes'], fakeIo({ runner: world }))).toBe(0);
    expect(world.calls.map((call) => [call.command, ...call.args].join(' '))).toEqual([
      'yarn install',
    ]);
  });

  it('dans un terminal : installer normalement est proposé en premier pour un projet local', async () => {
    const world = fakeWorld({ yarn: ok });
    const io = fakeIo({ runner: world, interactive: true, answers: ['scripts'] });
    expect(await run(['open', await project(NODE)], io)).toBe(0);
    expect(io.offered[0]?.map((choice) => choice.value)).toEqual(['scripts', 'safe', 'skip']);
    expect(io.text().out).toContain('✓ Dépendances installées.');
  });

  it('--ignore-scripts dans un terminal : une confirmation, oui ou non', async () => {
    const dir = await project(NODE);
    const yes = fakeWorld({ yarn: ok });
    const io = fakeIo({ runner: yes, interactive: true, answers: [true] });
    await run(['open', dir, '--ignore-scripts'], io);
    expect(io.asked).toEqual(['Lancer « yarn install --ignore-scripts » ?']);
    expect(yes.calls).toHaveLength(1);
    const no = fakeWorld({ yarn: ok });
    await run(
      ['open', dir, '--ignore-scripts'],
      fakeIo({ runner: no, interactive: true, answers: [false] }),
    );
    expect(no.calls).toEqual([]);
  });

  it('avertissements de détection affichés', async () => {
    const io = fakeIo({ runner: fakeWorld() });
    await run(['open', await project({ 'package.json': '{}' })], io);
    expect(io.text().out).toContain('npm (supposé)');
    expect(io.text().out).toContain('! Ni verrou ni champ packageManager');
  });

  it('un projet Rust : nommé, avec la commande à lancer soi-même', async () => {
    const io = fakeIo({ runner: fakeWorld() });
    expect(await run(['open', await project({ 'Cargo.toml': '' }), '--yes'], io)).toBe(0);
    expect(io.text().out).toContain('Rust (d’après Cargo.toml)');
    expect(io.text().out).toContain('Lancez : cargo fetch');
  });

  it('aucun projet reconnu : code 1', async () => {
    expect(await run(['open', await project({})], fakeIo())).toBe(1);
  });

  it('installation en échec : code 1, et relancer si passager', async () => {
    const world = fakeWorld({ yarn: () => ({ exitCode: 1, output: 'getaddrinfo EAI_AGAIN' }) });
    const io = fakeIo({ runner: world });
    expect(await run(['open', await project(NODE), '--yes'], io)).toBe(1);
    expect(io.text().err).toContain('relancez pf install');
    const hard = fakeIo({ runner: fakeWorld({ yarn: () => ({ exitCode: 1, output: 'boom' }) }) });
    expect(await run(['open', await project(NODE), '--yes'], hard)).toBe(1);
    expect(hard.text().err).not.toContain('relancez');
  });

  it('sans dossier : demandé dans un terminal, erreur sinon', async () => {
    expect(await run(['open'], fakeIo())).toBe(2);
    expect(await run(['open', 'a', 'b'], fakeIo())).toBe(2);
    const dir = await project(NODE);
    const io = fakeIo({ interactive: true, answers: [dir, 'skip'], runner: fakeWorld() });
    expect(await run(['open'], io)).toBe(0);
    expect(io.asked[0]).toBe('Dossier du projet :');
  });
});

describe('pf install', () => {
  it('agit sur le dossier courant', async () => {
    const world = fakeWorld({ yarn: ok });
    const cwd = await project(NODE);
    expect(await run(['install', '--yes'], fakeIo({ cwd, runner: world }))).toBe(0);
    expect(world.calls[0]?.cwd).toBe(cwd);
  });

  it('refuse un dossier en argument, renvoie vers pf open', async () => {
    const io = fakeIo();
    expect(await run(['install', 'ailleurs'], io)).toBe(2);
    expect(io.text().err).toContain('pf open');
  });
});

import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeFetch, fakeWorld } from '../fake-world.js';

const TOKEN = ['gho', 'JetonDeTestFactice0000000000000000000'].join('_');
const temp = (): Promise<string> => mkdtemp(join(tmpdir(), 'pf-clone-'));

/** git qui « clone » un projet pnpm dans le dossier cible. */
function gitCloning(result = { exitCode: 0, output: '' }) {
  return async (args: readonly string[]) => {
    const target = args.at(-1) as string;
    await writeFile(join(target, 'package.json'), '{"name":"hello"}');
    await writeFile(join(target, 'pnpm-lock.yaml'), '');
    return result;
  };
}

const pnpmOk = () => ({ exitCode: 0, output: '' });

describe('pf clone', () => {
  it('--help', async () => {
    const io = fakeIo();
    expect(await run(['clone', '--help'], io)).toBe(0);
    expect(io.text().out).toContain('--ignore-scripts');
  });

  // Gate 7B : rejetés avant tout appel à Git.
  it.each([
    ['--', '--upload-pack=touch /tmp/x'],
    ['ext::sh -c touch% /tmp/x'],
    ['file:///etc'],
    ['http://github.com/a/b'],
  ])('refuse %s sans lancer aucune commande', async (...link) => {
    const world = fakeWorld({ git: gitCloning() });
    const io = fakeIo({ cwd: await temp(), runner: world });
    expect(await run(['clone', ...link.filter((part) => part !== undefined)], io)).toBe(2);
    expect(world.calls.filter((call) => call.command !== 'secret-tool')).toEqual([]);
  });

  it('un drapeau glissé comme lien est une erreur d’usage', async () => {
    const world = fakeWorld({ git: gitCloning() });
    expect(await run(['clone', '--upload-pack=x'], fakeIo({ runner: world }))).toBe(2);
    expect(world.calls).toEqual([]);
  });

  it('hors terminal, sans --install : clone, n’installe rien, dit la commande', async () => {
    const cwd = await temp();
    const world = fakeWorld({ git: gitCloning(), pnpm: pnpmOk });
    const io = fakeIo({ cwd, runner: world });
    expect(await run(['clone', 'octocat/Hello-World'], io)).toBe(0);
    expect(world.calls.some((call) => call.command === 'pnpm')).toBe(false);
    const out = io.text().out;
    expect(out).toContain('Projet : JavaScript / TypeScript — pnpm (d’après pnpm-lock.yaml)');
    expect(out).toContain('Code que vous n’avez pas écrit');
    expect(out).toContain('Rien n’a été installé. Pour installer : pnpm install');
    expect(out).toContain('cd Hello-World');
    expect(await readdir(cwd)).toEqual(['Hello-World']);
  });

  it('--install --ignore-scripts : installe sans scripts, sans question', async () => {
    const world = fakeWorld({ git: gitCloning(), pnpm: pnpmOk });
    const io = fakeIo({ cwd: await temp(), runner: world, interactive: true });
    expect(
      await run(['clone', 'octocat/Hello-World', 'ici', '--install', '--ignore-scripts'], io),
    ).toBe(0);
    expect(world.calls.find((call) => call.command === 'pnpm')?.args).toEqual([
      'install',
      '--ignore-scripts',
    ]);
    expect(io.asked).toEqual([]);
  });

  it('dans un terminal : « sans scripts » est proposé en premier pour du code cloné', async () => {
    const world = fakeWorld({ git: gitCloning(), pnpm: pnpmOk });
    const io = fakeIo({ cwd: await temp(), runner: world, interactive: true, answers: ['safe'] });
    expect(await run(['clone', 'octocat/Hello-World'], io)).toBe(0);
    expect(io.offered[0]?.map((choice) => choice.value)).toEqual(['safe', 'scripts', 'skip']);
    expect(io.offered[0]?.[0]?.hint).toContain('pnpm install --ignore-scripts');
    expect(world.calls.find((call) => call.command === 'pnpm')?.args).toEqual([
      'install',
      '--ignore-scripts',
    ]);
  });

  it('dans un terminal : « ne pas installer » ne lance rien', async () => {
    const world = fakeWorld({ git: gitCloning(), pnpm: pnpmOk });
    const io = fakeIo({ cwd: await temp(), runner: world, interactive: true, answers: ['skip'] });
    expect(await run(['clone', 'octocat/Hello-World'], io)).toBe(0);
    expect(world.calls.some((call) => call.command === 'pnpm')).toBe(false);
  });

  it('connecté : le jeton va à git par l’environnement, jamais à l’écran', async () => {
    const world = fakeWorld({ git: gitCloning() }, { value: TOKEN });
    const io = fakeIo({ cwd: await temp(), runner: world });
    expect(await run(['clone', 'octocat/private-repo'], io)).toBe(0);
    const git = world.calls.find((call) => call.command === 'git');
    expect(git?.options?.env?.['PF_GIT_TOKEN']).toBe(TOKEN);
    expect(git?.args.join(' ')).not.toContain(TOKEN);
    expect(`${io.text().out}${io.text().err}`).not.toContain(TOKEN);
  });

  it('un clone qui échoue : code 1, aucun dossier laissé', async () => {
    const cwd = await temp();
    const world = fakeWorld({
      git: gitCloning({ exitCode: 128, output: 'remote: Repository not found.' }),
    });
    const io = fakeIo({ cwd, runner: world });
    expect(await run(['clone', 'octocat/nope'], io)).toBe(1);
    expect(io.text().err).toContain('pf login');
    expect(await readdir(cwd)).toEqual([]);
  });

  it('hors terminal, sans lien : erreur d’usage', async () => {
    expect(await run(['clone'], fakeIo({ runner: fakeWorld() }))).toBe(2);
    expect(await run(['clone', 'a/b', 'c', 'd'], fakeIo({ runner: fakeWorld() }))).toBe(2);
  });

  it('dans un terminal, connecté, sans lien : choisir parmi ses dépôts', async () => {
    const world = fakeWorld({ git: gitCloning() }, { value: TOKEN });
    const fetch = fakeFetch({
      'GET /user/repos': {
        status: 200,
        body: [
          {
            full_name: 'octocat/demo',
            name: 'demo',
            owner: { login: 'octocat' },
            private: true,
            description: 'Démo',
          },
        ],
      },
    });
    const io = fakeIo({
      cwd: await temp(),
      runner: world,
      fetch,
      interactive: true,
      answers: ['octocat/demo', 'skip'],
    });
    expect(await run(['clone'], io)).toBe(0);
    expect(io.offered[0]).toEqual([
      { value: 'octocat/demo', label: 'octocat/demo', hint: 'privé — Démo' },
    ]);
    expect(world.calls.find((call) => call.command === 'git')?.args).toContain(
      'https://github.com/octocat/demo.git',
    );
  });

  it('dans un terminal, non connecté, ou liste en échec : on demande le lien', async () => {
    const io = fakeIo({
      cwd: await temp(),
      runner: fakeWorld({ git: gitCloning() }),
      interactive: true,
      answers: ['a/b', 'skip'],
    });
    expect(await run(['clone'], io)).toBe(0);
    expect(io.asked[0]).toBe('Lien du dépôt (ou propriétaire/dépôt) :');

    const failing = fakeIo({
      cwd: await temp(),
      runner: fakeWorld({ git: gitCloning() }, { value: TOKEN }),
      fetch: fakeFetch({ 'GET /user/repos': { status: 401 } }),
      interactive: true,
      answers: ['a/b', 'skip'],
    });
    expect(await run(['clone'], failing)).toBe(0);
    expect(failing.text().err).toContain('pf login');
  });

  it('un dépôt qui n’est pas un projet reconnu : cloné, rien à installer, code 0', async () => {
    const world = fakeWorld({
      git: async (args) => {
        await writeFile(join(args.at(-1) as string, 'README'), 'Hello');
        return { exitCode: 0, output: '' };
      },
    });
    const io = fakeIo({ cwd: await temp(), runner: world });
    expect(await run(['clone', 'octocat/Hello-World'], io)).toBe(0);
    expect(io.text().out).toContain('Aucun projet reconnu dans ce dépôt : rien à installer.');
  });

  it('un lien dont on ne tire pas de nom de dossier exige le dossier', async () => {
    const io = fakeIo({ cwd: await temp(), runner: fakeWorld() });
    expect(await run(['clone', 'https://example.com/a/b%20c'], io)).toBe(2);
  });
});

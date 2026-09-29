import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeFetch, fakeGit, fakeWorld } from '../fake-world.js';

const TOKEN = ['gho', 'JetonDeTestFactice0000000000000000000'].join('_');
const USER = { 'GET /user': { status: 200, body: { login: 'octocat' } } };

async function project(pkg?: object): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pf-repo-'));
  if (pkg !== undefined) {
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
  }
  return dir;
}

const created = (name: string, isPrivate = true) => ({
  'POST /user/repos': {
    status: 201,
    body: {
      name,
      private: isPrivate,
      owner: { login: 'octocat' },
      html_url: `https://github.com/octocat/${name}`,
    },
  },
});

describe('pf repo create', () => {
  // Gate 7B : un dépôt créé est privé sauf --public explicite.
  it('crée un dépôt privé nommé d’après package.json, puis pousse', async () => {
    const dir = await project({ name: '@equipe/boutique' });
    const world = fakeWorld({ git: fakeGit(dir) }, { value: TOKEN });
    const fetch = fakeFetch({ ...USER, ...created('boutique') });
    const io = fakeIo({ cwd: dir, runner: world, fetch });
    expect(await run(['repo', 'create', '--yes'], io)).toBe(0);
    expect(JSON.parse(fetch.requests.find((r) => r.method === 'POST')?.body ?? '{}')).toEqual({
      name: 'boutique',
      private: true,
    });
    const lines = world.calls
      .filter((call) => call.command === 'git')
      .map((call) => call.args.join(' '));
    expect(lines).toContain('remote add origin https://github.com/octocat/boutique.git');
    expect(lines.some((line) => line.endsWith('push --set-upstream origin HEAD'))).toBe(true);
    expect(io.text().out).toContain('✓ Dépôt privé créé : https://github.com/octocat/boutique');
    expect(`${io.text().out}${lines.join('\n')}`).not.toContain(TOKEN);
  });

  it('--public, --name, --description, --dir', async () => {
    const dir = await project();
    const world = fakeWorld({ git: fakeGit(dir) }, { value: TOKEN });
    const fetch = fakeFetch({ ...USER, ...created('vitrine', false) });
    const io = fakeIo({ cwd: '/', runner: world, fetch });
    expect(
      await run(
        [
          'repo',
          'create',
          '--public',
          '--name',
          'vitrine',
          '--description',
          'Un site',
          '--dir',
          dir,
          '--yes',
        ],
        io,
      ),
    ).toBe(0);
    expect(JSON.parse(fetch.requests.find((r) => r.method === 'POST')?.body ?? '{}')).toEqual({
      name: 'vitrine',
      private: false,
      description: 'Un site',
    });
    expect(io.text().out).toContain('Dépôt public créé');
  });

  it('sans --yes hors terminal : annonce, ne crée rien', async () => {
    const dir = await project({ name: 'demo' });
    const fetch = fakeFetch(USER);
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld({ git: fakeGit(dir) }, { value: TOKEN }),
      fetch,
    });
    expect(await run(['repo', 'create'], io)).toBe(0);
    expect(io.text().out).toContain('Créer le dépôt privé octocat/demo');
    expect(fetch.requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('dans un terminal : confirmation ; non = rien de créé', async () => {
    const dir = await project({ name: 'demo' });
    const fetch = fakeFetch(USER);
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld({ git: fakeGit(dir) }, { value: TOKEN }),
      fetch,
      interactive: true,
      answers: [false],
    });
    expect(await run(['repo', 'create'], io)).toBe(0);
    expect(fetch.requests.some((r) => r.method === 'POST')).toBe(false);
    const yes = fakeFetch({ ...USER, ...created('demo') });
    const confirmed = fakeIo({
      cwd: dir,
      runner: fakeWorld({ git: fakeGit(dir) }, { value: TOKEN }),
      fetch: yes,
      interactive: true,
      answers: [true],
    });
    expect(await run(['repo', 'create'], confirmed)).toBe(0);
  });

  it('un projet qui a déjà un origin : refus, rien de créé', async () => {
    const dir = await project();
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld(
        { git: fakeGit(dir, { origin: 'https://github.com/a/b.git' }) },
        { value: TOKEN },
      ),
    });
    expect(await run(['repo', 'create', '--yes'], io)).toBe(1);
    expect(io.text().err).toContain('pf repo share');
    const other = fakeIo({
      cwd: dir,
      runner: fakeWorld(
        { git: fakeGit(dir, { origin: 'https://gitlab.com/a/b.git' }) },
        { value: TOKEN },
      ),
    });
    expect(await run(['repo', 'create', '--yes'], other)).toBe(1);
  });

  it('non connecté : dit comment se connecter', async () => {
    const dir = await project();
    const io = fakeIo({ cwd: dir, runner: fakeWorld({ git: fakeGit(dir) }) });
    expect(await run(['repo', 'create', '--yes'], io)).toBe(1);
    expect(io.text().err).toContain('pf login');
  });

  it('nom déjà pris : refus, rien n’est poussé', async () => {
    const dir = await project({ name: 'demo' });
    const world = fakeWorld({ git: fakeGit(dir) }, { value: TOKEN });
    const fetch = fakeFetch({
      ...USER,
      'POST /user/repos': {
        status: 422,
        body: {
          message: 'Repository creation failed.',
          errors: [{ message: 'name already exists on this account' }],
        },
      },
    });
    const io = fakeIo({ cwd: dir, runner: world, fetch });
    expect(await run(['repo', 'create', '--yes'], io)).toBe(1);
    expect(io.text().err).toContain('existe déjà');
    expect(world.calls.some((call) => call.args.includes('push'))).toBe(false);
  });

  it('commit impossible : rien n’est créé sur GitHub', async () => {
    const dir = await project({ name: 'demo' });
    const fetch = fakeFetch(USER);
    const world = fakeWorld(
      {
        git: fakeGit(dir, {
          commit: false,
          commitResult: { exitCode: 128, output: 'Please tell me who you are' },
        }),
      },
      { value: TOKEN },
    );
    const io = fakeIo({ cwd: dir, runner: world, fetch });
    expect(await run(['repo', 'create', '--yes'], io)).toBe(1);
    expect(io.text().err).toContain('Rien n’a été créé sur GitHub');
    expect(fetch.requests.some((r) => r.method === 'POST')).toBe(false);
  });

  it('push en échec après création : dit que le dépôt existe et quoi relancer', async () => {
    const dir = await project({ name: 'demo' });
    const world = fakeWorld(
      { git: fakeGit(dir, { push: { exitCode: 1, output: 'rejected' } }) },
      { value: TOKEN },
    );
    const io = fakeIo({
      cwd: dir,
      runner: world,
      fetch: fakeFetch({ ...USER, ...created('demo') }),
    });
    expect(await run(['repo', 'create', '--yes'], io)).toBe(1);
    expect(io.text().err).toContain('a été créé, mais l’envoi du code a échoué');
    expect(io.text().err).toContain('git push --set-upstream origin HEAD');
  });

  it('nom invalide, argument en trop, compte illisible', async () => {
    const dir = await project({ name: 'pas bon' });
    expect(await run(['repo', 'create'], fakeIo({ cwd: dir }))).toBe(2);
    expect(await run(['repo', 'create', 'x'], fakeIo({ cwd: dir }))).toBe(2);
    const denied = fakeIo({
      cwd: dir,
      runner: fakeWorld({ git: fakeGit(dir) }, { value: TOKEN }),
      fetch: fakeFetch({ 'GET /user': { status: 401 } }),
    });
    expect(await run(['repo', 'create', '--name', 'ok', '--yes'], denied)).toBe(1);
  });

  it('git absent', async () => {
    const dir = await project();
    expect(await run(['repo', 'create', '--yes'], fakeIo({ cwd: dir, runner: fakeWorld() }))).toBe(
      1,
    );
  });
});

describe('pf repo share', () => {
  // Gate 7B : sur un projet sans dépôt GitHub, refus avec la marche à suivre.
  it('sans dépôt GitHub : refus, avec pf repo create et le lien de configuration', async () => {
    const dir = await project();
    const io = fakeIo({ cwd: dir, runner: fakeWorld({ git: fakeGit(dir) }, { value: TOKEN }) });
    expect(await run(['repo', 'share'], io)).toBe(1);
    expect(io.text().err).toContain('pf repo create');
    expect(io.text().err).toContain('lecture seule');
  });

  it('un dossier hors dépôt Git est refusé de même', async () => {
    const dir = await project();
    const git = () => ({ exitCode: 128, output: 'fatal: not a git repository' });
    const io = fakeIo({ cwd: dir, runner: fakeWorld({ git }) });
    expect(await run(['repo', 'share'], io)).toBe(1);
    expect(io.text().err).toContain('pf repo create');
  });

  it('avec un dépôt GitHub : lien, collaborateurs, invitations', async () => {
    const dir = await project();
    const fetch = fakeFetch({
      'GET /repos/octocat/demo/collaborators': {
        status: 200,
        body: [{ login: 'octocat', role_name: 'admin' }],
      },
      'GET /repos/octocat/demo/invitations': {
        status: 200,
        body: [{ id: 1, invitee: { login: 'mona' }, permissions: 'write' }],
      },
    });
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld(
        { git: fakeGit(dir, { origin: 'git@github.com:octocat/demo.git' }) },
        { value: TOKEN },
      ),
      fetch,
    });
    expect(await run(['repo', 'share'], io)).toBe(0);
    const out = io.text().out;
    expect(out).toContain('Dépôt : https://github.com/octocat/demo');
    expect(out).toMatch(/octocat\s+admin/);
    expect(out).toContain('Invitations en attente');
    expect(out).toMatch(/mona\s+write/);
  });

  it('non connecté : le lien, puis la piste de connexion', async () => {
    const dir = await project();
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld({ git: fakeGit(dir, { origin: 'https://github.com/octocat/demo' }) }),
    });
    expect(await run(['repo', 'share'], io)).toBe(1);
    expect(io.text().out).toContain('https://github.com/octocat/demo');
    expect(io.text().err).toContain('pf login');
  });

  it('accès refusé aux listes : la raison', async () => {
    const dir = await project();
    const fetch = fakeFetch({
      'GET /repos/octocat/demo/collaborators': { status: 403 },
      'GET /repos/octocat/demo/invitations': { status: 403 },
    });
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld(
        { git: fakeGit(dir, { origin: 'https://github.com/octocat/demo' }) },
        { value: TOKEN },
      ),
      fetch,
    });
    expect(await run(['repo', 'share'], io)).toBe(1);
    expect(io.text().err).toContain('administrateur');
  });

  it('argument en trop ; aide ; action inconnue', async () => {
    expect(await run(['repo', 'share', 'x'], fakeIo())).toBe(2);
    expect(await run(['repo'], fakeIo())).toBe(2);
    expect(await run(['repo', '--help'], fakeIo())).toBe(0);
    expect(await run(['repo', 'delete'], fakeIo())).toBe(2);
  });
});

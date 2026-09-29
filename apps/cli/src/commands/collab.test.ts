import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeFetch, fakeGit, fakeWorld } from '../fake-world.js';

const TOKEN = ['gho', 'JetonDeTestFactice0000000000000000000'].join('_');

async function github(
  routes: Parameters<typeof fakeFetch>[0],
  options: { interactive?: boolean; answers?: boolean[] } = {},
) {
  const dir = await mkdtemp(join(tmpdir(), 'pf-collab-'));
  const fetch = fakeFetch(routes);
  const io = fakeIo({
    cwd: dir,
    runner: fakeWorld(
      { git: fakeGit(dir, { origin: 'https://github.com/octocat/demo.git' }) },
      { value: TOKEN },
    ),
    fetch,
    ...(options.interactive === undefined ? {} : { interactive: options.interactive }),
    ...(options.answers === undefined ? {} : { answers: options.answers }),
  });
  return { io, fetch };
}

describe('pf collab add', () => {
  it('invite avec le rôle demandé (write par défaut)', async () => {
    const { io, fetch } = await github({
      'PUT /repos/octocat/demo/collaborators/mona': [{ status: 201, body: {} }, { status: 204 }],
    });
    expect(await run(['collab', 'add', 'mona'], io)).toBe(0);
    expect(JSON.parse(fetch.requests[0]?.body ?? '{}')).toEqual({ permission: 'push' });
    expect(io.text().out).toContain('mona est invité sur octocat/demo (write)');
    expect(await run(['collab', 'add', 'mona', '--role', 'maintain'], io)).toBe(0);
    expect(JSON.parse(fetch.requests[1]?.body ?? '{}')).toEqual({ permission: 'maintain' });
    expect(io.text().out).toContain('a déjà accès');
  });

  it('pas administrateur : la raison de GitHub et la piste', async () => {
    const { io } = await github({
      'PUT /repos/octocat/demo/collaborators/mona': {
        status: 403,
        body: { message: 'Must have admin rights' },
      },
    });
    expect(await run(['collab', 'add', 'mona'], io)).toBe(1);
    expect(io.text().err).toContain('pas administrateur');
  });

  it('rôle, nom d’utilisateur, nombre d’arguments', async () => {
    expect(await run(['collab', 'add', 'mona', '--role', 'owner'], fakeIo())).toBe(2);
    expect(await run(['collab', 'add', '-mona'], fakeIo())).toBe(2);
    expect(await run(['collab', 'add', 'a b'], fakeIo())).toBe(2);
    expect(await run(['collab', 'add'], fakeIo())).toBe(2);
    expect(await run(['collab', 'list', 'mona'], fakeIo())).toBe(2);
  });
});

describe('pf collab list', () => {
  it('collaborateurs et invitations', async () => {
    const { io } = await github({
      'GET /repos/octocat/demo/collaborators': {
        status: 200,
        body: [{ login: 'octocat', role_name: 'admin' }],
      },
      'GET /repos/octocat/demo/invitations': { status: 200, body: [] },
    });
    expect(await run(['collab', 'list'], io)).toBe(0);
    expect(io.text().out).toMatch(/octocat\s+admin/);
    expect(io.text().out).not.toContain('Invitations en attente');
  });
});

describe('pf collab remove', () => {
  const routes = () => ({
    'GET /repos/octocat/demo/invitations': { status: 200, body: [] },
    'GET /repos/octocat/demo/collaborators': {
      status: 200,
      body: [{ login: 'mona', role_name: 'write' }],
    },
    'DELETE /repos/octocat/demo/collaborators/mona': { status: 204 },
  });

  it('hors terminal sans --yes : ne retire rien', async () => {
    const { io, fetch } = await github(routes());
    expect(await run(['collab', 'remove', 'mona'], io)).toBe(0);
    expect(fetch.requests).toEqual([]);
    expect(io.text().out).toContain('--yes');
  });

  it('--yes : retire', async () => {
    const { io } = await github(routes());
    expect(await run(['collab', 'remove', 'mona', '--yes'], io)).toBe(0);
    expect(io.text().out).toContain('mona n’a plus accès');
  });

  it('dans un terminal : confirmation, oui ou non', async () => {
    const no = await github(routes(), { interactive: true, answers: [false] });
    expect(await run(['collab', 'remove', 'mona'], no.io)).toBe(0);
    expect(no.fetch.requests).toEqual([]);
    const yes = await github(
      {
        'GET /repos/octocat/demo/invitations': {
          status: 200,
          body: [{ id: 3, invitee: { login: 'mona' } }],
        },
        'DELETE /repos/octocat/demo/invitations/3': { status: 204 },
      },
      { interactive: true, answers: [true] },
    );
    expect(await run(['collab', 'remove', 'mona'], yes.io)).toBe(0);
    expect(yes.io.text().out).toContain('Invitation de mona annulée');
  });

  it('quelqu’un sans accès : refus nommé', async () => {
    const { io } = await github({
      'GET /repos/octocat/demo/invitations': { status: 200, body: [] },
      'GET /repos/octocat/demo/collaborators': { status: 200, body: [] },
    });
    expect(await run(['collab', 'remove', 'mona', '--yes'], io)).toBe(1);
  });
});

describe('pf collab — conditions', () => {
  it('projet sans dépôt GitHub : refus avec la marche à suivre', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pf-collab-'));
    const io = fakeIo({ cwd: dir, runner: fakeWorld({ git: fakeGit(dir) }, { value: TOKEN }) });
    expect(await run(['collab', 'list'], io)).toBe(1);
    expect(io.text().err).toContain('pf repo create');
  });

  it('non connecté', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pf-collab-'));
    const io = fakeIo({
      cwd: dir,
      runner: fakeWorld({ git: fakeGit(dir, { origin: 'https://github.com/o/r' }) }),
    });
    expect(await run(['collab', 'list'], io)).toBe(1);
    expect(io.text().err).toContain('pf login');
  });

  it('aide et action inconnue', async () => {
    expect(await run(['collab'], fakeIo())).toBe(2);
    expect(await run(['collab', '-h'], fakeIo())).toBe(0);
    expect(await run(['collab', 'invite'], fakeIo())).toBe(2);
  });
});

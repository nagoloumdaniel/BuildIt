import { describe, expect, it } from 'vitest';
import { GitHubClient } from './client.js';
import { fakeFetch } from './test-fetch.js';

const TOKEN = ['gho', 'JetonDeTestFactice000000000000000000'].join('_');
const REPO = { owner: 'octocat', name: 'demo' };

function client(routes: Parameters<typeof fakeFetch>[0]) {
  const fetch = fakeFetch(routes);
  return { api: new GitHubClient({ token: TOKEN, fetch }), fetch };
}

describe('GitHubClient', () => {
  it('s’authentifie par en-tête, version d’API fixée, jamais de jeton dans l’URL', async () => {
    const { api, fetch } = client({
      'GET /user': {
        status: 200,
        body: { login: 'octocat' },
        headers: { 'x-oauth-scopes': 'repo, read:org' },
      },
    });
    expect(await api.viewer()).toEqual({
      ok: true,
      value: { login: 'octocat', scopes: ['repo', 'read:org'] },
    });
    const [request] = fetch.requests;
    expect(request?.headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    expect(request?.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
    expect(request?.url).not.toContain(TOKEN);
  });

  it('un jeton à grain fin n’a pas d’en-tête de permissions', async () => {
    const { api } = client({ 'GET /user': { status: 200, body: { login: 'o' } } });
    const viewer = await api.viewer();
    expect(viewer.ok && viewer.value.scopes).toEqual([]);
  });

  it.each([
    [401, {}, 'GITHUB_UNAUTHORIZED', 'pf login'],
    [
      403,
      { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1790000000' },
      'GITHUB_RATE_LIMITED',
      '2026',
    ],
    [429, {}, 'GITHUB_RATE_LIMITED', 'plus tard'],
    [403, {}, 'GITHUB_FORBIDDEN', undefined],
    [404, {}, 'GITHUB_NOT_FOUND', 'privé'],
    [500, {}, 'GITHUB_UNEXPECTED', undefined],
  ])('HTTP %i ⇒ %s', async (status, headers, code, hint) => {
    const { api } = client({ 'GET /user': { status, headers, body: { message: 'Bad' } } });
    const result = await api.viewer();
    expect(!result.ok && result.issues[0]?.code).toBe(code);
    if (hint !== undefined) {
      expect(!result.ok && result.issues[0]?.hint).toContain(hint);
    }
  });

  it('réseau coupé ⇒ GITHUB_NETWORK, avec la piste', async () => {
    const { api } = client({ 'GET /user': 'network' });
    const result = await api.viewer();
    expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_NETWORK');
  });

  it('un corps illisible ne fait pas planter', async () => {
    const { api } = client({ 'GET /user': { status: 502, body: '<html>' } });
    expect((await api.viewer()).ok).toBe(false);
  });

  it('liste les dépôts récents du compte', async () => {
    const { api, fetch } = client({
      'GET /user/repos': {
        status: 200,
        body: [
          {
            name: 'demo',
            full_name: 'octocat/demo',
            private: true,
            description: null,
            owner: { login: 'octocat' },
            clone_url: 'https://github.com/octocat/demo.git',
            html_url: 'https://github.com/octocat/demo',
          },
        ],
      },
    });
    const result = await api.listRepositories();
    expect(result.ok && result.value).toEqual([
      {
        owner: 'octocat',
        name: 'demo',
        fullName: 'octocat/demo',
        private: true,
        description: '',
        cloneUrl: 'https://github.com/octocat/demo.git',
        htmlUrl: 'https://github.com/octocat/demo',
      },
    ]);
    expect(fetch.requests[0]?.url).toContain('sort=updated');
  });

  it('une liste qui n’est pas un tableau est vide', async () => {
    const { api } = client({ 'GET /user/repos': { status: 200, body: {} } });
    expect(await api.listRepositories()).toEqual({ ok: true, value: [] });
  });

  describe('createRepository', () => {
    it('envoie private tel que demandé', async () => {
      const { api, fetch } = client({
        'POST /user/repos': {
          status: 201,
          body: { name: 'demo', owner: { login: 'octocat' }, private: true },
        },
      });
      const result = await api.createRepository({
        name: 'demo',
        private: true,
        description: 'Un test',
      });
      expect(result.ok && result.value.private).toBe(true);
      expect(JSON.parse(fetch.requests[0]?.body ?? '{}')).toEqual({
        name: 'demo',
        private: true,
        description: 'Un test',
      });
    });

    it('nom déjà pris ⇒ GITHUB_REPO_EXISTS, rien de créé (réponse documentée)', async () => {
      const { api } = client({
        'POST /user/repos': {
          status: 422,
          body: {
            message: 'Repository creation failed.',
            errors: [
              {
                resource: 'Repository',
                code: 'custom',
                field: 'name',
                message: 'name already exists on this account',
              },
            ],
          },
        },
      });
      const result = await api.createRepository({ name: 'demo', private: true });
      expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_REPO_EXISTS');
      expect(!result.ok && result.issues[0]?.hint).toContain('--name');
    });

    it('autre refus 422 : la raison de GitHub, telle quelle', async () => {
      const { api } = client({
        'POST /user/repos': {
          status: 422,
          body: { message: 'Validation Failed', errors: [{ message: 'name is too long' }, 'x'] },
        },
      });
      const result = await api.createRepository({ name: 'demo', private: false });
      expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_INVALID');
      expect(!result.ok && result.issues[0]?.message).toContain(
        'Validation Failed — name is too long',
      );
    });
  });

  describe('collaborateurs', () => {
    it('invite avec le rôle traduit pour l’API', async () => {
      const { api, fetch } = client({
        'PUT /repos/octocat/demo/collaborators/mona': [{ status: 201, body: {} }, { status: 204 }],
      });
      expect(await api.addCollaborator(REPO, 'mona', 'write')).toEqual({
        ok: true,
        value: 'invited',
      });
      expect(JSON.parse(fetch.requests[0]?.body ?? '{}')).toEqual({ permission: 'push' });
      expect(await api.addCollaborator(REPO, 'mona', 'read')).toEqual({
        ok: true,
        value: 'already',
      });
      expect(JSON.parse(fetch.requests[1]?.body ?? '{}')).toEqual({ permission: 'pull' });
    });

    it('403 : le compte connecté n’est pas administrateur, dit tel quel', async () => {
      const { api } = client({
        'PUT /repos/octocat/demo/collaborators/mona': {
          status: 403,
          body: { message: 'Must have admin rights to Repository.' },
        },
      });
      const result = await api.addCollaborator(REPO, 'mona', 'admin');
      expect(!result.ok && result.issues[0]?.hint).toContain('pas administrateur');
    });

    it('liste collaborateurs et invitations en attente', async () => {
      const { api } = client({
        'GET /repos/octocat/demo/collaborators': {
          status: 200,
          body: [{ login: 'octocat', role_name: 'admin' }],
        },
        'GET /repos/octocat/demo/invitations': {
          status: 200,
          body: [{ id: 7, invitee: { login: 'mona' }, permissions: 'write' }],
        },
      });
      expect(await api.listCollaborators(REPO)).toEqual({
        ok: true,
        value: [{ login: 'octocat', role: 'admin' }],
      });
      expect(await api.listInvitations(REPO)).toEqual({
        ok: true,
        value: [{ id: 7, login: 'mona', role: 'write' }],
      });
    });

    it('les listes refusées portent la piste administrateur', async () => {
      const { api } = client({
        'GET /repos/octocat/demo/collaborators': { status: 403, body: {} },
        'GET /repos/octocat/demo/invitations': { status: 403, body: {} },
      });
      for (const result of [await api.listCollaborators(REPO), await api.listInvitations(REPO)]) {
        expect(!result.ok && result.issues[0]?.hint).toContain('administrateur');
      }
    });

    it('retirer : l’invitation en attente d’abord', async () => {
      const { api, fetch } = client({
        'GET /repos/octocat/demo/invitations': {
          status: 200,
          body: [{ id: 7, invitee: { login: 'Mona' }, permissions: 'read' }],
        },
        'DELETE /repos/octocat/demo/invitations/7': { status: 204 },
      });
      expect(await api.removeCollaborator(REPO, 'mona')).toEqual({ ok: true, value: 'invitation' });
      expect(fetch.requests.at(-1)?.method).toBe('DELETE');
    });

    it('retirer : sinon le collaborateur', async () => {
      const { api } = client({
        'GET /repos/octocat/demo/invitations': { status: 200, body: [] },
        'GET /repos/octocat/demo/collaborators': {
          status: 200,
          body: [{ login: 'mona', role_name: 'write' }],
        },
        'DELETE /repos/octocat/demo/collaborators/mona': { status: 204 },
      });
      expect(await api.removeCollaborator(REPO, 'mona')).toEqual({
        ok: true,
        value: 'collaborator',
      });
    });

    it('retirer quelqu’un qui n’a pas accès : refus nommé', async () => {
      const { api } = client({
        'GET /repos/octocat/demo/invitations': { status: 200, body: [] },
        'GET /repos/octocat/demo/collaborators': { status: 200, body: [] },
      });
      const result = await api.removeCollaborator(REPO, 'mona');
      expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_NOT_COLLABORATOR');
    });

    it('retirer : les échecs intermédiaires remontent', async () => {
      const denied = client({ 'GET /repos/octocat/demo/invitations': { status: 403, body: {} } });
      expect((await denied.api.removeCollaborator(REPO, 'x')).ok).toBe(false);
      const noList = client({
        'GET /repos/octocat/demo/invitations': { status: 200, body: {} },
        'GET /repos/octocat/demo/collaborators': { status: 500, body: {} },
      });
      expect((await noList.api.removeCollaborator(REPO, 'x')).ok).toBe(false);
      const deleteFails = client({
        'GET /repos/octocat/demo/invitations': {
          status: 200,
          body: [{ id: 1, invitee: { login: 'x' } }],
        },
        'DELETE /repos/octocat/demo/invitations/1': { status: 500 },
      });
      expect((await deleteFails.api.removeCollaborator(REPO, 'x')).ok).toBe(false);
    });
  });
});

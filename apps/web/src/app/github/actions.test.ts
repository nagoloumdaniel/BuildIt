import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  githubDisconnectAction,
  githubPermissionsAction,
  githubRepositoriesAction,
  githubStartDeviceAction,
  githubStatusAction,
  githubWaitDeviceAction,
} from '../actions-node';

/**
 * Les Server Actions GitHub, appelées directement.
 *
 * `globalThis.fetch` est remplacé par un faux et `PF_GITHUB_TOKEN` court-circuite
 * le trousseau : aucun test d'ici ne touche le réseau ni un vrai trousseau.
 * C'est aussi la preuve du §24 au niveau de l'API publique ce que l'action
 * rend au navigateur ne contient jamais le jeton.
 */

const TOKEN = 'ghp_action_0123456789abcdefgh';
const DEVICE_BODY = {
  device_code: 'device-secret-code',
  user_code: 'WXYZ-9876',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 0,
};

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

let calls: string[] = [];

function installFakeFetch(): void {
  calls = [];
  vi.stubGlobal('fetch', async (input: string) => {
    calls.push(input);
    if (input.includes('/login/device/code')) {
      return json(DEVICE_BODY);
    }
    if (input.includes('/login/oauth/access_token')) {
      return json({ access_token: TOKEN, scope: 'repo' });
    }
    if (input.includes('/user/repos')) {
      return json([
        {
          name: 'app',
          full_name: 'octocat/app',
          owner: { login: 'octocat' },
          private: false,
          description: '',
          clone_url: 'https://github.com/octocat/app.git',
          html_url: 'https://github.com/octocat/app',
        },
      ]);
    }
    if (input.includes('/user')) {
      return json({ login: 'octocat' }, 200, { 'x-oauth-scopes': 'repo' });
    }
    return json({ message: 'introuvable' }, 404);
  });
}

beforeEach(() => {
  process.env['PF_GITHUB_TOKEN'] = TOKEN;
  process.env['PF_GITHUB_CLIENT_ID'] = 'client-id';
  installFakeFetch();
});

afterEach(() => {
  delete process.env['PF_GITHUB_TOKEN'];
  delete process.env['PF_GITHUB_CLIENT_ID'];
  vi.unstubAllGlobals();
});

describe('githubStatusAction', () => {
  it('rend le compte connecté sans le jeton', async () => {
    const status = await githubStatusAction();

    expect(status.connected).toBe(true);
    expect(status.login).toBe('octocat');
    expect(status.store).toBe('variable PF_GITHUB_TOKEN');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});

describe('githubPermissionsAction', () => {
  it('annonce les permissions en clair, avant toute connexion', async () => {
    const permissions = await githubPermissionsAction();

    expect(permissions.map((permission) => permission.scope)).toContain('repo');
    expect(permissions[0]?.reason).toContain('dépôts privés');
  });
});

describe('githubRepositoriesAction', () => {
  it('rend les dépôts du compte connecté', async () => {
    const list = await githubRepositoriesAction();

    expect(list.ok).toBe(true);
    expect(list.repositories.map((repository) => repository.fullName)).toEqual(['octocat/app']);
  });
});

describe('la connexion par code, de bout en bout', () => {
  it('rend un code à saisir, puis refuse d’écraser un jeton d’environnement', async () => {
    const started = await githubStartDeviceAction();
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.value.userCode).toBe('WXYZ-9876');
    expect(JSON.stringify(started.value)).not.toContain('device-secret-code');

    const status = await githubWaitDeviceAction(started.value.id);

    // Le jeton a bien été obtenu de GitHub, mais il n'est jamais rendu : le
    // trousseau refuse de l'écrire, et le refus le dit.
    expect(calls.some((url) => url.includes('/login/oauth/access_token'))).toBe(true);
    expect(status.connected).toBe(false);
    expect(status.issues.join(' ')).toContain('PF_GITHUB_TOKEN');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });

  it('refuse une attente inconnue sans toucher au réseau du token', async () => {
    const before = calls.length;
    const status = await githubWaitDeviceAction('identifiant-inconnu');

    expect(status.connected).toBe(false);
    expect(status.issues.join(' ')).toContain('Aucune connexion');
    expect(calls.length).toBe(before);
  });
});

describe('githubDisconnectAction', () => {
  it('dit que la variable d’environnement ne se retire pas, sans citer le jeton', async () => {
    const status = await githubDisconnectAction();

    expect(status.connected).toBe(false);
    expect(status.issues.join(' ')).toContain('PF_GITHUB_TOKEN');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});

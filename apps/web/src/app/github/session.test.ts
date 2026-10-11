import type { CommandRunner } from '@project-factory/exec';
import { environmentStore, type Fetch, type TokenStore } from '@project-factory/github';
import { afterEach, describe, expect, it } from 'vitest';
import {
  completeDeviceConnection,
  type DeviceStartResult,
  forgetPendingDevices,
  startDevice,
  waitDevice,
} from './device';
import { listRepositories, repositoryVisibility } from './repositories';
import { githubDisconnect, githubStatus, tokenStoreFor } from './session';

/**
 * Les fonctions qui parlent à GitHub, **contre un faux `fetch`** : aucun test
 * d'ici ne touche le réseau ni un trousseau réel.
 *
 * Ce que ces tests prouvent, en plus du comportement : le jeton traverse le
 * serveur sans jamais ressortir dans ce qui est rendu, et la sonde est le
 * `JSON.stringify` du résultat — ce que la Server Action renvoie au navigateur.
 */

const TOKEN = 'ghp_test_0123456789abcdefghij';

/** Un `CommandRunner` qui ne sert qu'à construire un `keychainStore` inerte. */
const runner: CommandRunner = {
  run: async () => ({ exitCode: 1, output: '' }),
};

interface Fake {
  readonly fetch: Fetch;
  readonly calls: { url: string; init?: RequestInit }[];
}

function fakeFetch(handler: (url: string, init?: RequestInit) => Response): Fake {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher: Fetch = async (url, init) => {
    calls.push(init === undefined ? { url } : { url, init });
    return handler(url, init);
  };
  return { fetch: fetcher, calls };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function user(login = 'octocat', scopes = 'repo'): Response {
  return json({ login }, 200, { 'x-oauth-scopes': scopes });
}

/** Un trousseau en mémoire : ce qui a été rangé, et ce qui est relu. */
function recordingStore(): { readonly store: TokenStore; readonly written: string[] } {
  const written: string[] = [];
  let current: string | undefined;
  return {
    written,
    store: {
      location: 'trousseau de test',
      get: async () => current,
      set: async (token) => {
        written.push(token);
        current = token;
        return undefined;
      },
      delete: async () => {
        current = undefined;
        return undefined;
      },
    },
  };
}

const DEVICE_BODY = {
  device_code: 'device-secret-code',
  user_code: 'ABCD-1234',
  verification_uri: 'https://github.com/login/device',
  expires_in: 900,
  interval: 0,
};

function startFixture(): Promise<DeviceStartResult> {
  return startDevice(fakeFetch(() => json(DEVICE_BODY)).fetch, 'client-id', ['repo']);
}

afterEach(() => {
  forgetPendingDevices();
});

describe('tokenStoreFor — où vit le jeton', () => {
  it('lit PF_GITHUB_TOKEN quand il est défini', () => {
    expect(tokenStoreFor({ PF_GITHUB_TOKEN: TOKEN }, runner, 'linux').location).toBe(
      'variable PF_GITHUB_TOKEN',
    );
  });

  it('retombe sur le trousseau du système, jamais sur un fichier', () => {
    expect(tokenStoreFor({}, runner, 'linux').location).toBe('Secret Service (libsecret)');
    expect(tokenStoreFor({ PF_GITHUB_TOKEN: '' }, runner, 'linux').location).toBe(
      'Secret Service (libsecret)',
    );
  });
});

describe('githubStatus — le compte connecté, jamais le jeton', () => {
  it('rend le compte, les permissions et l’emplacement du jeton', async () => {
    const fake = fakeFetch(() => user('octocat', 'repo, read:user'));
    const status = await githubStatus({
      fetch: fake.fetch,
      store: environmentStore(TOKEN),
      clientId: 'client-id',
    });

    expect(status.connected).toBe(true);
    expect(status.login).toBe('octocat');
    expect(status.scopes).toEqual(['repo', 'read:user']);
    expect(status.store).toBe('variable PF_GITHUB_TOKEN');
    expect(status.deviceFlowAvailable).toBe(true);
    // Le jeton est bien envoyé à GitHub…
    expect(JSON.stringify(fake.calls[0]?.init?.headers)).toContain(TOKEN);
    // …et n'est nulle part dans ce qui est rendu (§24).
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });

  it('dit quoi faire quand GitHub refuse le jeton, sans le citer', async () => {
    const fake = fakeFetch(() => json({ message: 'Bad credentials' }, 401));
    const status = await githubStatus({
      fetch: fake.fetch,
      store: environmentStore(TOKEN),
      clientId: 'client-id',
    });

    expect(status.connected).toBe(false);
    expect(status.issues.join(' ')).toContain('pf login');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });

  it('annonce ce qui manque plutôt qu’une pile quand le device flow n’est pas configuré', async () => {
    const fake = fakeFetch(() => user());
    const status = await githubStatus({
      fetch: fake.fetch,
      store: {
        location: 'aucun',
        get: async () => undefined,
        set: async () => undefined,
        delete: async () => undefined,
      },
      clientId: '',
    });

    expect(status.connected).toBe(false);
    expect(status.deviceFlowAvailable).toBe(false);
    expect(status.issues.join(' ')).toContain('PF_GITHUB_CLIENT_ID');
    expect(fake.calls).toHaveLength(0);
  });
});

describe('githubDisconnect — un jeton d’environnement ne s’efface pas', () => {
  it('affiche le refus du trousseau, sans jamais citer le jeton', async () => {
    const fake = fakeFetch(() => user());
    const status = await githubDisconnect({
      fetch: fake.fetch,
      store: environmentStore(TOKEN),
      clientId: '',
    });

    expect(status.connected).toBe(false);
    expect(status.issues.join(' ')).toContain('PF_GITHUB_TOKEN');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});

describe('le device flow', () => {
  it('refuse de démarrer sans identifiant d’application, sans toucher au réseau', async () => {
    const fake = fakeFetch(() => json({}));
    const started = await startDevice(fake.fetch, '', ['repo']);

    expect(started.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
    if (!started.ok) {
      expect(started.issues.join(' ')).toContain('PF_GITHUB_CLIENT_ID');
    }
  });

  it('rend le code utilisateur, jamais le device_code', async () => {
    const started = await startFixture();

    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.value.userCode).toBe('ABCD-1234');
    expect(started.value.verificationUri).toBe('https://github.com/login/device');
    expect(JSON.stringify(started.value)).not.toContain('device-secret-code');
  });

  it('attend le jeton en respectant le rythme de GitHub', async () => {
    const started = await startFixture();
    if (!started.ok) {
      throw new Error('le départ du device flow a échoué');
    }
    let poll = 0;
    const fake = fakeFetch(() => {
      poll += 1;
      return poll === 1
        ? json({ error: 'authorization_pending' })
        : json({ access_token: TOKEN, scope: 'repo' });
    });

    const waited = await waitDevice(fake.fetch, 'client-id', started.value.id, {
      sleep: async () => undefined,
    });

    expect(waited.ok).toBe(true);
    if (waited.ok) {
      expect(waited.token).toBe(TOKEN);
      expect(waited.scopes).toEqual(['repo']);
    }
    expect(poll).toBe(2);
  });

  it('refuse un identifiant inconnu et un code expiré', async () => {
    const fake = fakeFetch(() => json(DEVICE_BODY));
    const unknown = await waitDevice(fake.fetch, 'client-id', 'inconnu', {});
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.issues.join(' ')).toContain('Aucune connexion');
    }

    const started = await startDevice(fake.fetch, 'client-id', ['repo'], 0);
    if (!started.ok) {
      throw new Error('le départ du device flow a échoué');
    }
    const expired = await waitDevice(fake.fetch, 'client-id', started.value.id, {
      now: () => 10 ** 12,
    });
    expect(expired.ok).toBe(false);
    if (!expired.ok) {
      expect(expired.issues.join(' ')).toContain('expiré');
    }
  });
});

describe('completeDeviceConnection — ranger, puis rendre un état sans jeton', () => {
  it('range le jeton dans le trousseau et n’en laisse rien paraître', async () => {
    const started = await startFixture();
    if (!started.ok) {
      throw new Error('le départ du device flow a échoué');
    }
    const { store, written } = recordingStore();
    const fake = fakeFetch((url) =>
      url.includes('/user')
        ? user('octocat', 'repo')
        : json({ access_token: TOKEN, scope: 'repo' }),
    );

    const status = await completeDeviceConnection(
      { fetch: fake.fetch, store, clientId: 'client-id' },
      started.value.id,
      { sleep: async () => undefined },
    );

    expect(written).toEqual([TOKEN]);
    expect(status.connected).toBe(true);
    expect(status.login).toBe('octocat');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });

  it('abandonne le jeton quand le trousseau le refuse', async () => {
    const started = await startFixture();
    if (!started.ok) {
      throw new Error('le départ du device flow a échoué');
    }
    const fake = fakeFetch((url) =>
      url.includes('/user') ? user() : json({ access_token: TOKEN, scope: 'repo' }),
    );

    const status = await completeDeviceConnection(
      { fetch: fake.fetch, store: environmentStore(TOKEN), clientId: 'client-id' },
      started.value.id,
      { sleep: async () => undefined },
    );

    expect(status.connected).toBe(false);
    expect(status.issues.join(' ')).toContain('PF_GITHUB_TOKEN');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});

describe('les dépôts du compte', () => {
  const BODY = [
    {
      name: 'app',
      full_name: 'octocat/app',
      owner: { login: 'octocat' },
      private: true,
      description: 'une application',
      clone_url: 'https://github.com/octocat/app.git',
      html_url: 'https://github.com/octocat/app',
    },
  ];

  it('ne touche pas au réseau sans jeton', async () => {
    const fake = fakeFetch(() => json(BODY));
    const list = await listRepositories(fake.fetch, undefined);

    expect(list.connected).toBe(false);
    expect(list.repositories).toEqual([]);
    expect(fake.calls).toHaveLength(0);
    expect(list.issues.join(' ')).toContain('Connectez-vous');
  });

  it('rend les dépôts et leur visibilité, sans deviner', async () => {
    const fake = fakeFetch(() => json(BODY));
    const list = await listRepositories(fake.fetch, TOKEN);

    expect(list.ok).toBe(true);
    expect(list.repositories[0]?.fullName).toBe('octocat/app');
    expect(list.repositories[0]?.private).toBe(true);
    expect(await repositoryVisibility(fake.fetch, TOKEN, { owner: 'octocat', name: 'app' })).toBe(
      'private',
    );
    expect(
      await repositoryVisibility(fake.fetch, TOKEN, { owner: 'octocat', name: 'absent' }),
    ).toBe('unknown');
    expect(
      await repositoryVisibility(fake.fetch, undefined, { owner: 'octocat', name: 'app' }),
    ).toBe('unknown');
  });

  it('rend le problème d’un refus GitHub', async () => {
    const fake = fakeFetch(() => json({ message: 'Bad credentials' }, 401));
    const list = await listRepositories(fake.fetch, TOKEN);

    expect(list.ok).toBe(false);
    expect(list.connected).toBe(true);
    expect(list.issues.join(' ')).toContain('pf login');
  });
});

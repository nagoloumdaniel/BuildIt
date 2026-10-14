import { environmentStore, type Fetch, type TokenStore } from '@buildit/github';
import { describe, expect, it } from 'vitest';
import type { SessionDeps } from '../github/session';
import { deleteGithubRepository } from './delete-repo';

/**
 * Supprimer un dépôt GitHub, contre un **faux `fetch`** : aucun appel réseau.
 *
 * Le cas qui compte est le 404 : un dépôt déjà supprimé côté GitHub doit être un
 * **résultat** (`gone`), pas une panne — c'est ce qui permet à l'écran de
 * détacher le projet et de proposer de le reconnecter.
 */

const TOKEN = 'ghp_delete_0123456789abcdefghij';
const URL = 'https://github.com/octocat/mon-app';

interface Call {
  readonly url: string;
  readonly init?: RequestInit;
}

function deps(handler: (url: string, init?: RequestInit) => Response): {
  readonly deps: SessionDeps;
  readonly calls: Call[];
  readonly store: TokenStore;
} {
  const calls: Call[] = [];
  const store: TokenStore = {
    location: 'test',
    get: async () => TOKEN,
    set: async () => undefined,
    delete: async () => undefined,
  };
  return {
    calls,
    store,
    deps: {
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push(init === undefined ? { url } : { url, init });
        return handler(url, init);
      }) as Fetch,
      store,
      clientId: 'test-client',
    },
  };
}

describe('deleteGithubRepository', () => {
  it('supprime le dépôt et rend son nom complet', async () => {
    const harness = deps(() => new Response(null, { status: 204 }));

    const result = await deleteGithubRepository(harness.deps, URL);

    expect(result).toEqual({ ok: true, status: 'deleted', full: 'octocat/mon-app' });
    const call = harness.calls[0];
    expect(call?.url.endsWith('/repos/octocat/mon-app')).toBe(true);
    expect(call?.init?.method).toBe('DELETE');
  });

  it('un dépôt introuvable est un résultat, pas un échec', async () => {
    const harness = deps(
      () => new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 }),
    );

    expect(await deleteGithubRepository(harness.deps, URL)).toEqual({
      ok: true,
      status: 'gone',
      full: 'octocat/mon-app',
    });
  });

  it('refuse une adresse qui n’est pas un dépôt GitHub, sans rien appeler', async () => {
    const harness = deps(() => new Response(null, { status: 204 }));

    const result = await deleteGithubRepository(harness.deps, 'https://gitlab.com/octocat/mon-app');

    expect(result.ok).toBe(false);
    expect(harness.calls).toHaveLength(0);
  });

  it('refuse quand aucun compte n’est connecté, sans rien appeler', async () => {
    const harness = deps(() => new Response(null, { status: 204 }));
    const anonymous: SessionDeps = {
      ...harness.deps,
      store: { ...harness.store, get: async () => undefined },
    };

    const result = await deleteGithubRepository(anonymous, URL);

    expect(result).toEqual({
      ok: false,
      reason: 'notConnected',
      message: 'Connectez-vous à GitHub avant de supprimer un dépôt.',
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('porte le refus de GitHub tel quel quand la suppression échoue', async () => {
    const harness = deps(
      () => new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );

    const result = await deleteGithubRepository(harness.deps, URL);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('failed');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it('accepte l’adresse `owner/dépôt` comme le reste du produit', async () => {
    const harness = deps(() => new Response(null, { status: 204 }));

    expect(await deleteGithubRepository(harness.deps, 'octocat/mon-app')).toEqual({
      ok: true,
      status: 'deleted',
      full: 'octocat/mon-app',
    });
  });
});

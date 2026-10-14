import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { CommandResult, CommandRunner } from '@buildit/exec';
import { environmentStore, type Fetch, ROLES, type TokenStore } from '@buildit/github';
import { afterEach, describe, expect, it } from 'vitest';
import { repositoryRolesAction, repositoryStatusAction } from '../actions-node';
import {
  createRepository,
  inviteCollaborator,
  listAccess,
  ROLE_VIEWS,
  removeCollaborator,
  repositoryStatus,
  requireGitHubRepository,
} from './sharing';

/**
 * Dépôt et partage, contre un **faux runner Git** et un **faux `fetch`** :
 * aucun dépôt réel, aucun appel réseau. La seule chose vraie est le dossier
 * temporaire, parce que `packages/git` le lit.
 */

const TOKEN = 'ghp_share_0123456789abcdefghij';

interface Call {
  readonly url: string;
  readonly init?: RequestInit;
}

function ghFetch(handler: (url: string, init?: RequestInit) => Response): {
  readonly fetch: Fetch;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push(init === undefined ? { url } : { url, init });
      return handler(url, init);
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeGit(handler: (args: readonly string[]) => CommandResult): {
  readonly runner: CommandRunner;
  readonly calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    runner: {
      async run(_command, args) {
        calls.push(args.join(' '));
        return handler(args);
      },
    },
  };
}

const OK: CommandResult = { exitCode: 0, output: '' };
const FAIL: CommandResult = { exitCode: 128, output: 'fatal: not a git repository' };

/** Un dépôt Git local dont l'origine est `origin`. */
function repoRunner(directory: string, origin?: string): ReturnType<typeof fakeGit> {
  return fakeGit((args) => {
    const key = args.join(' ');
    if (key === 'rev-parse --show-toplevel') {
      return { exitCode: 0, output: directory };
    }
    if (key.startsWith('rev-parse --verify')) {
      return { exitCode: 0, output: 'abc1234' };
    }
    if (key === 'remote get-url origin') {
      return origin === undefined ? FAIL : { exitCode: 0, output: origin };
    }
    return FAIL;
  });
}

function deps(
  fetcher: Fetch,
  store: TokenStore,
): {
  fetch: Fetch;
  store: TokenStore;
  clientId: string;
} {
  return { fetch: fetcher, store, clientId: 'client-id' };
}

const created: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pf-web-repo-'));
  created.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('repositoryStatus l’état du dépôt, sans rien modifier', () => {
  it('refuse un dossier qui n’existe pas', async () => {
    const dir = await tempDir();
    const status = await repositoryStatus(join(dir, 'absent'), fakeGit(() => FAIL).runner);

    expect(status.ok).toBe(false);
    expect(status.issues.join(' ')).toContain('n’existe pas');
  });

  it('distingue « pas un dépôt » de « dépôt sans origine GitHub »', async () => {
    const dir = await tempDir();
    const status = await repositoryStatus(dir, fakeGit(() => FAIL).runner);

    expect(status.ok).toBe(true);
    expect(status.isRepository).toBe(false);
    expect(status.github).toBe(false);
    expect(status.proposedName).toBe(basename(dir));
    expect(status.issues).toEqual([]);
  });

  it('rend le lien GitHub et l’origine locale', async () => {
    const dir = await tempDir();
    const status = await repositoryStatus(
      dir,
      repoRunner(dir, 'git@github.com:octocat/mon-app.git').runner,
    );

    expect(status.github).toBe(true);
    expect(status.owner).toBe('octocat');
    expect(status.name).toBe('mon-app');
    expect(status.url).toBe('https://github.com/octocat/mon-app');
    expect(status.origin).toBe('git@github.com:octocat/mon-app.git');
    // Sans compte connecté, on ne devine pas la visibilité.
    expect(status.visibility).toBe('unknown');
  });

  it('lit la visibilité auprès de GitHub quand un compte est connecté', async () => {
    const dir = await tempDir();
    const fetcher = ghFetch(() =>
      json([
        {
          name: 'mon-app',
          full_name: 'octocat/mon-app',
          owner: { login: 'octocat' },
          private: false,
          description: '',
          clone_url: 'https://github.com/octocat/mon-app.git',
          html_url: 'https://github.com/octocat/mon-app',
        },
      ]),
    ).fetch;

    const status = await repositoryStatus(
      dir,
      repoRunner(dir, 'git@github.com:octocat/mon-app.git').runner,
      deps(fetcher, environmentStore(TOKEN)),
    );

    expect(status.visibility).toBe('public');
    expect(JSON.stringify(status)).not.toContain(TOKEN);
  });
});

describe('un origin qui porte des identifiants n’est jamais renvoyé tel quel (§24)', () => {
  // `.git/config` peut porter un jeton dans l'URL (`https://x-access-token:…@`).
  // Ces valeurs finiraient dans le HTML, dans les journaux du navigateur et
  // dans toute capture d'écran de l'écran 24.
  const AVEC_IDENTIFIANTS = `https://x-access-token:${TOKEN}@github.com/octocat/mon-app.git`;

  it('retire les identifiants de `origin` dans l’état du dépôt', async () => {
    const dir = await tempDir();

    const status = await repositoryStatus(dir, repoRunner(dir, AVEC_IDENTIFIANTS).runner);

    expect(JSON.stringify(status)).not.toContain(TOKEN);
    expect(status.origin).not.toContain(TOKEN);
    expect(status.origin).toContain('github.com');
    // Le dépôt reste reconnu comme GitHub : seul l'affichage est nettoyé.
    expect(status.github).toBe(true);
    expect(status.url).toBe('https://github.com/octocat/mon-app');
  });

  it('ne recopie pas l’identifiant dans la phrase de refus du partage', async () => {
    const dir = await tempDir();

    const result = await requireGitHubRepository(dir, repoRunner(dir, AVEC_IDENTIFIANTS).runner);

    const texte = result.ok ? JSON.stringify(result.value) : result.issues.join(' ');
    expect(texte).not.toContain(TOKEN);
  });
});

describe('requireGitHubRepository la règle du §20bis', () => {
  it('refuse de partager un projet sans dépôt GitHub, et dit comment en obtenir un', async () => {
    const dir = await tempDir();
    const result = await requireGitHubRepository(dir, repoRunner(dir).runner);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toContain('passe par son dépôt');
      expect(result.issues.join(' ')).toContain('Créez-le');
    }
  });

  it('refuse aussi un dépôt distant qui n’est pas GitHub', async () => {
    const dir = await tempDir();
    const result = await requireGitHubRepository(
      dir,
      repoRunner(dir, 'https://gitlab.com/octocat/mon-app.git').runner,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toContain('gitlab.com');
    }
  });

  it('rend le dépôt GitHub quand il existe', async () => {
    const dir = await tempDir();
    const result = await requireGitHubRepository(
      dir,
      repoRunner(dir, 'https://github.com/octocat/mon-app.git').runner,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ owner: 'octocat', name: 'mon-app' });
    }
  });
});

describe('createRepository le premier commit d’abord, GitHub ensuite', () => {
  it('refuse un nom invalide sans rien créer', async () => {
    const dir = await tempDir();
    const fake = fakeGit(() => OK);
    const fetcher = ghFetch(() => json({})).fetch;

    const result = await createRepository({
      directory: dir,
      name: '../evade',
      isPrivate: true,
      runner: fake.runner,
      deps: deps(fetcher, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('pas un nom de dépôt GitHub valide');
    expect(fake.calls).toEqual([]);
  });

  it('refuse un projet qui a déjà une origine', async () => {
    const dir = await tempDir();
    const fetcher = ghFetch(() => json({})).fetch;

    const result = await createRepository({
      directory: dir,
      name: 'mon-app',
      isPrivate: true,
      runner: repoRunner(dir, 'https://github.com/octocat/mon-app.git').runner,
      deps: deps(fetcher, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('déjà un dépôt distant');
  });

  it('refuse de créer sans compte connecté', async () => {
    const dir = await tempDir();
    const api = ghFetch(() => json({}));

    const result = await createRepository({
      directory: dir,
      name: 'mon-app',
      isPrivate: true,
      runner: fakeGit(() => FAIL).runner,
      deps: deps(api.fetch, {
        location: 'aucun',
        get: async () => undefined,
        set: async () => undefined,
        delete: async () => undefined,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('Connectez-vous');
    expect(api.calls).toHaveLength(0);
  });

  it('crée le dépôt privé, puis pousse le code', async () => {
    const dir = await tempDir();
    const runner = fakeGit((args) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel' || key.startsWith('rev-parse --verify')) {
        return FAIL;
      }
      if (key === 'init --initial-branch=main' || key === 'add --all' || key.startsWith('commit')) {
        return OK;
      }
      if (key.startsWith('remote add origin') || key.includes('push')) {
        return OK;
      }
      return FAIL;
    });
    const api = ghFetch((url, init) => {
      if (url.endsWith('/user')) {
        return json({ login: 'octocat' });
      }
      if (url.endsWith('/user/repos') && init?.method === 'POST') {
        return json({
          name: 'mon-app',
          full_name: 'octocat/mon-app',
          owner: { login: 'octocat' },
          private: true,
          description: '',
          clone_url: 'https://github.com/octocat/mon-app.git',
          html_url: 'https://github.com/octocat/mon-app',
        });
      }
      return json({ message: 'inattendu' }, 500);
    });

    const result = await createRepository({
      directory: dir,
      name: 'mon-app',
      isPrivate: true,
      description: 'une application',
      runner: runner.runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://github.com/octocat/mon-app');
    const posted = api.calls.find(
      (call) => call.url.endsWith('/user/repos') && call.init?.method === 'POST',
    );
    expect(String(posted?.init?.body)).toContain('"private":true');
    // Le jeton n'est jamais dans les arguments passés à Git.
    expect(runner.calls.join(' ')).not.toContain(TOKEN);
  });

  it('dit que le dépôt existe mais que l’envoi a échoué', async () => {
    const dir = await tempDir();
    const runner = fakeGit((args) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel' || key.startsWith('rev-parse --verify')) {
        return FAIL;
      }
      if (key === 'init --initial-branch=main' || key === 'add --all' || key.startsWith('commit')) {
        return OK;
      }
      if (key.startsWith('remote add origin')) {
        return OK;
      }
      return FAIL;
    });
    const api = ghFetch((url) => {
      if (url.endsWith('/user')) {
        return json({ login: 'octocat' });
      }
      return json({
        name: 'mon-app',
        full_name: 'octocat/mon-app',
        owner: { login: 'octocat' },
        private: true,
        description: '',
        clone_url: 'https://github.com/octocat/mon-app.git',
        html_url: 'https://github.com/octocat/mon-app',
      });
    });

    const result = await createRepository({
      directory: dir,
      name: 'mon-app',
      isPrivate: true,
      runner: runner.runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(false);
    expect(result.url).toBe('https://github.com/octocat/mon-app');
    expect(result.issues.join(' ')).toContain('envoi du code a échoué');
  });

  it('remonte le refus d’un nom déjà pris, sans rien créer à moitié', async () => {
    const dir = await tempDir();
    const runner = fakeGit((args) => {
      const key = args.join(' ');
      if (key === 'rev-parse --show-toplevel' || key.startsWith('rev-parse --verify')) {
        return FAIL;
      }
      if (key === 'init --initial-branch=main' || key === 'add --all' || key.startsWith('commit')) {
        return OK;
      }
      return FAIL;
    });
    const api = ghFetch((url) => {
      if (url.endsWith('/user')) {
        return json({ login: 'octocat' });
      }
      return json(
        {
          message: 'Repository creation failed.',
          errors: [{ message: 'name already exists on this account' }],
        },
        422,
      );
    });

    const result = await createRepository({
      directory: dir,
      name: 'mon-app',
      isPrivate: true,
      runner: runner.runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('existe déjà');
  });
});

describe('les accès collaborateurs et invitations', () => {
  function accessApi(): ReturnType<typeof ghFetch> {
    return ghFetch((url, init) => {
      if (url.includes('/invitations') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (url.includes('/invitations')) {
        return json([{ id: 1, invitee: { login: 'bob' }, permissions: 'write' }]);
      }
      if (url.includes('/collaborators/') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      if (url.includes('/collaborators/')) {
        return new Response(null, { status: 201 });
      }
      if (url.includes('/collaborators')) {
        return json([{ login: 'octocat', role_name: 'admin' }]);
      }
      return json({ message: 'inattendu' }, 500);
    });
  }

  async function project(): Promise<{ dir: string; runner: CommandRunner }> {
    const dir = await tempDir();
    return { dir, runner: repoRunner(dir, 'https://github.com/octocat/mon-app.git').runner };
  }

  it('liste les collaborateurs et les invitations en attente', async () => {
    const { dir, runner } = await project();
    const api = accessApi();

    const access = await listAccess(deps(api.fetch, environmentStore(TOKEN)), dir, runner);

    expect(access.ok).toBe(true);
    expect(access.url).toBe('https://github.com/octocat/mon-app');
    expect(access.collaborators).toEqual([{ login: 'octocat', role: 'admin' }]);
    expect(access.invitations).toEqual([{ login: 'bob', role: 'write' }]);
  });

  it('refuse un nom d’utilisateur invalide sans appeler GitHub', async () => {
    const { dir, runner } = await project();
    const api = accessApi();

    const result = await inviteCollaborator({
      directory: dir,
      username: 'pas un nom !',
      role: 'write',
      runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('nom d’utilisateur GitHub');
    expect(api.calls).toHaveLength(0);
  });

  it('refuse un rôle inconnu', async () => {
    const { dir, runner } = await project();
    const api = accessApi();

    const result = await inviteCollaborator({
      directory: dir,
      username: 'bob',
      role: 'root',
      runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('Rôle inconnu');
    expect(api.calls).toHaveLength(0);
  });

  it('invite avec un rôle et rafraîchit la liste', async () => {
    const { dir, runner } = await project();
    const api = accessApi();

    const result = await inviteCollaborator({
      directory: dir,
      username: 'bob',
      role: 'write',
      runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(true);
    expect(result.outcome).toContain('bob est invité');
    expect(result.access?.collaborators).toEqual([{ login: 'octocat', role: 'admin' }]);
    const put = api.calls.find((call) => call.init?.method === 'PUT');
    expect(String(put?.init?.body)).toContain('"permission":"push"');
  });

  it('retire un accès et rafraîchit la liste', async () => {
    const { dir, runner } = await project();
    const api = accessApi();

    const result = await removeCollaborator({
      directory: dir,
      username: 'bob',
      runner,
      deps: deps(api.fetch, environmentStore(TOKEN)),
    });

    expect(result.ok).toBe(true);
    expect(result.outcome).toContain('Invitation de bob annulée');
    expect(api.calls.some((call) => call.init?.method === 'DELETE')).toBe(true);
  });

  it('refuse de lister les accès sans dépôt GitHub', async () => {
    const dir = await tempDir();
    const api = accessApi();

    const access = await listAccess(
      deps(api.fetch, environmentStore(TOKEN)),
      dir,
      repoRunner(dir).runner,
    );

    expect(access.ok).toBe(false);
    expect(access.issues.join(' ')).toContain('passe par son dépôt');
    expect(api.calls).toHaveLength(0);
  });
});

describe('les rôles du §20bis', () => {
  it('couvre exactement les rôles du paquet', () => {
    expect(ROLE_VIEWS.map((role) => role.role)).toEqual([...ROLES]);
    for (const role of ROLE_VIEWS) {
      expect(role.label).not.toBe('');
      expect(role.note).not.toBe('');
    }
  });

  it('est rendu par la Server Action', async () => {
    const roles = await repositoryRolesAction();
    expect(roles.map((role) => role.role)).toEqual([...ROLES]);
  });
});

describe('les Server Actions de l’écran 24 validation avant tout accès', () => {
  it('refuse un chemin relatif', async () => {
    const status = await repositoryStatusAction('mon-projet');
    expect(status.ok).toBe(false);
    expect(status.issues.join(' ')).toContain('chemin absolu');
  });
});

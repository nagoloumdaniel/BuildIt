import { fail, ok, type ParseResult } from '@project-factory/validation';
import { type GitHubCode, githubIssue } from './errors.js';

/**
 * Client de l'API GitHub, réduit à ce que le §20bis utilise.
 *
 * `fetch` est injecté : les tests rejouent les réponses documentées de l'API,
 * y compris les refus, sans réseau ni compte. Les appels partent directement
 * de la machine vers api.github.com (§0, local-first).
 */

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type Result<T> = ParseResult<T, GitHubCode>;

export interface Repository {
  readonly owner: string;
  readonly name: string;
}

export interface RepositorySummary extends Repository {
  readonly fullName: string;
  readonly private: boolean;
  readonly description: string;
  readonly cloneUrl: string;
  readonly htmlUrl: string;
}

export interface Viewer {
  readonly login: string;
  /** Permissions du jeton (`X-OAuth-Scopes`) ; vide pour un jeton à grain fin. */
  readonly scopes: readonly string[];
}

/** Rôles du §20bis, et leur nom dans l'API. */
export const ROLES = ['read', 'triage', 'write', 'maintain', 'admin'] as const;
export type Role = (typeof ROLES)[number];
const API_PERMISSION: Readonly<Record<Role, string>> = {
  read: 'pull',
  triage: 'triage',
  write: 'push',
  maintain: 'maintain',
  admin: 'admin',
};

export interface Collaborator {
  readonly login: string;
  readonly role: string;
}

export interface Invitation extends Collaborator {
  readonly id: number;
}

export interface GitHubClientOptions {
  readonly token: string;
  readonly fetch?: Fetch;
  readonly baseUrl?: string;
}

type Json = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function summary(item: Json): RepositorySummary {
  const owner = (item['owner'] ?? {}) as Json;
  return {
    owner: str(owner['login']),
    name: str(item['name']),
    fullName: str(item['full_name']),
    private: item['private'] === true,
    description: str(item['description']),
    cloneUrl: str(item['clone_url']),
    htmlUrl: str(item['html_url']),
  };
}

export class GitHubClient {
  readonly #token: string;
  readonly #fetch: Fetch;
  readonly #baseUrl: string;

  constructor(options: GitHubClientOptions) {
    this.#token = options.token;
    this.#fetch = options.fetch ?? fetch;
    this.#baseUrl = options.baseUrl ?? 'https://api.github.com';
  }

  /** Une requête ; tout statut hors 2xx devient un problème nommé. */
  async #request(
    method: string,
    path: string,
    body?: Json,
    context = path,
  ): Promise<Result<{ status: number; json: unknown; headers: Headers }>> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.#token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'project-factory',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      return fail([
        githubIssue(
          'GITHUB_NETWORK',
          error instanceof Error ? error.message : String(error),
          'Vérifiez la connexion, puis relancez.',
        ),
      ]);
    }
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text === '' ? null : JSON.parse(text);
    } catch {
      json = null;
    }
    if (response.ok) {
      return ok({ status: response.status, json, headers: response.headers });
    }
    // La raison précise est souvent dans `errors[].message` (« name already
    // exists on this account »), le message principal restant générique.
    const errors = (json as Json | null)?.['errors'];
    const reasons = [
      str((json as Json | null)?.['message']),
      ...(Array.isArray(errors) ? errors.map((item) => str((item as Json)?.['message'])) : []),
    ].filter((reason) => reason !== '');
    const detail = reasons.length === 0 ? `HTTP ${response.status}` : reasons.join(' — ');
    switch (response.status) {
      case 401:
        return fail([githubIssue('GITHUB_UNAUTHORIZED', '', 'Reconnectez-vous : pf login.')]);
      case 403:
      case 429:
        if (response.headers.get('x-ratelimit-remaining') === '0' || response.status === 429) {
          const reset = Number(response.headers.get('x-ratelimit-reset'));
          const when =
            Number.isFinite(reset) && reset > 0
              ? new Date(reset * 1000).toISOString()
              : 'plus tard';
          return fail([githubIssue('GITHUB_RATE_LIMITED', '', `Réessayez après ${when}.`)]);
        }
        return fail([githubIssue('GITHUB_FORBIDDEN', detail)]);
      case 404:
        return fail([
          githubIssue(
            'GITHUB_NOT_FOUND',
            context,
            'Vérifiez le nom ; un dépôt privé inaccessible au compte connecté apparaît aussi comme introuvable.',
          ),
        ]);
      case 422:
        return fail([githubIssue('GITHUB_INVALID', detail)]);
      default:
        return fail([githubIssue('GITHUB_UNEXPECTED', `HTTP ${response.status}`)]);
    }
  }

  /** Le compte connecté et les permissions accordées au jeton. */
  async viewer(): Promise<Result<Viewer>> {
    const result = await this.#request('GET', '/user');
    if (!result.ok) {
      return result;
    }
    const scopes = (result.value.headers.get('x-oauth-scopes') ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope !== '');
    return ok({ login: str((result.value.json as Json)['login']), scopes });
  }

  /** Les 100 dépôts les plus récemment modifiés auxquels le compte a accès. */
  async listRepositories(): Promise<Result<RepositorySummary[]>> {
    const result = await this.#request(
      'GET',
      '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member',
    );
    if (!result.ok) {
      return result;
    }
    return ok(Array.isArray(result.value.json) ? (result.value.json as Json[]).map(summary) : []);
  }

  /** Crée un dépôt sur le compte connecté. Nom pris : refus, rien n'est créé. */
  async createRepository(options: {
    readonly name: string;
    readonly private: boolean;
    readonly description?: string;
  }): Promise<Result<RepositorySummary>> {
    const result = await this.#request('POST', '/user/repos', {
      name: options.name,
      private: options.private,
      ...(options.description === undefined ? {} : { description: options.description }),
    });
    if (!result.ok) {
      const exists = result.issues.some(
        (item) => item.code === 'GITHUB_INVALID' && /already exists/i.test(item.message),
      );
      return exists
        ? fail([
            githubIssue(
              'GITHUB_REPO_EXISTS',
              options.name,
              'Choisissez un autre nom : --name <nom>.',
            ),
          ])
        : result;
    }
    return ok(summary(result.value.json as Json));
  }

  /** Invite un collaborateur. `already` : il avait déjà accès. */
  async addCollaborator(
    repository: Repository,
    username: string,
    role: Role,
  ): Promise<Result<'invited' | 'already'>> {
    const result = await this.#request(
      'PUT',
      `/repos/${repository.owner}/${repository.name}/collaborators/${encodeURIComponent(username)}`,
      { permission: API_PERMISSION[role] },
      `${repository.owner}/${repository.name} ou l’utilisateur ${username}`,
    );
    if (!result.ok) {
      return fail(result.issues.map((item) => adminHint(item)));
    }
    return ok(result.value.status === 201 ? 'invited' : 'already');
  }

  async listCollaborators(repository: Repository): Promise<Result<Collaborator[]>> {
    const result = await this.#request(
      'GET',
      `/repos/${repository.owner}/${repository.name}/collaborators?per_page=100`,
    );
    if (!result.ok) {
      return fail(result.issues.map((item) => adminHint(item)));
    }
    const items = Array.isArray(result.value.json) ? (result.value.json as Json[]) : [];
    return ok(items.map((item) => ({ login: str(item['login']), role: str(item['role_name']) })));
  }

  async listInvitations(repository: Repository): Promise<Result<Invitation[]>> {
    const result = await this.#request(
      'GET',
      `/repos/${repository.owner}/${repository.name}/invitations?per_page=100`,
    );
    if (!result.ok) {
      return fail(result.issues.map((item) => adminHint(item)));
    }
    const items = Array.isArray(result.value.json) ? (result.value.json as Json[]) : [];
    return ok(
      items.map((item) => ({
        id: Number(item['id']),
        login: str(((item['invitee'] ?? {}) as Json)['login']),
        role: str(item['permissions']),
      })),
    );
  }

  /** Retire un accès : l'invitation en attente si elle existe, sinon le collaborateur. */
  async removeCollaborator(
    repository: Repository,
    username: string,
  ): Promise<Result<'invitation' | 'collaborator'>> {
    const invitations = await this.listInvitations(repository);
    if (!invitations.ok) {
      return invitations;
    }
    const pending = invitations.value.find(
      (item) => item.login.toLowerCase() === username.toLowerCase(),
    );
    const base = `/repos/${repository.owner}/${repository.name}`;
    if (pending !== undefined) {
      const removed = await this.#request('DELETE', `${base}/invitations/${pending.id}`);
      return removed.ok ? ok('invitation') : removed;
    }
    const collaborators = await this.listCollaborators(repository);
    if (!collaborators.ok) {
      return collaborators;
    }
    if (!collaborators.value.some((item) => item.login.toLowerCase() === username.toLowerCase())) {
      return fail([
        githubIssue('GITHUB_NOT_COLLABORATOR', username, 'pf collab list montre qui a accès.'),
      ]);
    }
    const removed = await this.#request(
      'DELETE',
      `${base}/collaborators/${encodeURIComponent(username)}`,
    );
    return removed.ok ? ok('collaborator') : removed;
  }
}

/** Sur un dépôt, un 403 veut presque toujours dire « pas administrateur ». */
function adminHint<T extends { code: GitHubCode; hint?: string }>(item: T): T {
  return item.code === 'GITHUB_FORBIDDEN'
    ? {
        ...item,
        hint: 'Le compte connecté n’est pas administrateur de ce dépôt : seul un administrateur gère les accès.',
      }
    : item;
}

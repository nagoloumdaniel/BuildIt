import { type Fetch, GitHubClient, type RepositorySummary } from '@buildit/github';
import { describeIssues, type SessionDeps } from './session';

/**
 * Les dépôts du compte connecté (§6.22, onglet « Mes dépôts » ; §20bis).
 *
 * Le client de `packages/github` fait tout le travail ; ce module ne fait que
 * réduire sa réponse à ce qui s'affiche et à ce qui se clone.
 */

export interface RepositoryView {
  readonly fullName: string;
  readonly owner: string;
  readonly name: string;
  readonly private: boolean;
  readonly description: string;
  readonly cloneUrl: string;
  readonly htmlUrl: string;
}

export function toRepositoryView(repository: RepositorySummary): RepositoryView {
  return {
    fullName: repository.fullName,
    owner: repository.owner,
    name: repository.name,
    private: repository.private,
    description: repository.description,
    cloneUrl: repository.cloneUrl,
    htmlUrl: repository.htmlUrl,
  };
}

export interface RepositoryListView {
  readonly ok: boolean;
  readonly connected: boolean;
  readonly repositories: readonly RepositoryView[];
  readonly issues: readonly string[];
}

const NOT_CONNECTED = ['Connectez-vous à GitHub pour lister vos dépôts, puis revenez ici.'];

/** La liste, ou la raison de ne pas l'avoir. Jamais d'appel réseau sans jeton. */
export async function listRepositories(
  fetcher: Fetch,
  token: string | undefined,
): Promise<RepositoryListView> {
  if (token === undefined || token === '') {
    return { ok: false, connected: false, repositories: [], issues: NOT_CONNECTED };
  }
  const result = await new GitHubClient({ token, fetch: fetcher }).listRepositories();
  if (!result.ok) {
    return { ok: false, connected: true, repositories: [], issues: describeIssues(result.issues) };
  }
  return {
    ok: true,
    connected: true,
    repositories: result.value.map(toRepositoryView),
    issues: [],
  };
}

/** La liste pour le compte courant, jeton lu dans le trousseau. */
export async function repositoriesFor(deps: SessionDeps): Promise<RepositoryListView> {
  return listRepositories(deps.fetch, await deps.store.get());
}

export type Visibility = 'private' | 'public' | 'unknown';

/**
 * La visibilité d'un dépôt, quand elle est connue.
 *
 * `packages/github` n'expose pas de lecture d'un dépôt par son nom : on passe
 * par la liste des dépôts accessibles au compte (les 100 plus récemment
 * modifiés, comme le fait `listRepositories`). Un dépôt absent de cette liste
 * rend `unknown` on ne devine pas une visibilité.
 */
export async function repositoryVisibility(
  fetcher: Fetch,
  token: string | undefined,
  repository: { readonly owner: string; readonly name: string },
): Promise<Visibility> {
  if (token === undefined || token === '') {
    return 'unknown';
  }
  const listed = await new GitHubClient({ token, fetch: fetcher }).listRepositories();
  if (!listed.ok) {
    return 'unknown';
  }
  const owner = repository.owner.toLowerCase();
  const name = repository.name.toLowerCase();
  const found = listed.value.find(
    (item) => item.owner.toLowerCase() === owner && item.name.toLowerCase() === name,
  );
  if (found === undefined) {
    return 'unknown';
  }
  return found.private ? 'private' : 'public';
}

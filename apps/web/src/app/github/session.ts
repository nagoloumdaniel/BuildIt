import type { CommandRunner } from '@project-factory/exec';
import {
  environmentStore,
  type Fetch,
  GitHubClient,
  keychainStore,
  type TokenStore,
} from '@project-factory/github';

/**
 * La session GitHub côté serveur (§20bis, §24).
 *
 * Trois règles, tenues ici une fois pour tous les écrans :
 *
 * - le jeton ne sort **jamais** de ce module autrement que rangé dans le
 *   trousseau : aucune vue, aucun retour de Server Action, aucun journal ;
 * - le jeton vient de `PF_GITHUB_TOKEN` (CI) s'il est défini, sinon du
 *   trousseau du système — même ordre que le CLI (`apps/cli/src/github-session.ts`) ;
 * - un `fetch` est **injecté** : les tests rejouent les réponses de l'API sans
 *   réseau, et le vrai client n'est monté qu'en production.
 */

/** La forme minimale d'un problème du moteur : de quoi le rendre en une phrase. */
export interface IssueLike {
  readonly message: string;
  readonly hint?: string;
}

/**
 * Un problème rendu affichable : le message, puis l'indice s'il y en a un.
 *
 * L'indice n'est jamais perdu : c'est lui qui dit quoi faire (« reconnectez-vous »)
 * et l'écran ne doit pas se contenter du constat.
 */
export function describeIssues(issues: readonly IssueLike[]): string[] {
  return issues.map((issue) =>
    issue.hint === undefined ? issue.message : `${issue.message} ${issue.hint}`,
  );
}

/** Où lire le jeton : l'environnement d'abord, le trousseau du système ensuite. */
export function tokenStoreFor(
  env: Readonly<Record<string, string | undefined>>,
  runner: CommandRunner,
  platform: NodeJS.Platform = process.platform,
): TokenStore {
  const fromEnv = env['PF_GITHUB_TOKEN'];
  return fromEnv === undefined || fromEnv === ''
    ? keychainStore(runner, platform)
    : environmentStore(fromEnv);
}

/**
 * Ce qu'il faut pour parler à GitHub : le client injecté en test, le trousseau
 * et l'identifiant de l'application OAuth.
 */
export interface SessionDeps {
  readonly fetch: Fetch;
  readonly store: TokenStore;
  readonly clientId: string;
}

export interface Account {
  readonly login: string;
  /** Permissions du jeton annoncées par GitHub ; vide pour un jeton à grain fin. */
  readonly scopes: readonly string[];
}

export type AccountResult =
  | { readonly ok: true; readonly value: Account }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Le compte connecté et les permissions réellement accordées au jeton. */
export async function readAccount(fetcher: Fetch, token: string): Promise<AccountResult> {
  const viewer = await new GitHubClient({ token, fetch: fetcher }).viewer();
  if (!viewer.ok) {
    return { ok: false, issues: describeIssues(viewer.issues) };
  }
  return { ok: true, value: { login: viewer.value.login, scopes: viewer.value.scopes } };
}

/**
 * Ce que la connexion demande, en clair, avant toute connexion (§20bis).
 *
 * Recopié du CLI à dessein : c'est le même produit, la même phrase, et
 * `scope` reste l'identifiant que GitHub attend.
 */
export const DEVICE_FLOW_UNAVAILABLE: readonly string[] = [
  'La connexion par code n’est pas configurée : l’application OAuth de Project Factory n’est pas enregistrée sur cette machine.',
  'Définissez PF_GITHUB_CLIENT_ID avec l’identifiant de l’application, puis relancez le serveur.',
];

/**
 * L'état de la connexion, **sans le jeton**.
 *
 * `store` dit seulement *où* le jeton est rangé — de quoi rassurer sans rien
 * divulguer. `issues` porte ce qui empêche de se connecter (device flow non
 * configuré, jeton révoqué), jamais une valeur secrète.
 */
export interface GithubStatusView {
  readonly connected: boolean;
  readonly login?: string;
  readonly scopes: readonly string[];
  readonly store: string;
  readonly deviceFlowAvailable: boolean;
  readonly issues: readonly string[];
}

/** L'état « pas connecté », avec ce qui l'explique. */
export function disconnectedStatus(
  deps: SessionDeps,
  issues: readonly string[] = [],
): GithubStatusView {
  return {
    connected: false,
    scopes: [],
    store: deps.store.location,
    deviceFlowAvailable: deps.clientId !== '',
    issues,
  };
}

/** L'état courant : connecté (compte + permissions) ou la raison de ne pas l'être. */
export async function githubStatus(deps: SessionDeps): Promise<GithubStatusView> {
  const token = await deps.store.get();
  if (token === undefined) {
    return disconnectedStatus(deps, deps.clientId === '' ? DEVICE_FLOW_UNAVAILABLE : []);
  }
  const account = await readAccount(deps.fetch, token);
  if (!account.ok) {
    return disconnectedStatus(deps, account.issues);
  }
  return {
    connected: true,
    login: account.value.login,
    scopes: account.value.scopes,
    store: deps.store.location,
    deviceFlowAvailable: deps.clientId !== '',
    issues: [],
  };
}

/**
 * Déconnexion : on retire le jeton du trousseau. Un jeton venu de
 * l'environnement n'est **pas** effacé par Project Factory — le trousseau le
 * refuse, et ce refus est affiché tel quel.
 */
export async function githubDisconnect(deps: SessionDeps): Promise<GithubStatusView> {
  const refusal = await deps.store.delete();
  if (refusal !== undefined) {
    return disconnectedStatus(deps, describeIssues([refusal]));
  }
  return githubStatus(deps);
}

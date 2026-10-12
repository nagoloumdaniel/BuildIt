/**
 * GitHub pour BuildIt (§20bis) : connexion par code, dépôts,
 * collaborateurs, et le jeton dans le trousseau du système. Aucun compte
 * BuildIt : tout est délégué à GitHub.
 */

export type {
  Collaborator,
  Fetch,
  GitHubClientOptions,
  Invitation,
  Repository,
  RepositorySummary,
  Result,
  Role,
  Viewer,
} from './client.js';
export { GitHubClient, ROLES } from './client.js';
export type { AccessToken, DeviceCode, PollOptions } from './device-flow.js';
export { pollAccessToken, requestDeviceCode, SCOPES } from './device-flow.js';
export type { GitHubCode, GitHubIssue } from './errors.js';
export { GITHUB_CODES, githubIssue } from './errors.js';
export { exchangeAuthorizationCode } from './oauth-code.js';
export type { TokenStore } from './token-store.js';
export { environmentStore, isTokenShaped, keychainStore, TOKEN_PATTERN } from './token-store.js';

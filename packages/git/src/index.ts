/**
 * Git pour Project Factory (§18bis, §20bis) : valider un lien, cloner sans
 * rien laisser derrière soi, créer le premier commit, pousser vers un dépôt
 * neuf. Toujours par le `CommandRunner` — jamais de shell —, jamais de jeton
 * dans une URL ni dans un argument.
 */

export type { CloneOptions, GitCode, GitFailure, GitIssue, RepositoryState } from './operations.js';
export {
  cloneRepository,
  ensureInitialCommit,
  GIT_CODES,
  isGitFailure,
  pushToNewOrigin,
  repositoryState,
} from './operations.js';
export type { GitHubRepository, GitRemote, RemoteCode, RemoteIssue } from './remote.js';
export { githubUrl, parseRemote, REMOTE_CODES } from './remote.js';

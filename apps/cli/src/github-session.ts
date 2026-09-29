import { isGitFailure, repositoryState } from '@project-factory/git';
import {
  environmentStore,
  GitHubClient,
  keychainStore,
  type Repository,
  type TokenStore,
} from '@project-factory/github';
import { printIssues } from './format.js';
import type { Io } from './io.js';

/** Où vit le jeton : `PF_GITHUB_TOKEN` (CI) s'il est défini, sinon le trousseau. */
export function tokenStore(io: Io): TokenStore {
  const fromEnv = io.env['PF_GITHUB_TOKEN'];
  return fromEnv !== undefined && fromEnv !== ''
    ? environmentStore(fromEnv)
    : keychainStore(io.runner, io.platform);
}

export interface Session {
  readonly client: GitHubClient;
  readonly token: string;
}

/** Le client du compte connecté ; sinon, dit comment se connecter. */
export async function requireSession(io: Io): Promise<Session | undefined> {
  const token = await tokenStore(io).get();
  if (token === undefined) {
    io.err('✗ Vous n’êtes pas connecté à GitHub.');
    io.err('  → pf login');
    return undefined;
  }
  return { client: new GitHubClient({ token, fetch: io.fetch }), token };
}

/**
 * Le dépôt GitHub d'un projet, lu dans son `origin`. Règle du §20bis : sans
 * dépôt GitHub, pas de partage du projet — on dit pourquoi et quoi faire.
 */
export async function requireGitHubProject(io: Io, dir: string): Promise<Repository | undefined> {
  const state = await repositoryState(dir, io.runner);
  if (isGitFailure(state)) {
    printIssues(io, state.issues);
    return undefined;
  }
  if (state.github === undefined) {
    io.err(
      state.origin === undefined
        ? '✗ Ce projet n’utilise pas de dépôt GitHub : partager un projet passe par son dépôt.'
        : `✗ Le dépôt de ce projet n’est pas sur GitHub (${state.origin}) : le partage passe par GitHub.`,
    );
    io.err(
      '  → Créez-le : pf repo create. En attendant, seul le lien de configuration en lecture seule sera possible (Phase 9).',
    );
    return undefined;
  }
  return { owner: state.github.owner, name: state.github.repo };
}

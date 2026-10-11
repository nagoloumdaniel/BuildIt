'use server';

import { nodeCommandRunner } from '@project-factory/exec';
import {
  type ClonePreviewView,
  type CloneResultView,
  cloneProject,
  planClone,
} from './clone/clone';
import { webWorkspaceRoot } from './clone/destination';
import {
  completeDeviceConnection,
  type DeviceStartResult,
  PERMISSIONS,
  type PermissionView,
  REQUESTED_SCOPES,
  startDevice,
} from './github/device';
import { type RepositoryListView, repositoriesFor } from './github/repositories';
import {
  type GithubStatusView,
  githubDisconnect,
  githubStatus,
  type SessionDeps,
  tokenStoreFor,
} from './github/session';
import {
  type InstallResultView,
  inspectProject,
  installProject,
  type ProjectInspectionView,
  resolveLocalDirectory,
} from './open/project';
import {
  type AccessMutationView,
  type AccessView,
  type CreateRepositoryResult,
  createRepository,
  inviteCollaborator,
  listAccess,
  type RepositoryStatusView,
  ROLE_VIEWS,
  type RoleView,
  refusedRepositoryStatus,
  removeCollaborator,
  repositoryStatus,
} from './repo/sharing';

/**
 * Les Server Actions de git, workspace et GitHub (§6.21 à §6.24, §18bis, §20bis).
 *
 * Même motif que `actions.ts` : le navigateur ne parle jamais directement à un
 * paquet du moteur, et **rien de ce qui vient du client n'est cru sur parole**.
 * Ce fichier est volontairement mince — il ne fait que fournir les dépendances
 * réelles (le `fetch` global, le `CommandRunner`, le trousseau) aux modules de
 * son dossier, qui portent la validation et sont testés contre des faux.
 *
 * Deux règles du §24 s'y jouent :
 * - le jeton GitHub n'est **jamais** une valeur de retour : `GithubStatusView`
 *   ne porte qu'un identifiant de compte, des permissions et l'emplacement du
 *   trousseau ;
 * - un chemin local venu du client passe par `resolveLocalDirectory` avant tout
 *   accès disque, et un dossier de destination reste **relatif** à la racine de
 *   travail (`clone/destination.ts`).
 */

/** Ce que le navigateur a le droit d'envoyer : un objet, éventuellement hostile. */
function inputRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

/** Les dépendances réelles : `fetch`, trousseau et identifiant d'application OAuth. */
function sessionDeps(): SessionDeps {
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    store: tokenStoreFor(process.env, nodeCommandRunner),
    clientId: process.env['PF_GITHUB_CLIENT_ID'] ?? '',
  };
}

// --- Écran 21 — GitHub Connection -----------------------------------------

export async function githubStatusAction(): Promise<GithubStatusView> {
  return githubStatus(sessionDeps());
}

export async function githubPermissionsAction(): Promise<readonly PermissionView[]> {
  return PERMISSIONS;
}

export async function githubStartDeviceAction(): Promise<DeviceStartResult> {
  const deps = sessionDeps();
  return startDevice(deps.fetch, deps.clientId, REQUESTED_SCOPES);
}

export async function githubWaitDeviceAction(id: unknown): Promise<GithubStatusView> {
  return completeDeviceConnection(sessionDeps(), id);
}

export async function githubDisconnectAction(): Promise<GithubStatusView> {
  return githubDisconnect(sessionDeps());
}

export async function githubRepositoriesAction(): Promise<RepositoryListView> {
  return repositoriesFor(sessionDeps());
}

// --- Écran 22 — Clone Project ---------------------------------------------

export async function clonePreviewAction(
  link: unknown,
  folder: unknown,
): Promise<ClonePreviewView> {
  return (await planClone(link, folder, webWorkspaceRoot())).view;
}

/**
 * Clone, puis installe si on l'a demandé.
 *
 * Le plan est calculé avant de toucher au trousseau : une entrée invalide ne
 * déclenche ni appel système ni accès à Git.
 */
export async function cloneProjectAction(input: unknown): Promise<CloneResultView> {
  const record = inputRecord(input);
  const root = webWorkspaceRoot();
  const planned = await planClone(record['link'], record['folder'], root);
  if (planned.plan === undefined) {
    return {
      ok: false,
      directory: planned.view.directory,
      issues: planned.view.issues,
      warnings: [],
      installed: false,
    };
  }
  const token = await sessionDeps().store.get();
  return cloneProject({
    link: record['link'],
    folder: record['folder'],
    install: record['install'] === true,
    ignoreScripts: record['ignoreScripts'] === true,
    root,
    runner: nodeCommandRunner,
    ...(token === undefined ? {} : { token }),
  });
}

// --- Écran 23 — Open Local Project ----------------------------------------

export async function inspectProjectAction(directory: unknown): Promise<ProjectInspectionView> {
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return { ok: false, issues: resolved.issues };
  }
  return inspectProject(resolved.value);
}

export async function installProjectAction(input: unknown): Promise<InstallResultView> {
  const record = inputRecord(input);
  const resolved = resolveLocalDirectory(record['directory']);
  if (!resolved.ok) {
    return { ok: false, directory: '', command: '', issues: resolved.issues, retryable: false };
  }
  return installProject(resolved.value, record['ignoreScripts'] === true, nodeCommandRunner);
}

// --- Écran 24 — Repository & Sharing --------------------------------------

export async function repositoryStatusAction(directory: unknown): Promise<RepositoryStatusView> {
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return refusedRepositoryStatus('', resolved.issues);
  }
  return repositoryStatus(resolved.value, nodeCommandRunner, sessionDeps());
}

export async function repositoryRolesAction(): Promise<readonly RoleView[]> {
  return ROLE_VIEWS;
}

export async function createRepositoryAction(input: unknown): Promise<CreateRepositoryResult> {
  const record = inputRecord(input);
  const resolved = resolveLocalDirectory(record['directory']);
  if (!resolved.ok) {
    return { ok: false, issues: resolved.issues };
  }
  return createRepository({
    directory: resolved.value,
    name: record['name'],
    // Privé par défaut (§20bis) : seul un `false` explicite rend le dépôt public.
    isPrivate: record['isPrivate'] !== false,
    ...(typeof record['description'] === 'string' && record['description'] !== ''
      ? { description: record['description'] }
      : {}),
    runner: nodeCommandRunner,
    deps: sessionDeps(),
  });
}

export async function accessListAction(directory: unknown): Promise<AccessView> {
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return { ok: false, collaborators: [], invitations: [], issues: resolved.issues };
  }
  return listAccess(sessionDeps(), resolved.value, nodeCommandRunner);
}

export async function inviteCollaboratorAction(input: unknown): Promise<AccessMutationView> {
  const record = inputRecord(input);
  const resolved = resolveLocalDirectory(record['directory']);
  if (!resolved.ok) {
    return { ok: false, outcome: '', issues: resolved.issues };
  }
  return inviteCollaborator({
    directory: resolved.value,
    username: record['username'],
    role: record['role'],
    runner: nodeCommandRunner,
    deps: sessionDeps(),
  });
}

export async function removeCollaboratorAction(input: unknown): Promise<AccessMutationView> {
  const record = inputRecord(input);
  const resolved = resolveLocalDirectory(record['directory']);
  if (!resolved.ok) {
    return { ok: false, outcome: '', issues: resolved.issues };
  }
  return removeCollaborator({
    directory: resolved.value,
    username: record['username'],
    runner: nodeCommandRunner,
    deps: sessionDeps(),
  });
}

'use server';

import { type CommandRunner, nodeCommandRunner } from '@buildit/exec';
import { isHostedEnvironment } from '../lib/hosting';
import {
  type CloneDestinationMode,
  type ClonePlace,
  type ClonePreviewView,
  type CloneResultView,
  cloneProject,
  planClone,
} from './clone/clone';
import { webWorkspaceRoot } from './clone/destination';
import {
  completeDeviceConnection,
  type DevicePendingStore,
  type DeviceStartResult,
  memoryDevicePendingStore,
  PERMISSIONS,
  type PermissionView,
  REQUESTED_SCOPES,
  startDevice,
} from './github/device';
import { cookieDevicePendingStore } from './github/device-pending-cookie';
import { type RepositoryListView, repositoriesFor } from './github/repositories';
import { sessionDeps } from './github/server-deps';
import { type GithubStatusView, githubDisconnect, githubStatus } from './github/session';
import {
  type ApplyBaseFilesResult,
  applyBaseFiles,
  type BaseFilesPlan,
  planBaseFiles,
} from './open/base-files-node';
import {
  type InstallResultView,
  inspectPickedEntries,
  inspectProject,
  installProject,
  type ProjectInspectionView,
  resolveLocalDirectory,
  withoutServerSecrets,
} from './open/project';
import { type DeleteRepositoryOutcome, deleteGithubRepository } from './repo/delete-repo';
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
 * Ce fichier est volontairement mince il ne fait que fournir les dépendances
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

/**
 * Où vit le `device_code` en attente entre `startDevice` et `waitDevice` —
 * deux Server Actions, donc deux requêtes. En hébergé, rien ne garantit
 * qu'elles atteignent la même instance serverless : une mémoire de module y
 * est invisible d'une requête à l'autre, et la connexion échouait en silence.
 * Même bascule que `sessionDeps` : cookie scellé en hébergé, mémoire en local.
 */
function devicePendingStore(): DevicePendingStore {
  return isHostedEnvironment()
    ? cookieDevicePendingStore(process.env['SESSION_SECRET'] ?? '')
    : memoryDevicePendingStore;
}

/**
 * L'exécuteur des commandes de projet : `git` et les installations. Le jeton
 * d'environnement du serveur (`PF_GITHUB_TOKEN`) n'atteint jamais ces processus
 * un dépôt cloné n'est pas du code de confiance (§18bis, §24), et `git commit`
 * peut lancer un hook. `PF_GIT_TOKEN`, lui, reste posé par `packages/git` pour
 * la seule commande qui en a besoin.
 */
function projectRunner(): CommandRunner {
  return withoutServerSecrets(nodeCommandRunner);
}

// --- Écran 21 GitHub Connection -----------------------------------------

export async function githubStatusAction(): Promise<GithubStatusView> {
  return githubStatus(sessionDeps());
}

export async function githubPermissionsAction(): Promise<readonly PermissionView[]> {
  return PERMISSIONS;
}

/**
 * Le flux de connexion que l'écran doit proposer.
 *
 * En hébergé : la redirection OAuth (`/github/authorize`), un clic, aucun
 * code à recopier. En local, le device flow garde son avantage un seul
 * processus, pas de callback HTTP à exposer sur une machine qui n'écoute
 * que `127.0.0.1` : rien à y rediriger depuis github.com.
 */
export async function githubConnectionModeAction(): Promise<'redirect' | 'device'> {
  return isHostedEnvironment() ? 'redirect' : 'device';
}

export async function githubStartDeviceAction(): Promise<DeviceStartResult> {
  const deps = sessionDeps();
  return startDevice(deps.fetch, deps.clientId, REQUESTED_SCOPES, Date.now(), devicePendingStore());
}

export async function githubWaitDeviceAction(id: unknown): Promise<GithubStatusView> {
  return completeDeviceConnection(sessionDeps(), id, {}, devicePendingStore());
}

export async function githubDisconnectAction(): Promise<GithubStatusView> {
  return githubDisconnect(sessionDeps());
}

export async function githubRepositoriesAction(): Promise<RepositoryListView> {
  return repositoriesFor(sessionDeps());
}

// --- Écran 22 Clone Project ---------------------------------------------

/**
 * Où le clone atterrit, selon l'environnement.
 *
 * En local, l'utilisateur choisit un dossier **absolu** dans l'explorateur de
 * sa machine : c'est lui le propriétaire du disque, et une « racine de
 * travail » invisible qu'il n'a pas choisie était la principale cause de
 * clones qui semblaient ne pas marcher. En hébergé, le `parent` du navigateur
 * est ignoré l'accepter serait une écriture de fichier arbitraire sur le
 * serveur.
 */
function clonePlace(parent: unknown): ClonePlace {
  return isHostedEnvironment()
    ? { kind: 'root', root: webWorkspaceRoot() }
    : { kind: 'parent', parent };
}

export async function clonePreviewAction(
  link: unknown,
  folder: unknown,
  parent?: unknown,
): Promise<ClonePreviewView> {
  return (await planClone(link, folder, clonePlace(parent))).view;
}

/**
 * Le mode de destination que l'écran doit proposer `parent` en local (un
 * dossier absolu choisi dans l'explorateur), `root` en hébergé (un dossier
 * relatif à la racine de travail).
 *
 * C'est le **serveur** qui tranche : un écran qui déciderait seul à partir
 * d'une variable publique se tromperait dès qu'un hébergeur change de
 * convention, et laisserait passer un chemin absolu venu du navigateur.
 */
export async function cloneDestinationModeAction(): Promise<CloneDestinationMode> {
  return isHostedEnvironment() ? 'root' : 'parent';
}

/**
 * Clone, puis installe si on l'a demandé.
 *
 * Le plan est calculé avant de toucher au trousseau : une entrée invalide ne
 * déclenche ni appel système ni accès à Git.
 */
export async function cloneProjectAction(input: unknown): Promise<CloneResultView> {
  const record = inputRecord(input);
  const place = clonePlace(record['parent']);
  const planned = await planClone(record['link'], record['folder'], place);
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
    root: place,
    runner: projectRunner(),
    ...(token === undefined ? {} : { token }),
  });
}

// --- Écran 23 Open Local Project ----------------------------------------

export async function inspectProjectAction(directory: unknown): Promise<ProjectInspectionView> {
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return { ok: false, issues: resolved.issues };
  }
  return inspectProject(resolved.value);
}

/**
 * Reconnaît un projet que le **navigateur** a ouvert (mode hébergé).
 *
 * Aucun accès disque : l'action applique la règle de détection aux noms de
 * fichiers que le visiteur a laissé lire. C'est le seul chemin d'ouverture
 * possible quand le serveur n'est pas sur la machine de l'utilisateur, et il
 * n'ouvre aucune porte : rien n'est lu, rien n'est écrit, rien n'est lancé.
 */
export async function inspectPickedFolderAction(input: unknown): Promise<ProjectInspectionView> {
  return inspectPickedEntries(inputRecord(input));
}

/**
 * Les fichiers de base manquants d'un projet du disque local seulement : en
 * hébergé, le serveur n'a pas le disque du visiteur (le navigateur s'en charge).
 */
export async function planBaseFilesAction(
  directory: unknown,
): Promise<
  | { readonly ok: true; readonly value: BaseFilesPlan }
  | { readonly ok: false; readonly issues: readonly string[] }
> {
  if (isHostedEnvironment()) {
    return { ok: false, issues: ['Mode hébergé : le dossier est lu dans votre navigateur.'] };
  }
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return { ok: false, issues: resolved.issues };
  }
  return { ok: true, value: await planBaseFiles(resolved.value) };
}

export async function applyBaseFilesAction(directory: unknown): Promise<ApplyBaseFilesResult> {
  if (isHostedEnvironment()) {
    return { ok: false, written: [], issues: ['Mode hébergé : rien n’est écrit sur le serveur.'] };
  }
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return { ok: false, written: [], issues: resolved.issues };
  }
  return applyBaseFiles(resolved.value);
}

export async function installProjectAction(input: unknown): Promise<InstallResultView> {
  const record = inputRecord(input);
  const resolved = resolveLocalDirectory(record['directory']);
  if (!resolved.ok) {
    return { ok: false, directory: '', command: '', issues: resolved.issues, retryable: false };
  }
  return installProject(resolved.value, record['ignoreScripts'] === true, projectRunner());
}

// --- Écran 24 Repository & Sharing --------------------------------------

export async function repositoryStatusAction(directory: unknown): Promise<RepositoryStatusView> {
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return refusedRepositoryStatus('', resolved.issues);
  }
  return repositoryStatus(resolved.value, projectRunner(), sessionDeps());
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
    runner: projectRunner(),
    deps: sessionDeps(),
  });
}

/**
 * Supprime le dépôt GitHub d'un projet, à partir de son adresse.
 *
 * Le refus de « dépôt introuvable » ne remonte pas comme une erreur : le module
 * `repo/delete-repo.ts` le rend comme un **résultat** (`status: 'gone'`), pour
 * que l'écran détache le projet et propose de le reconnecter au lieu d'afficher
 * une panne.
 */
export async function deleteRepositoryAction(url: unknown): Promise<DeleteRepositoryOutcome> {
  return deleteGithubRepository(sessionDeps(), url);
}

export async function accessListAction(directory: unknown): Promise<AccessView> {
  const resolved = resolveLocalDirectory(directory);
  if (!resolved.ok) {
    return { ok: false, collaborators: [], invitations: [], issues: resolved.issues };
  }
  return listAccess(sessionDeps(), resolved.value, projectRunner());
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
    runner: projectRunner(),
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
    runner: projectRunner(),
    deps: sessionDeps(),
  });
}

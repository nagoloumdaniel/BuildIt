import { basename } from 'node:path';
import type { CommandRunner } from '@project-factory/exec';
import {
  ensureInitialCommit,
  githubUrl,
  isGitFailure,
  parseRemote,
  pushToNewOrigin,
  type RepositoryState,
  repositoryState,
} from '@project-factory/git';
import { GitHubClient, ROLES, type Role } from '@project-factory/github';
import { repositoryVisibility, type Visibility } from '../github/repositories';
import { describeIssues, type SessionDeps } from '../github/session';
import { refuseMissingDirectory } from '../open/project';

/**
 * Dépôt et partage (§6.24, §20bis).
 *
 * La règle du §20bis est portée ici, une fois : **sans dépôt GitHub, pas de
 * partage**. Les appelants affichent le refus tel quel plutôt que de le
 * reformuler, sinon deux écrans finiraient par en dire deux choses différentes.
 *
 * Rien n'est dupliqué du CLI : ce sont les mêmes fonctions de `packages/git` et
 * le même client de `packages/github` (`apps/cli/src/commands/{repo,collab}.ts`
 * est la référence d'usage).
 */

export interface RepositoryRef {
  readonly owner: string;
  readonly name: string;
}

/**
 * L'`origin` tel qu'il peut être affiché : les identifiants de l'URL partent.
 *
 * `.git/config` accepte `https://x-access-token:ghp_…@github.com/…`. Ce champ
 * est rendu au navigateur (écran 24) et recopié dans des phrases d'erreur : le
 * laisser tel quel publierait un jeton dans le HTML, dans l'historique du
 * navigateur et dans toute capture d'écran (§24).
 */
export function redactOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.username === '' && url.password === '') {
      return origin;
    }
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    // Forme `git@hôte:chemin` : elle ne porte pas de mot de passe, rien à retirer.
    return origin;
  }
}

/**
 * Le dépôt GitHub d'un `origin`.
 *
 * On relit l'URL **après** nettoyage : un jeton dans l'URL fait refuser le lien
 * par `parseRemote`, mais le dépôt reste bien sur GitHub — l'écran ne doit pas
 * dire le contraire.
 */
function githubRef(state: RepositoryState): RepositoryRef | undefined {
  if (state.github !== undefined) {
    return { owner: state.github.owner, name: state.github.repo };
  }
  if (state.origin === undefined) {
    return undefined;
  }
  const parsed = parseRemote(redactOrigin(state.origin));
  const github = parsed.ok ? parsed.value.github : undefined;
  return github === undefined ? undefined : { owner: github.owner, name: github.repo };
}

export interface RepositoryStatusView {
  /** Le dossier a pu être lu (Git disponible). Pas « le dépôt existe ». */
  readonly ok: boolean;
  readonly directory: string;
  readonly isRepository: boolean;
  readonly hasCommit: boolean;
  readonly origin?: string;
  /** `origin` désigne un dépôt github.com. */
  readonly github: boolean;
  readonly owner?: string;
  readonly name?: string;
  readonly url?: string;
  readonly visibility: Visibility;
  /** Nom de dépôt proposé à la création — le nom du dossier, éditable ensuite. */
  readonly proposedName: string;
  readonly issues: readonly string[];
}

export function refusedRepositoryStatus(
  directory: string,
  issues: readonly string[],
): RepositoryStatusView {
  return {
    ok: false,
    directory,
    isRepository: false,
    hasCommit: false,
    github: false,
    visibility: 'unknown',
    proposedName: directory === '' ? '' : basename(directory),
    issues,
  };
}

/**
 * L'état du dépôt, sans rien modifier : dépôt Git, commit, `origin`, lien et
 * visibilité. `deps` est optionnel — sans compte connecté, la visibilité reste
 * `unknown` plutôt que d'échouer.
 */
export async function repositoryStatus(
  directory: string,
  runner: CommandRunner,
  deps?: SessionDeps,
): Promise<RepositoryStatusView> {
  const missing = await refuseMissingDirectory(directory);
  if (missing !== undefined) {
    return refusedRepositoryStatus(directory, [missing]);
  }
  const state = await repositoryState(directory, runner);
  if (isGitFailure(state)) {
    return refusedRepositoryStatus(directory, describeIssues(state.issues));
  }
  const proposedName = basename(directory);
  const origin = state.origin === undefined ? {} : { origin: redactOrigin(state.origin) };
  const github = githubRef(state);
  if (github === undefined) {
    return {
      ok: true,
      directory,
      isRepository: state.isRepository,
      hasCommit: state.hasCommit,
      ...origin,
      github: false,
      visibility: 'unknown',
      proposedName,
      issues: [],
    };
  }
  const token = deps === undefined ? undefined : await deps.store.get();
  const visibility =
    deps === undefined ? 'unknown' : await repositoryVisibility(deps.fetch, token, github);
  return {
    ok: true,
    directory,
    isRepository: true,
    hasCommit: state.hasCommit,
    ...origin,
    github: true,
    owner: github.owner,
    name: github.name,
    url: githubUrl({ owner: github.owner, repo: github.name }),
    visibility,
    proposedName,
    issues: [],
  };
}

/** Le dépôt GitHub d'un projet, ou la phrase qui dit comment en obtenir un (§20bis). */
export type RepositoryRefResult =
  | { readonly ok: true; readonly value: RepositoryRef }
  | { readonly ok: false; readonly issues: readonly string[] };

export async function requireGitHubRepository(
  directory: string,
  runner: CommandRunner,
): Promise<RepositoryRefResult> {
  const missing = await refuseMissingDirectory(directory);
  if (missing !== undefined) {
    return { ok: false, issues: [missing] };
  }
  const state = await repositoryState(directory, runner);
  if (isGitFailure(state)) {
    return { ok: false, issues: describeIssues(state.issues) };
  }
  const github = githubRef(state);
  if (github === undefined) {
    const origin = state.origin === undefined ? undefined : redactOrigin(state.origin);
    return {
      ok: false,
      issues: [
        origin === undefined
          ? 'Ce projet n’utilise pas de dépôt GitHub : partager un projet passe par son dépôt.'
          : `Le dépôt de ce projet n’est pas sur GitHub (${origin}) : le partage passe par GitHub.`,
        'Créez-le depuis cet écran. En attendant, seul le lien de configuration en lecture seule sera possible (Phase 9).',
      ],
    };
  }
  return { ok: true, value: github };
}

/** Un nom de dépôt GitHub, tel que `pf repo create` l'accepte. */
const REPOSITORY_NAME = /^[A-Za-z0-9._-]{1,100}$/;

export interface CreateRepositoryOptions {
  readonly directory: string;
  readonly name: unknown;
  /** Privé par défaut (§20bis) : le public est un choix explicite. */
  readonly isPrivate: boolean;
  readonly description?: string;
  readonly runner: CommandRunner;
  readonly deps: SessionDeps;
}

export interface CreateRepositoryResult {
  readonly ok: boolean;
  readonly url?: string;
  readonly issues: readonly string[];
}

/**
 * Crée le dépôt GitHub du projet et y pousse le code.
 *
 * L'ordre est celui du CLI, et il compte : le premier commit d'abord — s'il
 * échoue, rien n'a encore été créé sur GitHub —, le dépôt ensuite, le push en
 * dernier. Un échec du push est signalé avec l'URL du dépôt créé, parce qu'il
 * existe bel et bien.
 */
export async function createRepository(
  options: CreateRepositoryOptions,
): Promise<CreateRepositoryResult> {
  const name = typeof options.name === 'string' ? options.name.trim() : '';
  if (!REPOSITORY_NAME.test(name) || name === '.' || name === '..') {
    return {
      ok: false,
      issues: [
        `« ${name} » n’est pas un nom de dépôt GitHub valide : lettres, chiffres, points, tirets et soulignés.`,
      ],
    };
  }
  const state = await repositoryState(options.directory, options.runner);
  if (isGitFailure(state)) {
    return { ok: false, issues: describeIssues(state.issues) };
  }
  if (state.origin !== undefined) {
    return {
      ok: false,
      issues: [
        `Ce projet a déjà un dépôt distant : ${redactOrigin(state.origin)}. Rien n’a été créé.`,
      ],
    };
  }
  const token = await options.deps.store.get();
  if (token === undefined) {
    return { ok: false, issues: ['Connectez-vous à GitHub avant de créer un dépôt.'] };
  }
  const client = new GitHubClient({ token, fetch: options.deps.fetch });
  const viewer = await client.viewer();
  if (!viewer.ok) {
    return { ok: false, issues: describeIssues(viewer.issues) };
  }
  const committed = await ensureInitialCommit(options.directory, options.runner);
  if (committed !== undefined) {
    return {
      ok: false,
      issues: [...describeIssues(committed.issues), 'Rien n’a été créé sur GitHub.'],
    };
  }
  const created = await client.createRepository({
    name,
    private: options.isPrivate,
    ...(options.description === undefined || options.description === ''
      ? {}
      : { description: options.description }),
  });
  if (!created.ok) {
    return { ok: false, issues: describeIssues(created.issues) };
  }
  const url = githubUrl({ owner: created.value.owner, repo: created.value.name });
  const remote = parseRemote(`${created.value.owner}/${created.value.name}`);
  if (!remote.ok) {
    return { ok: false, url, issues: describeIssues(remote.issues) };
  }
  const pushed = await pushToNewOrigin(options.directory, remote.value, {
    runner: options.runner,
    token,
  });
  if (pushed !== undefined) {
    return {
      ok: false,
      url,
      issues: [
        `Le dépôt ${url} a été créé, mais l’envoi du code a échoué.`,
        ...describeIssues(pushed.issues),
      ],
    };
  }
  return { ok: true, url, issues: [] };
}

export interface CollaboratorView {
  readonly login: string;
  readonly role: string;
}

export interface AccessView {
  readonly ok: boolean;
  readonly owner?: string;
  readonly name?: string;
  readonly url?: string;
  readonly collaborators: readonly CollaboratorView[];
  readonly invitations: readonly CollaboratorView[];
  readonly issues: readonly string[];
}

/** Collaborateurs et invitations en attente — le même écran que `pf collab list`. */
export async function listAccess(
  deps: SessionDeps,
  directory: string,
  runner: CommandRunner,
): Promise<AccessView> {
  const reference = await requireGitHubRepository(directory, runner);
  if (!reference.ok) {
    return { ok: false, collaborators: [], invitations: [], issues: reference.issues };
  }
  const { owner, name } = reference.value;
  const info = { owner, name, url: githubUrl({ owner, repo: name }) };
  const token = await deps.store.get();
  if (token === undefined) {
    return {
      ok: false,
      ...info,
      collaborators: [],
      invitations: [],
      issues: ['Connectez-vous à GitHub pour voir les accès à ce dépôt.'],
    };
  }
  const client = new GitHubClient({ token, fetch: deps.fetch });
  const [collaborators, invitations] = await Promise.all([
    client.listCollaborators(reference.value),
    client.listInvitations(reference.value),
  ]);
  const issues = [
    ...(collaborators.ok ? [] : describeIssues(collaborators.issues)),
    ...(invitations.ok ? [] : describeIssues(invitations.issues)),
  ];
  return {
    ok: issues.length === 0,
    ...info,
    collaborators: collaborators.ok
      ? collaborators.value.map((person) => ({ login: person.login, role: person.role }))
      : [],
    invitations: invitations.ok
      ? invitations.value.map((person) => ({ login: person.login, role: person.role }))
      : [],
    issues,
  };
}

export interface AccessMutationView {
  readonly ok: boolean;
  /** La phrase à afficher : ce qui vient de se passer, en clair. */
  readonly outcome: string;
  readonly issues: readonly string[];
  readonly access?: AccessView;
}

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface InviteOptions {
  readonly directory: string;
  readonly username: unknown;
  readonly role: unknown;
  readonly runner: CommandRunner;
  readonly deps: SessionDeps;
}

/** Invite un collaborateur GitHub avec un rôle du §20bis. */
export async function inviteCollaborator(options: InviteOptions): Promise<AccessMutationView> {
  const username = typeof options.username === 'string' ? options.username.trim() : '';
  if (!USERNAME.test(username)) {
    return {
      ok: false,
      outcome: '',
      issues: [`« ${username} » n’est pas un nom d’utilisateur GitHub.`],
    };
  }
  if (!isRole(options.role)) {
    return {
      ok: false,
      outcome: '',
      issues: [`Rôle inconnu : « ${String(options.role)} ». Rôles : ${ROLES.join(', ')}.`],
    };
  }
  const reference = await requireGitHubRepository(options.directory, options.runner);
  if (!reference.ok) {
    return { ok: false, outcome: '', issues: reference.issues };
  }
  const token = await options.deps.store.get();
  if (token === undefined) {
    return { ok: false, outcome: '', issues: ['Connectez-vous à GitHub pour inviter quelqu’un.'] };
  }
  const client = new GitHubClient({ token, fetch: options.deps.fetch });
  const added = await client.addCollaborator(reference.value, username, options.role);
  if (!added.ok) {
    return { ok: false, outcome: '', issues: describeIssues(added.issues) };
  }
  const full = `${reference.value.owner}/${reference.value.name}`;
  const outcome =
    added.value === 'invited'
      ? `${username} est invité sur ${full} (${options.role}). L’accès commence quand l’invitation est acceptée.`
      : `${username} a déjà accès à ${full} : rien n’a changé.`;
  return {
    ok: true,
    outcome,
    issues: [],
    access: await listAccess(options.deps, options.directory, options.runner),
  };
}

export interface RemoveOptions {
  readonly directory: string;
  readonly username: unknown;
  readonly runner: CommandRunner;
  readonly deps: SessionDeps;
}

/** Retire un accès — l'invitation en attente si elle existe, sinon le collaborateur. */
export async function removeCollaborator(options: RemoveOptions): Promise<AccessMutationView> {
  const username = typeof options.username === 'string' ? options.username.trim() : '';
  if (!USERNAME.test(username)) {
    return {
      ok: false,
      outcome: '',
      issues: [`« ${username} » n’est pas un nom d’utilisateur GitHub.`],
    };
  }
  const reference = await requireGitHubRepository(options.directory, options.runner);
  if (!reference.ok) {
    return { ok: false, outcome: '', issues: reference.issues };
  }
  const token = await options.deps.store.get();
  if (token === undefined) {
    return {
      ok: false,
      outcome: '',
      issues: ['Connectez-vous à GitHub pour retirer un accès.'],
    };
  }
  const client = new GitHubClient({ token, fetch: options.deps.fetch });
  const removed = await client.removeCollaborator(reference.value, username);
  if (!removed.ok) {
    return { ok: false, outcome: '', issues: describeIssues(removed.issues) };
  }
  const full = `${reference.value.owner}/${reference.value.name}`;
  const outcome =
    removed.value === 'invitation'
      ? `Invitation de ${username} annulée sur ${full}.`
      : `${username} n’a plus accès à ${full}.`;
  return {
    ok: true,
    outcome,
    issues: [],
    access: await listAccess(options.deps, options.directory, options.runner),
  };
}

export interface RoleView {
  readonly role: string;
  readonly label: string;
  readonly note: string;
}

const ROLE_TEXT: Readonly<Record<Role, { readonly label: string; readonly note: string }>> = {
  read: {
    label: 'Lecture',
    note: 'Voit le dépôt sans écrire : de quoi relire les choix de configuration.',
  },
  triage: {
    label: 'Tri',
    note: 'Gère les tickets et les pull requests, sans toucher au code.',
  },
  write: {
    label: 'Écriture',
    note: 'Pousse du code et des branches. Le rôle par défaut d’une invitation.',
  },
  maintain: {
    label: 'Maintenance',
    note: 'Écriture, plus les réglages du dépôt, sans les accès sensibles.',
  },
  admin: {
    label: 'Administration',
    note: 'Tous les droits, y compris gérer les collaborateurs et le dépôt.',
  },
};

/** Les rôles du §20bis, chacun avec sa phrase — la liste vient du paquet. */
export const ROLE_VIEWS: readonly RoleView[] = ROLES.map((role) => ({
  role,
  label: ROLE_TEXT[role].label,
  note: ROLE_TEXT[role].note,
}));

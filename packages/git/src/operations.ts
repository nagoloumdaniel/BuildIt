import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { type CommandRunner, isTransientFailure, outputTail } from '@project-factory/exec';
import { createMessageFormatter, type Issue } from '@project-factory/validation';
import { type GitHubRepository, type GitRemote, parseRemote } from './remote.js';

export const GIT_CODES = [
  'GIT_TARGET_NOT_EMPTY',
  'GIT_UNAVAILABLE',
  'GIT_CLONE_FAILED',
  'GIT_AUTH_FAILED',
  'GIT_NOT_A_REPOSITORY',
  'GIT_IDENTITY_MISSING',
  'GIT_COMMAND_FAILED',
  'GIT_REMOTE_EXISTS',
  'GIT_PUSH_FAILED',
] as const;

export type GitCode = (typeof GIT_CODES)[number];
export type GitIssue = Issue<GitCode>;

const MESSAGES: Readonly<Record<GitCode, string>> = {
  GIT_TARGET_NOT_EMPTY: 'Le dossier {value} existe et n’est pas vide : un clone n’écrase rien.',
  GIT_UNAVAILABLE: 'Git est introuvable sur cette machine.',
  GIT_CLONE_FAILED:
    'Le clonage a échoué ; rien n’a été laissé sur le disque. Sortie de git :\n{output}',
  GIT_AUTH_FAILED:
    'Dépôt introuvable ou accès refusé ; rien n’a été laissé sur le disque. Sortie de git :\n{output}',
  GIT_NOT_A_REPOSITORY: '{value} n’est pas la racine d’un dépôt Git.',
  GIT_IDENTITY_MISSING:
    'Git ne connaît pas votre identité : le premier commit n’a pas pu être créé.',
  GIT_COMMAND_FAILED: '« git {command} » a échoué. Sortie de git :\n{output}',
  GIT_REMOTE_EXISTS: 'Ce projet a déjà un dépôt distant « origin » : {value}.',
  GIT_PUSH_FAILED: 'L’envoi vers {value} a échoué. Sortie de git :\n{output}',
};

const messageFor = createMessageFormatter(MESSAGES);

function issue(code: GitCode, params: Readonly<Record<string, string>>, hint?: string): GitIssue {
  const base = { code, path: [], message: messageFor(code, params) };
  return hint === undefined ? base : { ...base, hint };
}

export interface GitFailure {
  readonly issues: readonly GitIssue[];
  readonly retryable: boolean;
}

const failure = (item: GitIssue, retryable = false): GitFailure => ({ issues: [item], retryable });

/**
 * Désactivés à chaque appel : même si un lien passait la validation, Git
 * refuserait d'exécuter une commande (`ext::`) ou de lire le disque (`file://`).
 */
const HARDENING = ['-c', 'protocol.ext.allow=never', '-c', 'protocol.file.allow=never'];

/** Variable par laquelle le jeton atteint le credential helper — et lui seul. */
const TOKEN_VARIABLE = 'PF_GIT_TOKEN';

/**
 * Authentification HTTPS sans jeton dans l'URL ni en argument.
 *
 * Le helper est une ligne de shell *de Git* (c'est ainsi que Git lance un
 * helper commençant par `!`) qui ne contient que le **nom** de la variable :
 * `ps` montre la ligne, jamais la valeur. La variable n'existe que dans
 * l'environnement du processus git.
 */
function authentication(token: string | undefined): {
  args: string[];
  env: Record<string, string>;
} {
  const env: Record<string, string> = { GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
  if (token === undefined) {
    return { args: [], env };
  }
  return {
    args: [
      '-c',
      'credential.helper=',
      '-c',
      `credential.helper=!f() { test "$1" = get && echo username=x-access-token && echo "password=$${TOKEN_VARIABLE}"; }; f`,
    ],
    env: { ...env, [TOKEN_VARIABLE]: token },
  };
}

/** Défense en profondeur : même si git recopiait le jeton, il ne ressortirait pas. */
function redact(output: string, token: string | undefined): string {
  return token === undefined || token === '' ? output : output.split(token).join('***');
}

const AUTH_FAILURE =
  /Authentication failed|Repository not found|could not read Username|terminal prompts disabled|Permission denied \(publickey|returned error: 40[134]/i;

async function isEmptyDirectory(path: string): Promise<boolean | undefined> {
  try {
    const info = await stat(path);
    if (!info.isDirectory()) {
      return false;
    }
    return (await readdir(path)).length === 0;
  } catch {
    return undefined;
  }
}

export interface CloneOptions {
  readonly runner: CommandRunner;
  /** Jeton GitHub, pour un dépôt privé en HTTPS sur github.com seulement. */
  readonly token?: string;
}

/**
 * Clone `remote` dans `target`, qui doit être inexistant ou vide.
 *
 * En cas d'échec, le disque revient à son état d'avant : le dossier créé est
 * supprimé (avec les dossiers parents créés pour lui), un dossier vide
 * préexistant est vidé.
 */
export async function cloneRepository(
  remote: GitRemote,
  target: string,
  options: CloneOptions,
): Promise<GitFailure | undefined> {
  const absolute = resolve(target);
  const empty = await isEmptyDirectory(absolute);
  if (empty === false) {
    return failure(
      issue(
        'GIT_TARGET_NOT_EMPTY',
        { value: target },
        'Choisissez un autre dossier : pf clone <lien> <dossier>.',
      ),
    );
  }
  // `mkdir` récursif rend le premier dossier qu'il a créé : c'est lui qu'on
  // supprime en cas d'échec, parents compris.
  const created = empty === undefined ? await mkdir(absolute, { recursive: true }) : undefined;

  const token =
    remote.github !== undefined && remote.protocol === 'https' ? options.token : undefined;
  const auth = authentication(token);
  const args = [...HARDENING, ...auth.args, 'clone', '--', remote.url, absolute];

  const cleanUp = async (): Promise<void> => {
    if (created !== undefined) {
      await rm(created, { recursive: true, force: true });
      return;
    }
    for (const entry of await readdir(absolute)) {
      await rm(join(absolute, entry), { recursive: true, force: true });
    }
  };

  let result: Awaited<ReturnType<CommandRunner['run']>>;
  try {
    result = await options.runner.run('git', args, dirname(absolute), { env: auth.env });
  } catch {
    await cleanUp();
    return failure(issue('GIT_UNAVAILABLE', {}, 'Installez Git : https://git-scm.com/downloads'));
  }
  if (result.exitCode === 0) {
    return undefined;
  }
  await cleanUp();
  const output = outputTail(redact(result.output, token));
  if (isTransientFailure(result.output)) {
    return failure(
      issue('GIT_CLONE_FAILED', { output }, 'Erreur réseau : relancez la commande.'),
      true,
    );
  }
  if (AUTH_FAILURE.test(result.output)) {
    const hint =
      remote.protocol === 'ssh'
        ? 'Vérifiez le lien et votre clé SSH (ssh -T git@github.com).'
        : token === undefined
          ? 'Vérifiez le lien. Dépôt privé : connectez-vous d’abord (pf login).'
          : 'Vérifiez le lien, et que le compte connecté a accès à ce dépôt.';
    return failure(issue('GIT_AUTH_FAILED', { output }, hint));
  }
  return failure(issue('GIT_CLONE_FAILED', { output }));
}

/** Lance une commande git et rend sa sortie, ou l'échec mis en forme. */
async function git(
  runner: CommandRunner,
  dir: string,
  args: readonly string[],
): Promise<{ ok: true; output: string } | { ok: false; failure: GitFailure; output: string }> {
  let result: Awaited<ReturnType<CommandRunner['run']>>;
  try {
    result = await runner.run('git', args, dir, { env: { GIT_TERMINAL_PROMPT: '0' } });
  } catch {
    return {
      ok: false,
      output: '',
      failure: failure(
        issue('GIT_UNAVAILABLE', {}, 'Installez Git : https://git-scm.com/downloads'),
      ),
    };
  }
  if (result.exitCode === 0) {
    return { ok: true, output: result.output.trim() };
  }
  return {
    ok: false,
    output: result.output,
    failure: failure(
      issue('GIT_COMMAND_FAILED', { command: args.join(' '), output: outputTail(result.output) }),
    ),
  };
}

export interface RepositoryState {
  /** `dir` est la racine d'un dépôt Git. */
  readonly isRepository: boolean;
  readonly hasCommit: boolean;
  /** L'URL de `origin`, telle que configurée. */
  readonly origin?: string;
  /** `origin` quand il désigne un dépôt github.com. */
  readonly github?: GitHubRepository;
}

/** Ce que Git sait du dossier : dépôt, commit, `origin`. Ne modifie rien. */
export async function repositoryState(
  dir: string,
  runner: CommandRunner,
): Promise<RepositoryState | GitFailure> {
  const top = await git(runner, dir, ['rev-parse', '--show-toplevel']);
  if (!top.ok) {
    const unavailable = top.failure.issues.some((item) => item.code === 'GIT_UNAVAILABLE');
    return unavailable ? top.failure : { isRepository: false, hasCommit: false };
  }
  if (resolve(top.output) !== resolve(dir)) {
    return { isRepository: false, hasCommit: false };
  }
  const head = await git(runner, dir, ['rev-parse', '--verify', '--quiet', 'HEAD']);
  const origin = await git(runner, dir, ['remote', 'get-url', 'origin']);
  if (!origin.ok) {
    return { isRepository: true, hasCommit: head.ok };
  }
  const parsed = parseRemote(origin.output);
  const github = parsed.ok ? parsed.value.github : undefined;
  return {
    isRepository: true,
    hasCommit: head.ok,
    origin: origin.output,
    ...(github === undefined ? {} : { github }),
  };
}

export function isGitFailure(value: RepositoryState | GitFailure): value is GitFailure {
  return 'issues' in value;
}

/**
 * Crée le dépôt local et son premier commit, si besoin. Un dépôt qui a déjà
 * un commit est laissé tel quel ; un dossier à l'intérieur d'un autre dépôt
 * est refusé — pas de dépôt imbriqué.
 */
export async function ensureInitialCommit(
  dir: string,
  runner: CommandRunner,
): Promise<GitFailure | undefined> {
  const state = await repositoryState(dir, runner);
  if (isGitFailure(state)) {
    return state;
  }
  if (state.hasCommit) {
    return undefined;
  }
  if (!state.isRepository) {
    const inside = await git(runner, dir, ['rev-parse', '--is-inside-work-tree']);
    if (inside.ok) {
      return failure(
        issue(
          'GIT_NOT_A_REPOSITORY',
          { value: dir },
          'Ce dossier est à l’intérieur d’un autre dépôt Git : ouvrez sa racine.',
        ),
      );
    }
    const init = await git(runner, dir, ['init', '--initial-branch=main']);
    if (!init.ok) {
      return init.failure;
    }
  }
  const add = await git(runner, dir, ['add', '--all']);
  if (!add.ok) {
    return add.failure;
  }
  const commit = await git(runner, dir, ['commit', '--message', 'chore: initial commit']);
  if (!commit.ok) {
    if (/tell me who you are|user\.email|user\.name/i.test(commit.output)) {
      return failure(
        issue(
          'GIT_IDENTITY_MISSING',
          {},
          'git config --global user.name "Votre Nom" && git config --global user.email vous@exemple.com',
        ),
      );
    }
    return commit.failure;
  }
  return undefined;
}

/** Déclare `origin` puis pousse la branche courante, jeton par le credential helper. */
export async function pushToNewOrigin(
  dir: string,
  remote: GitRemote,
  options: CloneOptions,
): Promise<GitFailure | undefined> {
  const state = await repositoryState(dir, options.runner);
  if (isGitFailure(state)) {
    return state;
  }
  if (state.origin !== undefined) {
    return failure(issue('GIT_REMOTE_EXISTS', { value: state.origin }));
  }
  const add = await git(options.runner, dir, ['remote', 'add', 'origin', remote.url]);
  if (!add.ok) {
    return add.failure;
  }
  const token = remote.protocol === 'https' ? options.token : undefined;
  const auth = authentication(token);
  let result: Awaited<ReturnType<CommandRunner['run']>>;
  try {
    result = await options.runner.run(
      'git',
      [...HARDENING, ...auth.args, 'push', '--set-upstream', 'origin', 'HEAD'],
      dir,
      { env: auth.env },
    );
  } catch {
    return failure(issue('GIT_UNAVAILABLE', {}, 'Installez Git : https://git-scm.com/downloads'));
  }
  if (result.exitCode === 0) {
    return undefined;
  }
  return failure(
    issue(
      'GIT_PUSH_FAILED',
      { value: remote.url, output: outputTail(redact(result.output, token)) },
      '« origin » est configuré : relancez git push --set-upstream origin HEAD.',
    ),
    isTransientFailure(result.output),
  );
}

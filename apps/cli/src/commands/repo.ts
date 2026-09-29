import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  ensureInitialCommit,
  githubUrl,
  isGitFailure,
  parseRemote,
  pushToNewOrigin,
  repositoryState,
} from '@project-factory/git';
import { printIssues, usageError } from '../format.js';
import { requireGitHubProject, requireSession } from '../github-session.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const REPO_USAGE: string = `Usage : pf repo <create|share> [options]

  create [--public] [--name <nom>] [--description <texte>] [--dir <dossier>] [--yes]
          Crée le dépôt GitHub du projet (privé par défaut) et y pousse le code.
          Nom proposé : celui de package.json, sinon celui du dossier.
  share [--dir <dossier>]
          Le lien du dépôt, ses collaborateurs et les invitations en attente.`;

const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;

async function proposedName(dir: string): Promise<string> {
  try {
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8')) as { name?: unknown };
    if (typeof pkg.name === 'string' && pkg.name !== '') {
      return pkg.name.replace(/^@[^/]+\//, '');
    }
  } catch {
    // Pas de package.json lisible : le nom du dossier.
  }
  return basename(dir);
}

async function create(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      public: { type: 'boolean', default: false },
      name: { type: 'string' },
      description: { type: 'string' },
      dir: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
    },
  });
  if (positionals.length > 0) {
    return usageError(io, `Argument inattendu : « ${positionals[0]} ».`, REPO_USAGE);
  }
  const dir = resolve(io.cwd, values.dir ?? '.');
  const name = values.name ?? (await proposedName(dir));
  if (!REPO_NAME.test(name) || name === '.' || name === '..') {
    return usageError(
      io,
      `« ${name} » n’est pas un nom de dépôt GitHub valide.`,
      'pf repo create --name <nom>',
    );
  }

  const state = await repositoryState(dir, io.runner);
  if (isGitFailure(state)) {
    printIssues(io, state.issues);
    return EXIT.failure;
  }
  if (state.origin !== undefined) {
    io.err(`✗ Ce projet a déjà un dépôt distant : ${state.origin}.`);
    io.err(
      state.github === undefined
        ? '  → Rien n’a été créé.'
        : '  → Pour le partager : pf repo share.',
    );
    return EXIT.failure;
  }

  const session = await requireSession(io);
  if (session === undefined) {
    return EXIT.failure;
  }
  const viewer = await session.client.viewer();
  if (!viewer.ok) {
    printIssues(io, viewer.issues);
    return EXIT.failure;
  }
  const visibility = values.public ? 'public' : 'privé';
  const plan = `Créer le dépôt ${visibility} ${viewer.value.login}/${name} et y pousser ce projet ?`;
  if (!values.yes) {
    if (!io.interactive) {
      io.out(`${plan} — relancez avec --yes pour confirmer. Rien n’a été créé.`);
      return EXIT.ok;
    }
    if (!(await io.prompter.confirm(plan))) {
      io.out('Rien n’a été créé.');
      return EXIT.ok;
    }
  }

  // Le commit d'abord : s'il échoue, rien n'a encore été créé sur GitHub.
  const committed = await ensureInitialCommit(dir, io.runner);
  if (committed !== undefined) {
    printIssues(io, committed.issues);
    io.err('  Rien n’a été créé sur GitHub.');
    return EXIT.failure;
  }
  const created = await session.client.createRepository({
    name,
    private: !values.public,
    ...(values.description === undefined ? {} : { description: values.description }),
  });
  if (!created.ok) {
    printIssues(io, created.issues);
    return EXIT.failure;
  }
  const repository = { owner: created.value.owner, repo: created.value.name };
  const remote = parseRemote(`${repository.owner}/${repository.repo}`);
  const pushed = remote.ok
    ? await pushToNewOrigin(dir, remote.value, { runner: io.runner, token: session.token })
    : { issues: remote.issues, retryable: false };
  if (pushed !== undefined) {
    io.err(`Le dépôt ${githubUrl(repository)} a été créé, mais l’envoi du code a échoué :`);
    printIssues(io, pushed.issues);
    return EXIT.failure;
  }
  io.out(`✓ Dépôt ${created.value.private ? 'privé' : 'public'} créé : ${githubUrl(repository)}`);
  io.out('  Le code y est poussé. Pour inviter quelqu’un : pf collab add <utilisateur>.');
  return EXIT.ok;
}

async function share(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: { dir: { type: 'string' } },
  });
  if (positionals.length > 0) {
    return usageError(io, `Argument inattendu : « ${positionals[0]} ».`, REPO_USAGE);
  }
  const repository = await requireGitHubProject(io, resolve(io.cwd, values.dir ?? '.'));
  if (repository === undefined) {
    return EXIT.failure;
  }
  io.out(`Dépôt : ${githubUrl({ owner: repository.owner, repo: repository.name })}`);
  const session = await requireSession(io);
  if (session === undefined) {
    return EXIT.failure;
  }
  return printAccess(io, session.client, repository);
}

/** Collaborateurs et invitations en attente. */
export async function printAccess(
  io: Io,
  client: NonNullable<Awaited<ReturnType<typeof requireSession>>>['client'],
  repository: { owner: string; name: string },
): Promise<ExitCode> {
  const collaborators = await client.listCollaborators(repository);
  const invitations = await client.listInvitations(repository);
  if (!collaborators.ok || !invitations.ok) {
    printIssues(io, [
      ...(collaborators.ok ? [] : collaborators.issues),
      ...(invitations.ok ? [] : invitations.issues),
    ]);
    return EXIT.failure;
  }
  io.out('Collaborateurs :');
  for (const person of collaborators.value) {
    io.out(`  ${person.login.padEnd(24)} ${person.role}`);
  }
  if (invitations.value.length > 0) {
    io.out('Invitations en attente :');
    for (const person of invitations.value) {
      io.out(`  ${person.login.padEnd(24)} ${person.role}`);
    }
  }
  io.out('Inviter : pf collab add <utilisateur> [--role read|triage|write|maintain|admin]');
  return EXIT.ok;
}

export async function repo(args: readonly string[], io: Io): Promise<ExitCode> {
  const [action, ...rest] = args;
  switch (action) {
    case 'create':
      return create(rest, io);
    case 'share':
      return share(rest, io);
    case undefined:
    case '--help':
    case '-h':
      io.out(REPO_USAGE);
      return action === undefined ? EXIT.usage : EXIT.ok;
    default:
      return usageError(io, `Action inconnue : « ${action} ».`, REPO_USAGE);
  }
}

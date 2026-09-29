import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ROLES, type Role } from '@project-factory/github';
import { printIssues, usageError } from '../format.js';
import { requireGitHubProject, requireSession } from '../github-session.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { printAccess } from './repo.js';

export const COLLAB_USAGE: string = `Usage : pf collab <add|list|remove> [options]

Gère les accès au dépôt GitHub du projet — seul un projet adossé à un dépôt
GitHub se partage. Les droits sont ceux de GitHub : il faut être
administrateur du dépôt.

  add <utilisateur> [--role ${ROLES.join('|')}]   rôle par défaut : write
  list
  remove <utilisateur> [--yes]

Option commune : --dir <dossier> (par défaut, le dossier courant).`;

const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export async function collab(args: readonly string[], io: Io): Promise<ExitCode> {
  const [action, ...rest] = args;
  if (action === undefined || action === '--help' || action === '-h') {
    io.out(COLLAB_USAGE);
    return action === undefined ? EXIT.usage : EXIT.ok;
  }
  if (action !== 'add' && action !== 'list' && action !== 'remove') {
    return usageError(io, `Action inconnue : « ${action} ».`, COLLAB_USAGE);
  }
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      role: { type: 'string', default: 'write' },
      dir: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
    },
  });
  const expected = action === 'list' ? 0 : 1;
  if (positionals.length !== expected) {
    return usageError(
      io,
      expected === 0
        ? 'pf collab list ne prend pas d’utilisateur.'
        : 'Un nom d’utilisateur GitHub attendu.',
      COLLAB_USAGE,
    );
  }
  const username = positionals[0] ?? '';
  if (expected === 1 && !USERNAME.test(username)) {
    return usageError(io, `« ${username} » n’est pas un nom d’utilisateur GitHub.`);
  }
  if (!isRole(values.role)) {
    return usageError(io, `Rôle inconnu : « ${values.role} ».`, `Rôles : ${ROLES.join(', ')}.`);
  }

  const repository = await requireGitHubProject(io, resolve(io.cwd, values.dir ?? '.'));
  if (repository === undefined) {
    return EXIT.failure;
  }
  const session = await requireSession(io);
  if (session === undefined) {
    return EXIT.failure;
  }
  const full = `${repository.owner}/${repository.name}`;

  if (action === 'list') {
    return printAccess(io, session.client, repository);
  }
  if (action === 'add') {
    const added = await session.client.addCollaborator(repository, username, values.role);
    if (!added.ok) {
      printIssues(io, added.issues);
      return EXIT.failure;
    }
    io.out(
      added.value === 'invited'
        ? `✓ ${username} est invité sur ${full} (${values.role}). L’accès commence quand il accepte l’invitation.`
        : `${username} a déjà accès à ${full} : rien n’a changé.`,
    );
    return EXIT.ok;
  }

  const question = `Retirer l’accès de ${username} à ${full} ?`;
  if (!values.yes) {
    if (!io.interactive) {
      io.out(`${question} — relancez avec --yes pour confirmer. Rien n’a changé.`);
      return EXIT.ok;
    }
    if (!(await io.prompter.confirm(question))) {
      io.out('Rien n’a changé.');
      return EXIT.ok;
    }
  }
  const removed = await session.client.removeCollaborator(repository, username);
  if (!removed.ok) {
    printIssues(io, removed.issues);
    return EXIT.failure;
  }
  io.out(
    removed.value === 'invitation'
      ? `✓ Invitation de ${username} annulée.`
      : `✓ ${username} n’a plus accès à ${full}.`,
  );
  return EXIT.ok;
}

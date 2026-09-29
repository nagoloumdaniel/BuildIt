import { basename, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { cloneRepository, type GitRemote, parseRemote } from '@project-factory/git';
import { GitHubClient } from '@project-factory/github';
import { printIssues, usageError } from '../format.js';
import { tokenStore } from '../github-session.js';
import { offerInstall } from '../install-flow.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const CLONE_USAGE: string = `Usage : pf clone [lien|propriétaire/dépôt] [dossier] [options]

Clone un dépôt, puis propose d'installer ses dépendances. Sans lien, dans un
terminal et connecté à GitHub : choisissez parmi vos dépôts.

Liens acceptés : https://…, git@hôte:chemin, ssh://…, propriétaire/dépôt (GitHub).

Options :
  --install         Installer les dépendances sans demander
  --ignore-scripts  Installer sans exécuter les scripts du projet
  --yes             Ne poser aucune question`;

const FOLDER = /^[A-Za-z0-9._-]+$/;

/** Le dossier par défaut : le nom du dépôt. */
function defaultFolder(remote: GitRemote): string | undefined {
  const name =
    remote.github?.repo ??
    basename(remote.url.replace(/[:/]+$/, '').replace(/.*[:/]/, '')).replace(/\.git$/, '');
  return FOLDER.test(name) && name !== '.' && name !== '..' ? name : undefined;
}

async function pickRepository(io: Io, token: string | undefined): Promise<string | undefined> {
  if (token !== undefined) {
    const repositories = await new GitHubClient({ token, fetch: io.fetch }).listRepositories();
    if (repositories.ok && repositories.value.length > 0) {
      return io.prompter.select(
        'Quel dépôt cloner ?',
        repositories.value.map((repository) => ({
          value: repository.fullName,
          label: repository.fullName,
          hint: [repository.private ? 'privé' : 'public', repository.description]
            .filter((part) => part !== '')
            .join(' — '),
        })),
      );
    }
    if (!repositories.ok) {
      printIssues(io, repositories.issues);
    }
  }
  const link = await io.prompter.text('Lien du dépôt (ou propriétaire/dépôt) :');
  return link;
}

export async function clone(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      install: { type: 'boolean', default: false },
      'ignore-scripts': { type: 'boolean', default: false },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(CLONE_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 2) {
    return usageError(io, 'Un lien et un dossier au plus.', CLONE_USAGE);
  }
  const ask = io.interactive && !values.yes;
  const token = await tokenStore(io).get();

  let link = positionals[0];
  if (link === undefined) {
    if (!ask) {
      return usageError(
        io,
        'Lien du dépôt manquant.',
        'pf clone <lien|propriétaire/dépôt> [dossier]',
      );
    }
    link = await pickRepository(io, token);
  }
  const parsed = parseRemote(link ?? '');
  if (!parsed.ok) {
    printIssues(io, parsed.issues);
    return EXIT.usage;
  }
  const remote = parsed.value;

  const folder = positionals[1] ?? defaultFolder(remote);
  if (folder === undefined) {
    return usageError(
      io,
      'Impossible de déduire un nom de dossier de ce lien.',
      'pf clone <lien> <dossier>',
    );
  }
  const target = resolve(io.cwd, folder);
  const shown = relative(io.cwd, target) || '.';

  io.out(
    `Clonage de ${remote.github === undefined ? remote.url : `${remote.github.owner}/${remote.github.repo}`} dans ${shown}/…`,
  );
  const failure = await cloneRepository(remote, target, {
    runner: io.runner,
    ...(token === undefined ? {} : { token }),
  });
  if (failure !== undefined) {
    printIssues(io, failure.issues);
    return EXIT.failure;
  }
  io.out('✓ Dépôt cloné.');

  const installed = await offerInstall(io, target, {
    install: values.install || values.yes,
    ignoreScripts: values['ignore-scripts'],
    untrusted: true,
    unknownIsFine: true,
  });
  io.out('');
  io.out(`Et maintenant : cd ${shown}`);
  return installed;
}

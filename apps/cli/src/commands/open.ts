import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { usageError } from '../format.js';
import { offerInstall } from '../install-flow.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const OPEN_USAGE: string = `Usage : pf open <dossier> [--ignore-scripts] [--yes]

Reconnaît un projet de la machine (écosystème, gestionnaire de paquets) et
propose d'installer ses dépendances — la commande exacte est affichée avant.`;

export const INSTALL_USAGE: string = `Usage : pf install [--ignore-scripts] [--yes]

Installe les dépendances du projet du dossier courant. La commande exacte est
affichée avant ; sans terminal, --yes est exigé.`;

const OPTIONS = {
  'ignore-scripts': { type: 'boolean', default: false },
  yes: { type: 'boolean', short: 'y', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

export async function open(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: OPTIONS,
  });
  if (values.help) {
    io.out(OPEN_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 1) {
    return usageError(io, 'Un seul dossier attendu.', OPEN_USAGE);
  }
  let dir = positionals[0];
  if (dir === undefined) {
    if (!io.interactive || values.yes) {
      return usageError(io, 'Dossier manquant.', 'pf open <dossier>');
    }
    dir = await io.prompter.text('Dossier du projet :');
  }
  return offerInstall(io, resolve(io.cwd, dir), {
    install: values.yes,
    ignoreScripts: values['ignore-scripts'],
    untrusted: false,
  });
}

export async function installCommand(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: OPTIONS,
  });
  if (values.help) {
    io.out(INSTALL_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 0) {
    return usageError(
      io,
      'pf install agit sur le dossier courant ; pour un autre : pf open <dossier>.',
    );
  }
  return offerInstall(io, io.cwd, {
    install: values.yes,
    ignoreScripts: values['ignore-scripts'],
    untrusted: false,
  });
}

import { readFileSync } from 'node:fs';
import { suggest } from '@project-factory/validation';
import { add } from './commands/add.js';
import { clone } from './commands/clone.js';
import { collab } from './commands/collab.js';
import { create } from './commands/create.js';
import { generate } from './commands/generate.js';
import { graph } from './commands/graph.js';
import { key } from './commands/key.js';
import { login, logout } from './commands/login.js';
import { menu } from './commands/menu.js';
import { installCommand, open } from './commands/open.js';
import { PENDING, pending } from './commands/pending.js';
import { repo } from './commands/repo.js';
import { template } from './commands/template.js';
import { usageError } from './format.js';
import { EXIT, type ExitCode, type Io } from './io.js';

type Command = (args: readonly string[], io: Io) => Promise<ExitCode>;

const COMMANDS: Readonly<Record<string, Command>> = {
  create,
  template,
  generate,
  graph,
  add,
  key,
  clone,
  open,
  install: installCommand,
  login,
  logout,
  repo,
  collab,
};

/** Lu depuis `package.json` : `src/` et `dist/` en sont tous deux voisins. */
export const VERSION: string = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

export const HELP: string = `pf — Project Factory : décrire un projet, obtenir un projet prêt à développer.

Usage : pf [commande] [options]

Commandes :
  (aucune)                      Menu d'accueil
  create [nom] --preset <p>     Crée un projet depuis un preset certifié
  template list|show|use        Les presets
  generate <manifest.json>      Génère depuis un manifest
  graph [manifest.json]         La stack résolue : choisie, ajoutée, statut
  add <technologie>             Ajoute une technologie au manifest
  key set|status|clear          Clé API LLM locale

Projets existants et GitHub :
  clone [lien] [dossier]        Clone un dépôt, propose l'installation
  open <dossier>                Reconnaît un projet local, propose l'installation
  install                       Installe les dépendances du dossier courant
  login | logout                Connexion GitHub (jeton dans le trousseau)
  repo create | share           Dépôt GitHub du projet, privé par défaut
  collab add|list|remove        Collaborateurs du dépôt

À venir : ${Object.keys(PENDING).join(', ')}.

Options : --help, --version. Aide d'une commande : pf <commande> --help.
Codes de sortie : 0 succès, 1 échec, 2 usage.`;

/**
 * Point d'entrée testable : des arguments et des entrées-sorties, un code de
 * sortie. Aucune exception ne remonte jusqu'à l'utilisateur sous forme de pile.
 */
export async function run(argv: readonly string[], io: Io): Promise<ExitCode> {
  const [name, ...args] = argv;
  const help = (): ExitCode => {
    io.out(HELP);
    return EXIT.ok;
  };

  try {
    if (name === undefined) {
      return await menu(io, help);
    }
    if (name === '--help' || name === '-h' || name === 'help') {
      return help();
    }
    if (name === '--version' || name === '-v') {
      io.out(VERSION);
      return EXIT.ok;
    }
    const command = COMMANDS[name];
    if (command !== undefined) {
      return await command(args, io);
    }
    if (name in PENDING) {
      return pending(name, io);
    }
    const close = suggest(name, [...Object.keys(COMMANDS), ...Object.keys(PENDING)]);
    return usageError(
      io,
      `Commande inconnue : « ${name} ».`,
      close === undefined
        ? 'pf --help liste les commandes.'
        : `Vouliez-vous dire « pf ${close} » ?`,
    );
  } catch (error) {
    // `parseArgs` signale un drapeau inconnu par une exception : c'est une
    // erreur d'usage, pas un plantage.
    if (
      error instanceof TypeError &&
      'code' in error &&
      String(error.code).startsWith('ERR_PARSE_ARGS')
    ) {
      return usageError(io, error.message, `pf ${name ?? ''} --help`);
    }
    io.err(`✗ Erreur inattendue : ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.failure;
  }
}

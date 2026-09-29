import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  type CommandResult,
  type CommandRunner,
  isTransientFailure,
  outputTail as tail,
} from '@project-factory/exec';
import { createMessageFormatter, type Issue } from '@project-factory/validation';
import { CI_SCRIPTS } from './infrastructure.js';

export type { CommandResult, CommandRunner, RunOptions } from '@project-factory/exec';
export {
  isTransientFailure,
  nodeCommandRunner,
  resolveWindowsCommand,
} from '@project-factory/exec';

/**
 * Post Install et Validation (§22) : ce qui se passe une fois les fichiers
 * écrits — installer les dépendances, initialiser Git, lancer les
 * vérifications du projet généré.
 *
 * Toutes les commandes passent par un `CommandRunner` injectable. Les tests
 * n'exécutent jamais de vrai `pnpm` ni de vrai `git` : ils décrivent ce que
 * l'exécuteur répond, y compris les pannes, ce qu'un vrai shell ne permettrait
 * pas de provoquer à la demande.
 */

export const POST_INSTALL_CODES = [
  'GEN_INSTALL_FAILED',
  'GEN_GIT_FAILED',
  'GEN_GIT_NESTED',
  'GEN_VALIDATION_FAILED',
  'GEN_COMMAND_UNAVAILABLE',
] as const;

export type PostInstallCode = (typeof POST_INSTALL_CODES)[number];
export type PostInstallIssue = Issue<PostInstallCode>;

const MESSAGES: Readonly<Record<PostInstallCode, string>> = {
  GEN_INSTALL_FAILED:
    'L’installation des dépendances a échoué ({retry}). Les fichiers du projet sont en place. Fin de la sortie de pnpm :\n{output}',
  GEN_GIT_FAILED:
    '« git {command} » a échoué. Les fichiers du projet sont en place. Sortie de git :\n{output}',
  GEN_GIT_NESTED:
    'Le dossier {value} est à l’intérieur d’un dépôt Git existant : aucun dépôt imbriqué n’a été créé, et rien n’a été commité.',
  GEN_VALIDATION_FAILED:
    'Le projet généré échoue à « pnpm run {command} ». C’est un défaut du générateur, pas de votre projet — signalez-le. Fin de la sortie :\n{output}',
  GEN_COMMAND_UNAVAILABLE:
    'La commande « {command} » est introuvable. Installez-la puis relancez à partir de cette étape : les fichiers du projet sont en place.',
};

const messageFor = createMessageFormatter(MESSAGES);

/** Un étage qui échoue : le problème, et si le relancer a un sens. */
export interface StepFailure {
  readonly issue: PostInstallIssue;
  readonly retryable: boolean;
}

function unavailable(command: string): StepFailure {
  return {
    issue: {
      code: 'GEN_COMMAND_UNAVAILABLE',
      path: [command],
      message: messageFor('GEN_COMMAND_UNAVAILABLE', { command }),
    },
    retryable: false,
  };
}

/** Lance une commande ; `undefined` si elle n'a pas pu démarrer du tout. */
async function attempt(
  runner: CommandRunner,
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<CommandResult | undefined> {
  try {
    return await runner.run(command, args, cwd);
  } catch {
    return undefined;
  }
}

export async function runInstall(
  runner: CommandRunner,
  cwd: string,
): Promise<StepFailure | undefined> {
  const result = await attempt(runner, 'pnpm', ['install'], cwd);
  if (result === undefined) {
    return unavailable('pnpm');
  }
  if (result.exitCode === 0) {
    return undefined;
  }
  const retryable = isTransientFailure(result.output);
  return {
    issue: {
      code: 'GEN_INSTALL_FAILED',
      path: ['install'],
      message: messageFor('GEN_INSTALL_FAILED', {
        retry: retryable
          ? 'erreur réseau probable : relancez à partir de l’installation'
          : 'erreur durable : relancer ne changera rien',
        output: tail(result.output),
      }),
    },
    retryable,
  };
}

export interface GitOutcome {
  readonly failure?: StepFailure;
  /** Git volontairement sauté — le projet est dans un autre dépôt. */
  readonly warning?: PostInstallIssue;
}

const INITIAL_COMMIT = 'chore: initial commit';

/**
 * `git init` + premier commit.
 *
 * Trois cas, lus avec `git rev-parse --show-prefix` :
 * - hors de tout dépôt → init, puis commit ;
 * - racine d'un dépôt (un `.git` était déjà là, ce que l'écriture tolère) →
 *   commit seulement ;
 * - sous-dossier d'un autre dépôt → rien. Un dépôt imbriqué surprendrait, et
 *   commiter dans le dépôt parent serait pire : ce n'est pas le nôtre.
 *
 * Aucune identité n'est inventée : si `user.name` manque, le commit échoue
 * avec le message de git, qui dit exactement quoi configurer.
 */
export async function runGit(runner: CommandRunner, cwd: string): Promise<GitOutcome> {
  const probe = await attempt(runner, 'git', ['rev-parse', '--show-prefix'], cwd);
  if (probe === undefined) {
    return { failure: unavailable('git') };
  }

  if (probe.exitCode === 0 && probe.output.trim() !== '') {
    return {
      warning: {
        code: 'GEN_GIT_NESTED',
        path: ['git'],
        message: messageFor('GEN_GIT_NESTED', { value: cwd }),
      },
    };
  }

  const steps: (readonly string[])[] = [
    ...(probe.exitCode === 0 ? [] : [['init', '--initial-branch=main']]),
    ['add', '--all'],
    ['commit', '--message', INITIAL_COMMIT],
  ];

  for (const args of steps) {
    const result = await attempt(runner, 'git', args, cwd);
    if (result === undefined) {
      return { failure: unavailable('git') };
    }
    if (result.exitCode !== 0) {
      return {
        failure: {
          issue: {
            code: 'GEN_GIT_FAILED',
            path: ['git', args[0] as string],
            message: messageFor('GEN_GIT_FAILED', {
              command: args[0] as string,
              output: tail(result.output),
            }),
          },
          retryable: false,
        },
      };
    }
  }

  return {};
}

/**
 * Lance, dans l'ordre de la CI générée, les scripts qu'elle lancera.
 *
 * Un échec ici est un défaut du générateur : le projet sort à peine de ses
 * mains, l'utilisateur n'y a encore rien écrit.
 */
export async function runValidation(
  runner: CommandRunner,
  cwd: string,
  scripts: Readonly<Record<string, string>>,
): Promise<StepFailure | undefined> {
  for (const name of CI_SCRIPTS.filter((script) => scripts[script] !== undefined)) {
    const result = await attempt(runner, 'pnpm', ['run', name], cwd);
    if (result === undefined) {
      return unavailable('pnpm');
    }
    if (result.exitCode !== 0) {
      return {
        issue: {
          code: 'GEN_VALIDATION_FAILED',
          path: ['validate', name],
          message: messageFor('GEN_VALIDATION_FAILED', {
            command: name,
            output: tail(result.output),
          }),
        },
        retryable: false,
      };
    }
  }
  return undefined;
}

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createMessageFormatter, type Issue } from '@project-factory/validation';
import { CI_SCRIPTS } from './infrastructure.js';

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

export interface CommandResult {
  readonly exitCode: number;
  /** Sorties standard et d'erreur, dans l'ordre d'arrivée. */
  readonly output: string;
}

export interface CommandRunner {
  /**
   * Lance `command` avec `args`, **sans shell**, dans `cwd`.
   *
   * Rejette si la commande ne peut pas être lancée du tout (introuvable) ;
   * résout avec son code de sortie dans tous les autres cas.
   */
  run(command: string, args: readonly string[], cwd: string): Promise<CommandResult>;
}

/**
 * Résout une commande en exécutable lançable **sans shell** sous Windows.
 *
 * Le problème : `pnpm` s'y installe comme `pnpm.cmd`, et depuis la
 * CVE-2024-27980 Node refuse de lancer un `.cmd` sans shell (`EINVAL`).
 * Activer le shell « juste pour Windows » ferait réinterpréter les arguments
 * par `cmd.exe` — un `$(…)` ou un `;` cesserait d'être du texte. L'invariant
 * « jamais de shell » vaut sur toutes les plateformes ou ne vaut rien.
 *
 * La sortie : on cherche la commande dans le PATH. Un vrai exécutable se lance
 * tel quel ; un `.cmd` de paquet npm cache un script JavaScript qu'on lance
 * avec Node. Dans les deux cas, aucun interpréteur de commandes n'intervient.
 */
function resolveWindowsCommand(command: string): { file: string; prefix: string[] } {
  const directories = (process.env['PATH'] ?? '').split(';').filter((part) => part.length > 0);

  for (const directory of directories) {
    for (const extension of ['.exe', '.com']) {
      const candidate = join(directory, `${command}${extension}`);
      if (existsSync(candidate)) {
        return { file: candidate, prefix: [] };
      }
    }

    for (const extension of ['.cmd', '.bat']) {
      if (!existsSync(join(directory, `${command}${extension}`))) {
        continue;
      }
      // Un lanceur npm voisine avec le paquet qu'il lance.
      for (const entry of ['.cjs', '.mjs', '.js']) {
        const script = join(directory, 'node_modules', command, 'bin', `${command}${entry}`);
        if (existsSync(script)) {
          return { file: process.execPath, prefix: [script] };
        }
      }
    }
  }

  // Introuvable : on laisse `spawn` échouer avec ENOENT, qui dit la vérité.
  return { file: command, prefix: [] };
}

/**
 * L'exécuteur réel.
 *
 * **Jamais de shell, sur aucune plateforme.** Les arguments sont passés tels
 * quels au processus : un `;` ou un `$(…)` reste du texte, même sous Windows.
 */
export const nodeCommandRunner: CommandRunner = {
  run(command, args, cwd) {
    return new Promise((resolve, reject) => {
      const resolved =
        process.platform === 'win32'
          ? resolveWindowsCommand(command)
          : { file: command, prefix: [] };

      const child = spawn(resolved.file, [...resolved.prefix, ...args], {
        cwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.on('error', reject);
      child.on('close', (code) => {
        resolve({ exitCode: code ?? 1, output });
      });
    });
  },
};

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

/** Nombre de lignes de sortie recopiées dans un message : la fin, qui dit pourquoi. */
const OUTPUT_TAIL = 20;

function tail(output: string): string {
  return output.trimEnd().split('\n').slice(-OUTPUT_TAIL).join('\n');
}

/**
 * Signatures d'une panne réseau ou d'un registre momentanément indisponible.
 *
 * Seule l'installation y est exposée : Git local et les vérifications du
 * projet sont déterministes, les relancer donnerait le même résultat.
 */
const TRANSIENT =
  /\bE(?:CONNRESET|TIMEDOUT|NOTFOUND|AI_AGAIN|CONNREFUSED)\b|ERR_PNPM_(?:META_FETCH_FAIL|FETCH_5\d\d)|ERR_SOCKET_TIMEOUT|socket hang up/;

export function isTransientFailure(output: string): boolean {
  return TRANSIENT.test(output);
}

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

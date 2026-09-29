import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * L'exécution de commandes externes, pour tout le moteur.
 *
 * Née dans le generator (5B.2), sortie ici quand `git`, `workspace` et
 * `github` en ont eu besoin : un seul endroit où l'on lance un processus, un
 * seul endroit où l'invariant « jamais de shell » se vérifie.
 *
 * Toutes les commandes passent par un `CommandRunner` injectable. Les tests
 * décrivent ce que l'exécuteur répond, y compris les pannes, ce qu'un vrai
 * shell ne permettrait pas de provoquer à la demande.
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
  run(
    command: string,
    args: readonly string[],
    cwd: string,
    options?: RunOptions,
  ): Promise<CommandResult>;
}

export interface RunOptions {
  /**
   * Écrit sur l'entrée standard de la commande, puis la ferme. Le seul moyen
   * de lui passer un secret : un argument se lit dans `ps`.
   */
  readonly input?: string;
  /**
   * Variables ajoutées à l'environnement **de cette commande seule** — jamais
   * à celui du processus courant.
   */
  readonly env?: Readonly<Record<string, string>>;
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
export function resolveWindowsCommand(
  command: string,
  searchPath: string = process.env['PATH'] ?? '',
): { file: string; prefix: string[] } {
  const directories = searchPath.split(';').filter((part) => part.length > 0);

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

/** Ce que `spawn` lance : tel quel, sauf sous Windows. */
export function resolveCommand(
  command: string,
  platform: NodeJS.Platform = process.platform,
): { file: string; prefix: string[] } {
  return platform === 'win32' ? resolveWindowsCommand(command) : { file: command, prefix: [] };
}

/**
 * L'exécuteur réel.
 *
 * **Jamais de shell, sur aucune plateforme.** Les arguments sont passés tels
 * quels au processus : un `;` ou un `$(…)` reste du texte, même sous Windows.
 */
export const nodeCommandRunner: CommandRunner = {
  run(command, args, cwd, options = {}) {
    return new Promise((resolve, reject) => {
      const resolved = resolveCommand(command);

      const child = spawn(resolved.file, [...resolved.prefix, ...args], {
        cwd,
        shell: false,
        env: options.env === undefined ? process.env : { ...process.env, ...options.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // Sans `input`, l'entrée est fermée aussitôt : une commande qui voudrait
      // poser une question lit une fin de fichier au lieu d'attendre.
      // Une commande peut se terminer sans lire son entrée : l'écriture
      // échoue alors (EPIPE), ce qui ne dit rien de son résultat.
      child.stdin.on('error', () => undefined);
      child.stdin.end(options.input ?? '');
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

/** Nombre de lignes de sortie recopiées dans un message : la fin, qui dit pourquoi. */
const OUTPUT_TAIL = 20;

/** Les dernières lignes d'une sortie de commande. */
export function outputTail(output: string): string {
  return output.trimEnd().split('\n').slice(-OUTPUT_TAIL).join('\n');
}

/**
 * Signatures d'une panne réseau ou d'un registre momentanément indisponible —
 * pnpm, npm et git. Une commande qui échoue ainsi vaut d'être relancée ; les
 * autres échecs sont déterministes, les relancer donnerait le même résultat.
 */
const TRANSIENT =
  /\bE(?:CONNRESET|TIMEDOUT|NOTFOUND|AI_AGAIN|CONNREFUSED)\b|ERR_PNPM_(?:META_FETCH_FAIL|FETCH_5\d\d)|ERR_SOCKET_TIMEOUT|socket hang up|Could not resolve host|Failed to connect to|Connection timed out|early EOF|RPC failed|The requested URL returned error: 5\d\d/;

export function isTransientFailure(output: string): boolean {
  return TRANSIENT.test(output);
}

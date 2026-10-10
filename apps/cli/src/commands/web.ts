import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type CommandResult, outputTail } from '@project-factory/exec';
import { usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const WEB_USAGE: string = `Usage : pf web [--port <n>] [--no-open]

Sert le configurateur web déjà construit (pnpm build), ouvre le navigateur,
et reste au premier plan : Ctrl-C arrête le serveur.

Le serveur n'écoute que sur 127.0.0.1 — il reste sur cette machine.

Options :
  --port <n>   Port d'écoute (défaut 4173)
  --no-open    Ne pas ouvrir le navigateur`;

/**
 * Où `next build` dépose le serveur autonome, dans l'ordre d'essai.
 *
 * En **monorepo**, Next trace depuis la racine du dépôt (celle de
 * `pnpm-workspace.yaml`) et recopie l'arborescence : le serveur se trouve sous
 * `standalone/apps/web/server.js`, pas à la racine de `standalone/`. Lancée
 * seule — la racine de traçage est alors l'application — la sortie le met bien
 * sous `standalone/server.js`. Les deux formes existent dans la nature.
 */
const MONOREPO_SERVER = join('apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js');
const FLAT_SERVER = join('apps', 'web', '.next', 'standalone', 'server.js');

const SERVERS: readonly string[] = [MONOREPO_SERVER, FLAT_SERVER];

/**
 * Le premier emplacement qui contient vraiment un serveur.
 *
 * Vérifié le 11/10/2026 sur ce dépôt : `next build` y produit le chemin
 * monorepo, et un `pf web` qui ne connaissait que l'autre refusait de démarrer
 * un serveur pourtant construit.
 */
async function findServer(root: string): Promise<string | undefined> {
  for (const relative of SERVERS) {
    const candidate = resolve(root, relative);
    if (await isFile(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Le seul hôte écouté. Le serveur standalone de Next écoute `0.0.0.0` par
 * défaut : sans cette valeur, le configurateur serait joignable depuis le
 * réseau, ce que `pf web` ne veut pas.
 */
const HOST = '127.0.0.1';

export const DEFAULT_PORT: number = 4173;

const OPTIONS = {
  port: { type: 'string' },
  'no-open': { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h', default: false },
} as const;

/** Un port : des chiffres, dans les bornes. « 0x10 » n'est pas un port. */
function isPort(raw: string): boolean {
  return /^\d+$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 65535;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Le navigateur de la plateforme : `explorer` sous Windows, `open` sous macOS,
 * `xdg-open` ailleurs. Le nom est passé tel quel à l'exécuteur, qui résout
 * l'exécutable **sans shell** (`resolveCommand` de `@project-factory/exec`) :
 * l'URL reste un argument, elle n'est jamais relue par un interpréteur.
 */
function browserCommand(platform: NodeJS.Platform): string {
  if (platform === 'win32') {
    return 'explorer';
  }
  return platform === 'darwin' ? 'open' : 'xdg-open';
}

/**
 * Ouvre l'URL, sans jamais faire échouer la commande : un navigateur absent se
 * dit, le serveur continue. Le code de sortie est ignoré — `explorer` rend 1
 * même quand la page s'ouvre.
 */
async function openBrowser(io: Io, url: string): Promise<void> {
  try {
    await io.runner.run(browserCommand(io.platform), [url], io.cwd);
  } catch (error) {
    io.out(`! Navigateur non ouvert (${reason(error)}).`);
    io.out(`  → Ouvrez ${url} vous-même.`);
  }
}

/**
 * Lance le serveur et attend sa fin — c'est lui qui tient le premier plan.
 *
 * L'hôte et le port passent par l'environnement de **cette commande seule** :
 * c'est ce que lit le serveur standalone de Next (`process.env.HOSTNAME`,
 * `process.env.PORT`). Les mêmes valeurs sont répétées en arguments pour que
 * l'intention reste lisible, y compris dans `ps`.
 */
async function serve(io: Io, server: string, port: number): Promise<CommandResult> {
  try {
    return await io.runner.run(
      'node',
      [server, '--hostname', HOST, '--port', String(port)],
      io.cwd,
      { env: { HOSTNAME: HOST, PORT: String(port) } },
    );
  } catch (error) {
    // Node introuvable, par exemple : le dire vaut mieux qu'une pile.
    return { exitCode: 1, output: reason(error) };
  }
}

export async function web(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: OPTIONS,
  });
  if (values.help) {
    io.out(WEB_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 0) {
    return usageError(io, 'pf web ne prend pas d’argument.', WEB_USAGE);
  }
  const raw = values.port;
  if (raw !== undefined && !isPort(raw)) {
    return usageError(
      io,
      `Port invalide : « ${raw} ».`,
      `pf web --port <n>, avec n entre 1 et 65535 (défaut ${DEFAULT_PORT}).`,
    );
  }
  const port = raw === undefined ? DEFAULT_PORT : Number(raw);

  const server = await findServer(io.cwd);
  if (server === undefined) {
    io.out(`✗ Le configurateur n’est pas construit : ${MONOREPO_SERVER} est absent.`);
    io.out('  → Lancez « pnpm build » depuis la racine du dépôt, puis relancez pf web.');
    return EXIT.failure;
  }

  if (await io.portProbe(HOST, port)) {
    io.out(`✗ Un serveur répond déjà sur ${HOST}:${port} : pf n’en démarre pas un second.`);
    io.out(`  → Arrêtez-le (Ctrl-C dans son terminal), ou changez de port : pf web --port <n>.`);
    return EXIT.failure;
  }

  const url = `http://${HOST}:${port}`;
  io.out(`Configurateur : ${url} — local uniquement, Ctrl-C pour arrêter.`);
  const serving = serve(io, server, port);
  if (!values['no-open']) {
    await openBrowser(io, url);
  }
  const result = await serving;
  if (result.exitCode !== 0) {
    io.err(`✗ Le serveur du configurateur s’est arrêté avec le code ${result.exitCode}.`);
    const tail = outputTail(result.output);
    if (tail !== '') {
      io.err(tail);
    }
    io.err('  → Lisez la sortie ci-dessus, corrigez, puis relancez pf web.');
    return EXIT.failure;
  }
  return EXIT.ok;
}

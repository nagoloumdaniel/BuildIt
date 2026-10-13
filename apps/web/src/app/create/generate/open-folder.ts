import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sameDirectory } from '../../../lib/delete-project';
import { readRegistry } from '../../../lib/output-registry';

/**
 * Ouvrir dans l'explorateur de la machine le dossier d'un projet généré.
 *
 * Pourquoi tant de refus pour un simple « ouvrir » : le chemin vient du
 * navigateur, et lancer un programme sur un chemin arbitraire reste une
 * exécution décidée par le client. Le dossier n'est donc ouvert que s'il est
 * **inscrit au registre** (seule la route de génération y écrit, après une
 * écriture réussie) et qu'il existe encore. Le chemin lancé est celui du
 * registre, résolu par le serveur, jamais la chaîne reçue.
 *
 * En hébergé, rien n'est ouvert : le serveur n'est pas la machine de
 * l'utilisateur, un explorateur s'ouvrirait chez Vercel.
 */

export type OpenFolderRefusal = 'hosted' | 'empty' | 'notRegistered' | 'missing' | 'failed';

export type OpenFolderOutcome =
  | { readonly ok: true; readonly directory: string }
  | { readonly ok: false; readonly reason: OpenFolderRefusal };

export interface OpenFolderDeps {
  readonly hosted: boolean;
  /** Le dossier de travail, où vit le registre. Résolu par le serveur. */
  readonly registryRoot: string;
  readonly platform: NodeJS.Platform;
  /** Lance le programme, détaché ; vrai s'il a démarré. Injecté pour les tests. */
  readonly launch: (command: string, args: readonly string[]) => Promise<boolean>;
}

/** Le gestionnaire de fichiers de chaque système, appelé sans shell. */
export function folderOpener(
  platform: NodeJS.Platform,
  directory: string,
): { readonly command: string; readonly args: readonly string[] } {
  if (platform === 'win32') {
    return { command: 'explorer.exe', args: [directory] };
  }
  if (platform === 'darwin') {
    return { command: 'open', args: [directory] };
  }
  return { command: 'xdg-open', args: [directory] };
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export async function openProjectFolder(
  directory: unknown,
  deps: OpenFolderDeps,
): Promise<OpenFolderOutcome> {
  if (deps.hosted) {
    return { ok: false, reason: 'hosted' };
  }
  if (typeof directory !== 'string' || directory.trim() === '') {
    return { ok: false, reason: 'empty' };
  }
  const wanted = resolve(directory);
  const registered = (await readRegistry(deps.registryRoot)).find((entry) =>
    sameDirectory(entry, wanted),
  );
  if (registered === undefined) {
    return { ok: false, reason: 'notRegistered' };
  }
  if (!(await isDirectory(registered))) {
    return { ok: false, reason: 'missing' };
  }
  const opener = folderOpener(deps.platform, registered);
  const started = await deps.launch(opener.command, opener.args);
  return started ? { ok: true, directory: registered } : { ok: false, reason: 'failed' };
}

/**
 * Lance le programme détaché, sans shell : le chemin est un argument, jamais
 * une ligne de commande interprétée. `explorer.exe` rend un code de sortie 1
 * même quand il a ouvert la fenêtre : seul le démarrage compte, pas la sortie.
 */
export function launchDetached(command: string, args: readonly string[]): Promise<boolean> {
  return new Promise((done) => {
    try {
      const child = spawn(command, [...args], { detached: true, shell: false, stdio: 'ignore' });
      child.once('error', () => done(false));
      child.once('spawn', () => {
        child.unref();
        done(true);
      });
    } catch {
      done(false);
    }
  });
}

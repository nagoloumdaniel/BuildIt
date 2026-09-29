import {
  type Detection,
  detectProject,
  formatCommand,
  install,
  installCommand,
} from '@project-factory/workspace';
import { printIssues } from './format.js';
import { EXIT, type ExitCode, type Io } from './io.js';

export interface InstallFlags {
  /** Installer sans demander : `--install` (clone) ou `--yes`. */
  readonly install: boolean;
  readonly ignoreScripts: boolean;
  /** Code qu'on n'a pas écrit : ses scripts d'installation méritent un avertissement. */
  readonly untrusted: boolean;
  /**
   * Après un clone, un dépôt qui n'est pas un projet reconnu n'est pas un
   * échec : le clone, lui, a réussi.
   */
  readonly unknownIsFine?: boolean;
}

function describe(detection: Detection): string {
  if (detection.packageManager === undefined) {
    return `${detection.label} (d’après ${detection.evidence})`;
  }
  const origin = detection.source === 'assumed' ? 'supposé' : `d’après ${detection.evidence}`;
  return `${detection.label} — ${detection.packageManager} (${origin})`;
}

/**
 * Détecte le projet, montre la commande exacte **avant** de la lancer, et ne
 * la lance qu'avec un accord : une réponse, ou un drapeau explicite.
 */
export async function offerInstall(io: Io, dir: string, flags: InstallFlags): Promise<ExitCode> {
  const detected = await detectProject(dir);
  if (
    !detected.ok &&
    flags.unknownIsFine === true &&
    detected.issues.every((item) => item.code === 'WORKSPACE_UNKNOWN')
  ) {
    io.out('Aucun projet reconnu dans ce dépôt : rien à installer.');
    return EXIT.ok;
  }
  if (!detected.ok) {
    printIssues(io, detected.issues);
    return EXIT.failure;
  }
  const detection = detected.value;
  io.out(`Projet : ${describe(detection)}`);
  for (const warning of detection.warnings) {
    io.out(`! ${warning}`);
  }
  if (detection.manualCommand !== undefined) {
    io.out(
      `L’installation automatique de ce type de projet arrive en V1. Lancez : ${detection.manualCommand}`,
    );
    return EXIT.ok;
  }

  const normal = installCommand(detection) ?? { command: '', args: [] };
  const safe = installCommand(detection, { ignoreScripts: true }) ?? normal;
  if (flags.untrusted) {
    io.out(
      '! Code que vous n’avez pas écrit : ses scripts d’installation (postinstall…) s’exécuteraient sur votre machine.',
    );
  }

  let ignoreScripts = flags.ignoreScripts;
  if (!flags.install) {
    if (!io.interactive) {
      io.out(
        `Rien n’a été installé. Pour installer : ${formatCommand(flags.ignoreScripts ? safe : normal)}`,
      );
      return EXIT.ok;
    }
    if (flags.ignoreScripts) {
      if (!(await io.prompter.confirm(`Lancer « ${formatCommand(safe)} » ?`))) {
        io.out('Rien n’a été installé.');
        return EXIT.ok;
      }
    } else {
      const withScripts = {
        value: 'scripts',
        label: 'Installer',
        hint: formatCommand(normal),
      } as const;
      const withoutScripts = {
        value: 'safe',
        label: 'Installer sans scripts',
        hint: `${formatCommand(safe)}${flags.untrusted ? ' — recommandé pour du code inconnu' : ''}`,
      } as const;
      const choice = await io.prompter.select('Installer les dépendances ?', [
        ...(flags.untrusted ? [withoutScripts, withScripts] : [withScripts, withoutScripts]),
        { value: 'skip', label: 'Ne pas installer' },
      ]);
      if (choice === 'skip') {
        io.out('Rien n’a été installé.');
        return EXIT.ok;
      }
      ignoreScripts = choice === 'safe';
    }
  }

  const command = ignoreScripts ? safe : normal;
  io.out(`→ ${formatCommand(command)}`);
  const failure = await install(detection, dir, io.runner, { ignoreScripts });
  if (failure !== undefined) {
    printIssues(io, failure.issues);
    if (failure.retryable) {
      io.err('  → Erreur passagère : relancez pf install.');
    }
    return EXIT.failure;
  }
  io.out('✓ Dépendances installées.');
  return EXIT.ok;
}

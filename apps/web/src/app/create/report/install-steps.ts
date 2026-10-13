import type { Messages } from '../../../lib/i18n/messages';

/**
 * Les commandes d'installation du projet généré (§6.14).
 *
 * Dérivées du brouillon seul — jamais une liste de technologies recopiée
 * (§11) : ce que ce module sait, c'est que tous les presets de ce dépôt
 * utilisent pnpm (`PROJECT_CONTEXT.md`), et que les deux seuls réglages
 * d'infrastructure du brouillon (`infra.docker`, `envVarNames`) changent la
 * marche à suivre. Aucun autre choix du Stack Builder n'ajoute d'étape ici :
 * un projet généré est déjà prêt à l'emploi par construction (§22), ces
 * commandes ne font que l'amorcer.
 *
 * Chaque étape dit **où** elle se fait (`where`) : une personne qui n'a jamais
 * ouvert de terminal doit savoir lequel ouvrir, dans quel dossier, et quelles
 * étapes n'en demandent pas (renseigner `.env` se fait dans un éditeur). Les
 * libellés viennent du dictionnaire (`output.install`) : les **commandes**,
 * elles, ne se traduisent pas, elles se tapent telles quelles.
 */

export type InstallPlace = 'terminal' | 'editor';

export interface InstallStep {
  readonly where: InstallPlace;
  readonly label: string;
  /** Le « comment » détaillé, quand le libellé ne suffit pas (ouvrir un terminal). */
  readonly detail?: string;
  /** Absente pour une étape sans commande : on n'invente pas de commande à copier. */
  readonly command?: string;
}

export interface InstallGuideInput {
  /** Le chemin absolu du projet, connu seulement quand le serveur l'a écrit. */
  readonly directory: string;
  /** Le nom du dossier, quand le navigateur l'a écrit lui-même (chemin inconnu). */
  readonly folderName?: string;
  readonly docker: boolean;
  readonly envVarNames: readonly string[];
  /** Les dépendances ont déjà été installées par la génération : pas d'étape à refaire. */
  readonly installed?: boolean;
}

/** `cd` seulement si un chemin absolu est connu, absent en mode hébergé. */
export function installSteps(input: InstallGuideInput, t: Messages): readonly InstallStep[] {
  const labels = t.output.install;
  const steps: InstallStep[] = [];

  if (input.directory !== '') {
    // Un dossier choisi dans l'explorateur peut contenir des espaces : la
    // commande copiée doit marcher telle quelle, donc le chemin est cité.
    const target = /\s/.test(input.directory) ? `"${input.directory}"` : input.directory;
    steps.push({
      where: 'terminal',
      label: labels.openTerminal,
      detail: labels.openTerminalHow,
      command: `cd ${target}`,
    });
  } else {
    // Sans chemin absolu, un `cd` deviné mènerait ailleurs : on dit quel
    // dossier ouvrir, sans commande.
    steps.push({
      where: 'terminal',
      label:
        input.folderName === undefined || input.folderName === ''
          ? labels.openTerminalUnpacked
          : labels.openTerminalIn(input.folderName),
      detail: labels.openTerminalHow,
    });
  }

  if (input.docker) {
    steps.push({ where: 'terminal', label: labels.services, command: 'docker compose up -d' });
  }

  if (input.envVarNames.length > 0) {
    steps.push({ where: 'terminal', label: labels.envCopy, command: 'cp .env.example .env' });
    steps.push({
      where: 'editor',
      label: labels.envEdit(input.envVarNames.length, input.envVarNames.join(', ')),
    });
  }

  if (input.installed !== true) {
    steps.push({ where: 'terminal', label: labels.install, command: 'pnpm install' });
  }
  steps.push({ where: 'terminal', label: labels.dev, command: 'pnpm dev' });

  return steps;
}

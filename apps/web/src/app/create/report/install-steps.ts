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
 * Les libellés viennent du dictionnaire (`build.report.install`) : les
 * **commandes**, elles, ne se traduisent pas — elles se tapent telles quelles.
 */

export interface InstallStep {
  readonly label: string;
  readonly command: string;
}

export interface InstallGuideInput {
  readonly directory: string;
  readonly docker: boolean;
  readonly envVarNames: readonly string[];
  /** Les dépendances ont déjà été installées par la génération : pas d'étape à refaire. */
  readonly installed?: boolean;
}

/** `cd` seulement si une destination est connue — absente en mode hébergé. */
export function installSteps(input: InstallGuideInput, t: Messages): readonly InstallStep[] {
  const labels = t.build.report.install;
  const steps: InstallStep[] = [];

  if (input.directory !== '') {
    // Un dossier choisi dans l'explorateur peut contenir des espaces : la
    // commande copiée doit marcher telle quelle, donc le chemin est cité.
    const target = /\s/.test(input.directory) ? `"${input.directory}"` : input.directory;
    steps.push({ label: labels.open, command: `cd ${target}` });
  }

  if (input.docker) {
    steps.push({ label: labels.services, command: 'docker compose up -d' });
  }

  if (input.envVarNames.length > 0) {
    steps.push({
      label: labels.env(input.envVarNames.length, input.envVarNames.join(', ')),
      command: 'cp .env.example .env',
    });
  }

  if (input.installed !== true) {
    steps.push({ label: labels.install, command: 'pnpm install' });
  }
  steps.push({ label: labels.dev, command: 'pnpm dev' });

  return steps;
}

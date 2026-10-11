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
 */

export interface InstallStep {
  readonly label: string;
  readonly command: string;
}

export interface InstallGuideInput {
  readonly directory: string;
  readonly docker: boolean;
  readonly envVarNames: readonly string[];
}

/** `cd` seulement si une destination est connue — absente en mode hébergé. */
export function installSteps(input: InstallGuideInput): readonly InstallStep[] {
  const steps: InstallStep[] = [];

  if (input.directory !== '') {
    steps.push({ label: 'Ouvrir le projet', command: `cd ${input.directory}` });
  }

  if (input.docker) {
    steps.push({ label: 'Démarrer les services', command: 'docker compose up -d' });
  }

  if (input.envVarNames.length > 0) {
    steps.push({
      label: `Renseigner ${input.envVarNames.length > 1 ? 'les variables' : 'la variable'} d’environnement (${input.envVarNames.join(', ')})`,
      command: 'cp .env.example .env',
    });
  }

  steps.push({ label: 'Installer les dépendances', command: 'pnpm install' });
  steps.push({ label: 'Démarrer en développement', command: 'pnpm dev' });

  return steps;
}

import { describe, expect, it } from 'vitest';
import { EN, FR } from '../../../lib/i18n/messages';
import { installSteps } from './install-steps';

/** Les seules commandes, dans l'ordre : ce qu'on copie. */
function commands(steps: ReturnType<typeof installSteps>): readonly string[] {
  return steps.flatMap((step) => (step.command === undefined ? [] : [step.command]));
}

describe('installSteps — la marche à suivre après une génération réussie', () => {
  it('le socle minimal : ouvrir un terminal, installer, démarrer', () => {
    const steps = installSteps({ directory: '', docker: false, envVarNames: [] }, FR);
    expect(commands(steps)).toEqual(['pnpm install', 'pnpm dev']);
    expect(steps[0]?.label).toContain('Décompressez l’archive');
    expect(steps[0]?.command).toBeUndefined();
  });

  it('un répertoire connu (mode local) ajoute le `cd`, en premier, dans un terminal', () => {
    const steps = installSteps(
      { directory: '/home/dev/mon-projet', docker: false, envVarNames: [] },
      FR,
    );
    expect(steps[0]).toMatchObject({
      where: 'terminal',
      label: 'Ouvrez un terminal dans le dossier du projet.',
      command: 'cd /home/dev/mon-projet',
    });
    // Le « comment » d'ouvrir un terminal, pour chaque système.
    expect(steps[0]?.detail).toContain('clic droit dans le dossier');
    expect(steps[0]?.detail).toContain('PowerShell');
  });

  it('sans répertoire (mode hébergé), aucun `cd` n’est proposé', () => {
    const steps = installSteps({ directory: '', docker: false, envVarNames: [] }, FR);
    expect(commands(steps).some((command) => command.startsWith('cd '))).toBe(false);
  });

  it('un dossier écrit par le navigateur est nommé, sans `cd` deviné', () => {
    const steps = installSteps(
      { directory: '', folderName: 'mon-projet', docker: false, envVarNames: [] },
      FR,
    );
    expect(steps[0]?.label).toBe('Ouvrez un terminal dans le dossier « mon-projet ».');
    expect(steps[0]?.command).toBeUndefined();
  });

  it('un nom de dossier vide retombe sur l’archive décompressée', () => {
    const steps = installSteps(
      { directory: '', folderName: '', docker: false, envVarNames: [] },
      FR,
    );
    expect(steps[0]?.label).toContain('Décompressez');
  });

  it('chaque commande se tape dans le terminal ouvert à la première étape', () => {
    const steps = installSteps({ directory: '/p', docker: true, envVarNames: ['A'] }, FR);
    for (const step of steps.filter((item) => item.command !== undefined)) {
      expect(step.where).toBe('terminal');
    }
    expect(steps.find((step) => step.command === 'pnpm install')?.label).toContain(
      'À taper dans ce terminal',
    );
  });

  it('Docker ajoute le démarrage des services, avant l’installation', () => {
    const list = commands(installSteps({ directory: '', docker: true, envVarNames: [] }, FR));
    expect(list).toContain('docker compose up -d');
    expect(list.indexOf('docker compose up -d')).toBeLessThan(list.indexOf('pnpm install'));
  });

  it('des variables : une copie en terminal, puis une saisie dans l’éditeur, sans commande', () => {
    const steps = installSteps(
      { directory: '', docker: false, envVarNames: ['DATABASE_URL', 'BETTER_AUTH_SECRET'] },
      FR,
    );
    expect(steps.find((step) => step.command === 'cp .env.example .env')?.where).toBe('terminal');
    const edit = steps.find((step) => step.where === 'editor');
    expect(edit?.command).toBeUndefined();
    expect(edit?.label).toContain('Sans terminal');
    expect(edit?.label).toContain('DATABASE_URL');
    expect(edit?.label).toContain('BETTER_AUTH_SECRET');
    expect(edit?.label).toContain('les variables');
  });

  it('une seule variable dit « la variable », pas « les variables »', () => {
    const steps = installSteps({ directory: '', docker: false, envVarNames: ['DATABASE_URL'] }, FR);
    expect(steps.find((step) => step.where === 'editor')?.label).toContain('la variable');
  });

  it('tout cumulé : ordre cd, docker, env, install, dev', () => {
    const steps = installSteps(
      { directory: '/tmp/mon-projet', docker: true, envVarNames: ['DATABASE_URL'] },
      FR,
    );
    expect(commands(steps)).toEqual([
      'cd /tmp/mon-projet',
      'docker compose up -d',
      'cp .env.example .env',
      'pnpm install',
      'pnpm dev',
    ]);
    expect(steps.map((step) => step.where)).toEqual([
      'terminal',
      'terminal',
      'terminal',
      'editor',
      'terminal',
      'terminal',
    ]);
  });

  it('parle anglais avec le dictionnaire anglais, commandes inchangées', () => {
    const steps = installSteps({ directory: '/p', docker: false, envVarNames: ['X', 'Y'] }, EN);
    expect(steps[0]?.label).toBe('Open a terminal in the project folder.');
    expect(steps[0]?.detail).toContain('Open in Terminal');
    expect(steps.find((step) => step.where === 'editor')?.label).toContain('No terminal needed');
    expect(commands(steps)).toContain('pnpm install');
  });
});

describe('installSteps — après une sortie en dossier', () => {
  it('des dépendances déjà installées ne sont pas à réinstaller', () => {
    const steps = installSteps(
      { directory: '/home/dev/app', docker: false, envVarNames: [], installed: true },
      FR,
    );
    expect(commands(steps)).toEqual(['cd /home/dev/app', 'pnpm dev']);
  });

  it('une installation ratée laisse l’étape d’installation', () => {
    const steps = installSteps(
      { directory: '', docker: false, envVarNames: [], installed: false },
      FR,
    );
    expect(commands(steps)).toContain('pnpm install');
  });

  it('un dossier avec des espaces est cité, pour que la commande copiée marche', () => {
    const steps = installSteps(
      { directory: 'C:\\Mes Projets\\app', docker: false, envVarNames: [] },
      FR,
    );
    expect(steps[0]?.command).toBe('cd "C:\\Mes Projets\\app"');
  });
});

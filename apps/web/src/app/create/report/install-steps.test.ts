import { describe, expect, it } from 'vitest';
import { FR } from '../../../lib/i18n/messages';
import { installSteps } from './install-steps';

describe('installSteps — la marche à suivre après une génération réussie', () => {
  it('le socle minimal : installer, démarrer, rien de plus sans Docker ni variable', () => {
    const steps = installSteps({ directory: '', docker: false, envVarNames: [] }, FR);
    expect(steps.map((step) => step.command)).toEqual(['pnpm install', 'pnpm dev']);
  });

  it('un répertoire connu (mode local) ajoute le `cd`, en premier', () => {
    const steps = installSteps(
      {
        directory: '/home/dev/mon-projet',
        docker: false,
        envVarNames: [],
      },
      FR,
    );
    expect(steps[0]).toEqual({ label: 'Ouvrir le projet', command: 'cd /home/dev/mon-projet' });
  });

  it('sans répertoire (mode hébergé), aucun `cd` n’est proposé', () => {
    const steps = installSteps({ directory: '', docker: false, envVarNames: [] }, FR);
    expect(steps.some((step) => step.command.startsWith('cd '))).toBe(false);
  });

  it('Docker ajoute le démarrage des services, avant l’installation', () => {
    const steps = installSteps({ directory: '', docker: true, envVarNames: [] }, FR);
    const commands = steps.map((step) => step.command);
    expect(commands).toContain('docker compose up -d');
    expect(commands.indexOf('docker compose up -d')).toBeLessThan(commands.indexOf('pnpm install'));
  });

  it('des variables d’environnement ajoutent la copie du gabarit, et les nomment', () => {
    const steps = installSteps(
      {
        directory: '',
        docker: false,
        envVarNames: ['DATABASE_URL', 'BETTER_AUTH_SECRET'],
      },
      FR,
    );
    const copy = steps.find((step) => step.command === 'cp .env.example .env');
    expect(copy).toBeDefined();
    expect(copy?.label).toContain('DATABASE_URL');
    expect(copy?.label).toContain('BETTER_AUTH_SECRET');
  });

  it('une seule variable dit « la variable », pas « les variables »', () => {
    const steps = installSteps({ directory: '', docker: false, envVarNames: ['DATABASE_URL'] }, FR);
    const copy = steps.find((step) => step.command === 'cp .env.example .env');
    expect(copy?.label).toContain('la variable');
  });

  it('tout cumulé : ordre cd, docker, env, install, dev', () => {
    const steps = installSteps(
      {
        directory: '/tmp/mon-projet',
        docker: true,
        envVarNames: ['DATABASE_URL'],
      },
      FR,
    );
    expect(steps.map((step) => step.command)).toEqual([
      'cd /tmp/mon-projet',
      'docker compose up -d',
      'cp .env.example .env',
      'pnpm install',
      'pnpm dev',
    ]);
  });
});

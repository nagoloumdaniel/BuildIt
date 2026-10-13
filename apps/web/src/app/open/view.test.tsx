import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LocalOpenController } from './local-open';
import type { InstallResultView, ProjectSummaryView } from './project';
import { OpenView } from './view';

/** L'écran 23, rendu sans DOM — le fil d'état est fourni à la main. */

const SUMMARY: ProjectSummaryView = {
  directory: 'C:\\projets\\mon-app',
  label: 'JavaScript / TypeScript',
  ecosystem: 'node',
  packageManager: 'pnpm',
  source: 'lockfile',
  evidence: 'pnpm-lock.yaml',
  origin: 'd’après pnpm-lock.yaml',
  warnings: [],
  plainCommand: 'pnpm install',
  safeCommand: 'pnpm install --ignore-scripts',
  description: 'JavaScript / TypeScript — pnpm (d’après pnpm-lock.yaml)',
};

const PYTHON: ProjectSummaryView = {
  directory: 'C:\\projets\\mon-app',
  label: 'Python',
  ecosystem: 'python',
  source: 'manifest',
  evidence: 'pyproject.toml',
  origin: 'd’après pyproject.toml',
  warnings: [],
  manualCommand: 'uv sync',
  description: 'Python (d’après pyproject.toml)',
};

const INSTALLED: InstallResultView = {
  ok: true,
  directory: 'C:\\projets\\mon-app',
  command: 'pnpm install --ignore-scripts',
  issues: [],
  retryable: false,
};

function controller(overrides: Partial<LocalOpenController> = {}): LocalOpenController {
  return {
    phase: 'idle',
    directory: '',
    inspection: null,
    installResult: null,
    ignoreScripts: false,
    confirmed: false,
    installing: false,
    notice: null,
    mode: 'native',
    runnable: true,
    pick: () => undefined,
    analyse: () => undefined,
    reanalyse: () => undefined,
    clear: () => undefined,
    setIgnoreScripts: () => undefined,
    setConfirmed: () => undefined,
    install: () => undefined,
    base: null,
    baseBusy: false,
    baseResult: null,
    applyBase: () => undefined,
    ...overrides,
  };
}

function render(overrides: Partial<LocalOpenController> = {}): string {
  return renderToStaticMarkup(createElement(OpenView, { controller: controller(overrides) }));
}

describe('OpenView — le dossier se choisit, il ne se tape pas (local)', () => {
  it('n’offre aucun champ de chemin et propose l’explorateur', () => {
    const html = render();

    expect(html).toContain('Choisir un dossier');
    expect(html).toContain('package.json');
    // Aucun champ de chemin, dans aucun mode : la carte entière est le geste.
    expect(html).not.toMatch(/<input/);
  });

  it('invite à choisir un dossier tant qu’il n’y en a aucun', () => {
    const html = render();

    expect(html).toContain('Aucun dossier choisi');
    expect(html).toContain('l’analyse démarre aussitôt');
  });

  it('en hébergé, l’explorateur est celui du navigateur — et le dit', () => {
    const html = render({ mode: 'browser', runnable: false });

    expect(html).toContain('lu dans votre navigateur');
    expect(html).not.toContain('saisissez le chemin');
  });

  it('ne promet pas d’explorateur quand le navigateur n’en a pas', () => {
    const html = render({ mode: 'none' });

    expect(html).toContain('Ce navigateur ne sait pas ouvrir de dossier');
    expect(html).toContain('disabled');
  });

  it('en hébergé, la commande se copie au lieu d’être lancée', () => {
    const html = render({
      phase: 'ready',
      directory: 'mon-app',
      mode: 'browser',
      runnable: false,
      inspection: { ok: true, value: SUMMARY },
    });

    expect(html).toContain('pnpm install');
    expect(html).toContain('À lancer dans votre terminal');
    expect(html).not.toContain('J’ai lu la commande');
    expect(html).not.toContain('Installer les dépendances');
  });
});

describe('OpenView — l’analyse', () => {
  it('affiche une barre d’avancement pendant la lecture du disque', () => {
    const html = render({ phase: 'inspecting', directory: 'C:\\projets\\mon-app' });

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('pf-bar-indeterminate');
    expect(html).toContain('Analyse du dossier…');
    expect(html).toContain('C:\\projets\\mon-app');
  });

  it('laisse une phrase calme après une annulation, sans erreur bloquante', () => {
    const html = render({ phase: 'cancelled', notice: 'Aucun dossier choisi.' });

    expect(html).toContain('Aucun dossier choisi.');
    expect(html).not.toContain('role="alert"');
  });
});

describe('OpenView — le projet reconnu', () => {
  it('montre l’écosystème, le gestionnaire et la commande exacte', () => {
    const html = render({
      phase: 'ready',
      directory: SUMMARY.directory,
      inspection: { ok: true, value: SUMMARY },
    });

    expect(html).toContain('JavaScript / TypeScript');
    expect(html).toContain('pnpm');
    expect(html).toContain('d’après pnpm-lock.yaml');
    expect(html).toContain('pnpm install');
    expect(html).toContain('J’ai lu la commande');
    expect(html).toContain('Analyser à nouveau');
  });

  it('grise « Installer » et dit pourquoi tant que rien n’est confirmé', () => {
    const html = render({
      phase: 'ready',
      directory: SUMMARY.directory,
      inspection: { ok: true, value: SUMMARY },
    });

    expect(html).toContain('disabled');
    expect(html).toContain('Cochez la confirmation');
  });

  it('suit le choix « sans exécuter les scripts »', () => {
    const html = render({
      phase: 'ready',
      directory: SUMMARY.directory,
      inspection: { ok: true, value: SUMMARY },
      ignoreScripts: true,
      confirmed: true,
    });

    expect(html).toContain('pnpm install --ignore-scripts');
    expect(html).not.toContain('Cochez la confirmation');
  });

  it('propose la commande manuelle pour un écosystème non automatisé', () => {
    const html = render({
      phase: 'ready',
      directory: PYTHON.directory,
      inspection: { ok: true, value: PYTHON },
    });

    expect(html).toContain('uv sync');
    expect(html).toContain('arrive en V1');
  });
});

describe('OpenView — le résultat de l’installation', () => {
  it('annonce la commande réellement lancée', () => {
    const html = render({
      phase: 'ready',
      directory: SUMMARY.directory,
      inspection: { ok: true, value: SUMMARY },
      installResult: INSTALLED,
      confirmed: true,
    });

    expect(html).toContain('Dépendances installées');
    expect(html).toContain('pnpm install --ignore-scripts');
  });

  it('rend l’échec tel quel, sous une forme actionnable', () => {
    const html = render({
      phase: 'ready',
      directory: SUMMARY.directory,
      inspection: { ok: true, value: SUMMARY },
      installResult: {
        ok: false,
        directory: SUMMARY.directory,
        command: 'pnpm install',
        issues: ['« pnpm install » a échoué.'],
        retryable: true,
      },
    });

    expect(html).toContain('L’installation a échoué');
    expect(html).toContain('« pnpm install » a échoué.');
    expect(html).toContain('Réessayer');
  });
});

describe('OpenView — le dossier non reconnu', () => {
  it('rend les refus du moteur et deux sorties : réessayer, revenir', () => {
    const html = render({
      phase: 'ready',
      directory: 'C:\\vide',
      inspection: { ok: false, issues: ['Aucun projet reconnu dans C:\\vide.'] },
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain('--pf-danger-line');
    expect(html).toContain('Aucun projet reconnu dans C:\\vide.');
    expect(html).toContain('manifeste reconnu');
    expect(html).toContain('Analyser à nouveau');
    expect(html).toContain('Accueil');
    expect(html).not.toContain('Installer les dépendances');
  });
});

describe('OpenView — tout navigateur, et les fichiers de base', () => {
  it('Firefox / Safari : la carte reste active, lecture par le sélecteur du navigateur', () => {
    const html = render({ mode: 'input', runnable: false });
    expect(html).toContain('lecture seule');
    expect(html).not.toMatch(/<button[^>]*class="pf-choice"[^>]*disabled/);
  });

  it('propose les fichiers de base manquants, en archive quand le navigateur ne peut pas écrire', () => {
    const html = render({
      phase: 'ready',
      directory: 'mon-app',
      mode: 'input',
      base: {
        shape: {
          name: 'mon-app',
          architecture: 'single-app',
          stack: { frontend: true, backend: false },
          source: 'inferred',
        },
        missing: [{ path: 'SECURITY.md', contents: '#' }],
        delivery: 'zip',
      },
    });
    expect(html).toContain('SECURITY.md');
    expect(html).toContain('Télécharger les fichiers manquants (.zip)');
    expect(html).toContain('déduite des fichiers');
  });
});

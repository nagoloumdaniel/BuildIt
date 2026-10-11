import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProjectInspectionView } from './project';
import { installBlocker, OpenView, type OpenViewProps, plannedCommand } from './view';

/** La vue de l'écran 23, rendue sans DOM. */

const INSPECTION: ProjectInspectionView = {
  ok: true,
  value: {
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
  },
};

const PYTHON: ProjectInspectionView = {
  ok: true,
  value: {
    directory: 'C:\\projets\\mon-app',
    label: 'Python',
    ecosystem: 'python',
    source: 'manifest',
    evidence: 'pyproject.toml',
    origin: 'd’après pyproject.toml',
    warnings: [],
    manualCommand: 'uv sync',
    description: 'Python (d’après pyproject.toml)',
  },
};

function render(overrides: Partial<OpenViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(OpenView, {
      directory: '',
      onDirectory: () => undefined,
      inspection: null,
      installResult: null,
      ignoreScripts: false,
      onIgnoreScripts: () => undefined,
      confirmed: false,
      onConfirmed: () => undefined,
      busy: false,
      onInspect: () => undefined,
      onInstall: () => undefined,
      ...overrides,
    }),
  );
}

describe('plannedCommand — la commande affichée est celle qui sera lancée', () => {
  it('suit le choix « sans scripts »', () => {
    expect(plannedCommand(INSPECTION, false)).toBe('pnpm install');
    expect(plannedCommand(INSPECTION, true)).toBe('pnpm install --ignore-scripts');
  });

  it('ne rend rien sans détection exploitable', () => {
    expect(plannedCommand(null, false)).toBeUndefined();
    expect(plannedCommand({ ok: false, issues: ['non'] }, false)).toBeUndefined();
  });
});

describe('installBlocker — rien ne se lance sans accord', () => {
  it('dit la raison, puis rien quand tout est réuni', () => {
    expect(installBlocker(null, false, false)).toContain('Analysez d’abord');
    expect(installBlocker({ ok: false, issues: ['non reconnu'] }, false, false)).toContain(
      'pas un projet reconnu',
    );
    expect(installBlocker(INSPECTION, false, false)).toContain('Cochez la confirmation');
    expect(installBlocker(INSPECTION, true, false)).toBeUndefined();
    expect(installBlocker(INSPECTION, true, true)).toContain('en cours');
  });

  it('refuse d’automatiser un écosystème non JavaScript', () => {
    expect(installBlocker(PYTHON, true, false)).toContain('V1');
  });
});

describe('OpenView — la détection', () => {
  it('affiche le dossier, l’origine et la commande exacte avant de lancer', () => {
    const html = render({ directory: 'C:\\projets\\mon-app', inspection: INSPECTION });

    expect(html).toContain('C:\\projets\\mon-app');
    expect(html).toContain('JavaScript / TypeScript');
    expect(html).toContain('pnpm');
    expect(html).toContain('d’après pnpm-lock.yaml');
    expect(html).toContain('pnpm install');
    expect(html).toContain('J’ai lu la commande');
  });

  it('grise « Installer » tant que la confirmation n’est pas cochée', () => {
    const html = render({ inspection: INSPECTION, confirmed: false });

    expect(html).toContain('disabled');
    expect(html).toContain('Cochez la confirmation');
  });

  it('affiche les avertissements du gestionnaire', () => {
    const html = render({
      inspection: {
        ok: true,
        value: {
          ...INSPECTION.value,
          warnings: ['Ni verrou ni champ packageManager : npm est une supposition.'],
        },
      },
    });

    expect(html).toContain('npm est une supposition');
  });

  it('dit ce qui bloque quand le dossier n’est pas un projet reconnu', () => {
    const html = render({
      inspection: { ok: false, issues: ['Aucun projet reconnu dans C:\\vide.'] },
    });

    expect(html).toContain('Aucun projet reconnu');
    expect(html).not.toContain('Installer les dépendances');
  });

  it('propose la commande manuelle pour un écosystème non automatisé', () => {
    const html = render({ inspection: PYTHON });

    expect(html).toContain('uv sync');
    expect(html).toContain('arrive en V1');
  });
});

describe('OpenView — le résultat', () => {
  it('annonce l’installation réussie avec la commande lancée', () => {
    const html = render({
      inspection: INSPECTION,
      installResult: {
        ok: true,
        directory: 'C:\\projets\\mon-app',
        command: 'pnpm install --ignore-scripts',
        issues: [],
        retryable: false,
      },
    });

    expect(html).toContain('Dépendances installées');
    expect(html).toContain('pnpm install --ignore-scripts');
  });

  it('rend l’échec tel quel', () => {
    const html = render({
      inspection: INSPECTION,
      installResult: {
        ok: false,
        directory: 'C:\\projets\\mon-app',
        command: 'pnpm install',
        issues: ['« pnpm install » a échoué.'],
        retryable: true,
      },
    });

    expect(html).toContain('a échoué');
  });
});

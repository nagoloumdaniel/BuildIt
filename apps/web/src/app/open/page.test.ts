import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../lib/i18n/messages';
import { blockerText, installBlocker, plannedCommand } from './install-panel';
import { pickOutcomePhase } from './local-open';
import OpenPage from './page';
import type { ProjectSummaryView } from './project';

/** Le contrat de l'écran 23, sans DOM : les décisions, puis le branchement. */

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
  ...SUMMARY,
  label: 'Python',
  ecosystem: 'python',
  source: 'manifest',
  evidence: 'pyproject.toml',
  origin: 'd’après pyproject.toml',
  description: 'Python (d’après pyproject.toml)',
  manualCommand: 'uv sync',
};

describe('plannedCommand — la commande affichée est celle qui sera lancée', () => {
  it('suit le choix « sans scripts »', () => {
    expect(plannedCommand(SUMMARY, false)).toBe('pnpm install');
    expect(plannedCommand(SUMMARY, true)).toBe('pnpm install --ignore-scripts');
  });

  it('ne rend rien sans détection exploitable', () => {
    expect(plannedCommand(null, false)).toBeUndefined();
  });
});

describe('installBlocker — rien ne se lance sans accord', () => {
  it('dit la raison, dans l’ordre de lecture, puis rien quand tout est réuni', () => {
    expect(installBlocker(null, false, false)).toBe('noInspection');
    expect(installBlocker(SUMMARY, false, false)).toBe('unconfirmed');
    expect(installBlocker(SUMMARY, true, false)).toBeUndefined();
    expect(installBlocker(SUMMARY, true, true)).toBe('busy');
  });

  it('refuse d’automatiser un écosystème non JavaScript', () => {
    expect(installBlocker(PYTHON, true, false)).toBe('manual');
  });

  it('rend la phrase française du blocage', () => {
    const t = MESSAGES.fr;

    expect(blockerText(t, 'noInspection')).toContain('Analysez d’abord');
    expect(blockerText(t, 'manual')).toContain('V1');
    expect(blockerText(t, 'unconfirmed')).toContain('Cochez la confirmation');
    expect(blockerText(t, 'busy')).toContain('en cours');
  });
});

describe('pickOutcomePhase — une annulation n’est pas une panne', () => {
  it('distingue le dossier choisi, l’annulation, l’absence de bureau et l’échec', () => {
    expect(pickOutcomePhase({ ok: true, path: 'C:\\projets\\mon-app' })).toBe('ready');
    expect(pickOutcomePhase({ ok: false, reason: 'cancelled' })).toBe('cancelled');
    expect(pickOutcomePhase({ ok: false, reason: 'unsupported' })).toBe('unavailable');
    expect(pickOutcomePhase({ ok: false, reason: 'failed' })).toBe('failed');
  });
});

describe('OpenPage — le branchement', () => {
  it('monte l’écran d’ouverture avec son titre et son retour', () => {
    const html = renderToStaticMarkup(createElement(OpenPage));

    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('Dossier du projet');
    expect(html).toContain('href="/"');
  });
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from '../lib/draft';
import type { StoredProject } from '../lib/projects';
import type { GenerationReport } from './create/report/result';
import { DashboardView, type DashboardViewProps, LocalOpenCard } from './dashboard-view';
import type { LocalOpenController } from './open/local-open';
import type { ProjectSummaryView } from './open/project';

/** Le tableau de bord, rendu sans DOM : le brouillon et les listes sont fournis. */

const SUCCESS: GenerationReport = {
  ok: true,
  directory: 'C:\\projets\\mon-projet',
  files: ['package.json'],
  bytes: 1024,
  warnings: [],
  steps: ['plan', 'write'],
  issues: [],
};

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'mon-app-1',
    name: 'mon-app',
    directory: 'C:\\projets\\mon-app',
    fileCount: 42,
    bytes: 1024,
    generatedAt: '2026-02-01T09:00:00.000Z',
    technologies: ['next'],
    ...overrides,
  };
}

const RECENT = project({ id: 'recent', name: 'recent-app' });
const OLDER = project({
  id: 'older',
  name: 'older-app',
  generatedAt: '2026-01-01T09:00:00.000Z',
});
const THIRD = project({
  id: 'third',
  name: 'third-app',
  generatedAt: '2025-12-01T09:00:00.000Z',
});

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
    canPick: true,
    pick: () => undefined,
    analyse: () => undefined,
    clear: () => undefined,
    setIgnoreScripts: () => undefined,
    setConfirmed: () => undefined,
    install: () => undefined,
    ...overrides,
  };
}

function render(
  draft: DraftState = freshDraft(),
  overrides: Partial<DashboardViewProps> = {},
): string {
  return renderToStaticMarkup(
    createElement(DashboardView, { draft, onReset: () => undefined, ...overrides }),
  );
}

function renderCard(overrides: Partial<LocalOpenController> = {}): string {
  return renderToStaticMarkup(createElement(LocalOpenCard, { controller: controller(overrides) }));
}

describe('Dashboard — le menu des chemins', () => {
  it('propose les trois chemins, dont l’ouverture locale', () => {
    const html = render(freshDraft(), { openLocal: controller() });

    expect(html).toContain('Créer un projet');
    expect(html).toContain('Cloner un projet');
    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/clone"');
    expect(html).toContain('href="/open"');
  });

  it('mène au compte GitHub et au dépôt', () => {
    const html = render(freshDraft(), { openLocal: controller() });

    expect(html).toContain('href="/github"');
    expect(html).toContain('href="/repo"');
  });
});

describe('Dashboard — les projets générés (§6.14)', () => {
  it('montre les deux plus récents, et le lien vers tous les projets', () => {
    const html = render(freshDraft(), { projects: [RECENT, OLDER, THIRD] });

    expect(html).toContain('recent-app');
    expect(html).toContain('older-app');
    expect(html).not.toContain('third-app');
    expect(html).toContain('Voir tous les projets');
    expect(html).toContain('href="/projects"');
  });

  it('dit qu’il lit la liste plutôt que d’annoncer qu’elle est vide', () => {
    const html = render(freshDraft(), { projects: null });

    expect(html).toContain('Lecture des projets enregistrés');
    expect(html).not.toContain('Aucun projet généré');
  });

  it('invite à créer un projet quand la liste est vide', () => {
    const html = render(freshDraft(), { projects: [] });

    expect(html).toContain('Aucun projet généré pour l’instant');
    expect(html).toContain('href="/create"');
  });
});

describe('Dashboard — un projet généré n’est jamais un brouillon', () => {
  it('ne propose ni Reprendre ni Repartir de zéro à l’écran rapport', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'report' };
    const html = render(draft, { report: SUCCESS });

    expect(html).toContain('mon-projet');
    expect(html).toContain('Terminé');
    expect(html).not.toContain('Reprendre');
    expect(html).not.toContain('Repartir de zéro');
  });

  it('garde le projet hors du brouillon même onglet rouvert (rapport disparu)', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'report' };
    const html = render(draft, { report: null });

    expect(html).not.toContain('Reprendre');
    expect(html).not.toContain('Repartir de zéro');
    expect(html).toContain('Rien à reprendre');
  });

  it('ne montre pas deux fois le projet déjà dans la liste', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-app', step: 'report' };
    const html = render(draft, {
      report: { ...SUCCESS, directory: RECENT.directory },
      projects: [RECENT],
    });

    expect(html).toContain('mon-app');
    expect(html).not.toContain('Voir le rapport & la doc d’installation');
  });

  it('garde « Reprendre » pour un brouillon encore en cours', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-app', step: 'stack' };
    const html = render(draft);

    expect(html).toContain('Reprendre');
    expect(html).toContain('href="/create/stack"');
    expect(html).toContain('stack technique');
    expect(html).toContain('Repartir de zéro');
  });

  it('ne repropose pas « Reprendre » après un retour dans le parcours', () => {
    // Le rail d'étapes reste cliquable depuis le rapport : redescendre corriger
    // un choix réécrit `draft.step`. Le projet, lui, est écrit et verrouillé —
    // la liste persistée le dit, et c'est elle qui fait foi.
    const draft: DraftState = { ...freshDraft(), name: RECENT.name, step: 'stack' };
    const html = render(draft, {
      report: { ...SUCCESS, directory: RECENT.directory },
      projects: [RECENT],
    });

    expect(html).not.toContain('Reprendre');
    expect(html).not.toContain('Repartir de zéro');
    expect(html).toContain('Rien à reprendre');
  });

  it('rend le brouillon à un nouveau projet une fois le précédent généré', () => {
    // Contre-épreuve : le rapport du projet précédent ne doit pas geler le
    // brouillon d'un projet **différent**.
    const draft: DraftState = { ...freshDraft(), name: 'autre-projet', step: 'stack' };
    const html = render(draft, {
      report: { ...SUCCESS, directory: RECENT.directory },
      projects: [RECENT],
    });

    expect(html).toContain('Reprendre');
    expect(html).toContain('href="/create/stack"');
  });

  it('ne propose rien à reprendre quand le brouillon est vierge', () => {
    const html = render(freshDraft());

    expect(html).toContain('Aucun brouillon en cours');
    expect(html).not.toContain('Reprendre');
  });
});

describe('LocalOpenCard — l’explorateur s’ouvre dans la carte', () => {
  it('appuie pour ouvrir l’explorateur, sans page intermédiaire', () => {
    const html = renderCard();

    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('Choisir un dossier');
    expect(html).toContain('Écran d’ouverture');
    expect(html).toContain('href="/open"');
    expect(html).toContain('<button');
  });

  it('affiche une barre d’avancement dans la carte pendant l’analyse', () => {
    const html = renderCard({ phase: 'inspecting', directory: 'C:\\projets\\mon-app' });

    expect(html).toContain('pf-card-progress');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('pf-bar-indeterminate');
    expect(html).toContain('Analyse du dossier…');
  });

  it('montre le projet reconnu, sa commande et les gestes qui suivent', () => {
    const html = renderCard({
      phase: 'ready',
      directory: SUMMARY.directory,
      inspection: { ok: true, value: SUMMARY },
    });

    expect(html).toContain('Projet reconnu');
    expect(html).toContain('JavaScript / TypeScript');
    expect(html).toContain('Gestionnaire');
    expect(html).toContain('pnpm install');
    expect(html).toContain('J’ai lu la commande');
  });

  it('reste calme après une annulation', () => {
    const html = renderCard({ phase: 'cancelled', notice: 'Aucun dossier choisi.' });

    expect(html).toContain('Aucun dossier choisi.');
    expect(html).not.toContain('role="alert"');
  });

  it('explique le repli en hébergé au lieu d’un bouton mort', () => {
    const html = renderCard({ canPick: false });

    expect(html).toContain('L’explorateur s’ouvrirait sur le serveur');
    expect(html).toContain('disabled');
  });
});

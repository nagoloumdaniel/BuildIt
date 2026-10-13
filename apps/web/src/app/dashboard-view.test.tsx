import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from '../lib/draft';
import type { StoredProject } from '../lib/projects';
import type { GenerationReport } from './create/report/result';
import { DashboardView, type DashboardViewProps, LocalOpenCard } from './dashboard-view';
import type { PickHandoff } from './open/pick-handoff';

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

function handoff(overrides: Partial<PickHandoff> = {}): PickHandoff {
  return { mode: 'native', busy: false, notice: null, start: () => undefined, ...overrides };
}

function render(
  draft: DraftState = freshDraft(),
  overrides: Partial<DashboardViewProps> = {},
): string {
  return renderToStaticMarkup(
    createElement(DashboardView, { draft, onReset: () => undefined, ...overrides }),
  );
}

function renderCard(overrides: Partial<PickHandoff> = {}): string {
  return renderToStaticMarkup(createElement(LocalOpenCard, { handoff: handoff(overrides) }));
}

describe('Dashboard — le menu des chemins', () => {
  it('propose les trois chemins, dont l’ouverture locale', () => {
    const html = render(freshDraft(), { openLocal: handoff() });

    expect(html).toContain('Créer un projet');
    expect(html).toContain('Cloner un projet');
    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('href="/create?new=1"');
    expect(html).toContain('href="/clone"');
    // L'ouverture locale n'est pas un lien : la carte entière est le bouton
    // qui ouvre l'explorateur, et c'est le dossier choisi qui mène à /open.
    expect(html).toContain('<button');
  });

  it('mène au compte GitHub et au dépôt', () => {
    const html = render(freshDraft(), { openLocal: handoff() });

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
    expect(html).toContain('href="/create?new=1"');
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

describe('LocalOpenCard — la carte est le bouton', () => {
  it('ouvre l’explorateur sans bouton ni lien à viser dans la carte', () => {
    const html = renderCard();

    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('<button');
    // Les deux cibles d'avant ont disparu : plus de « Choisir un dossier »
    // dans la carte, plus de lien vers l'écran d'ouverture.
    expect(html).not.toContain('Choisir un dossier');
    expect(html).not.toContain('Écran d’ouverture');
    expect(html).not.toContain('href="/open"');
  });

  it('dit que l’explorateur est ouvert pendant qu’on attend le dossier', () => {
    const html = renderCard({ busy: true });

    expect(html).toContain('pf-spinner');
    expect(html).toContain('sur le bureau de cette machine');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('disabled');
  });

  it('reste muette après une annulation : pas de « Aucun dossier choisi. »', () => {
    const html = renderCard({ notice: 'Aucun dossier choisi.' });

    expect(html).not.toContain('Aucun dossier choisi.');
    expect(html).not.toContain('role="alert"');
  });

  it('affiche les autres retours de l’explorateur', () => {
    expect(renderCard({ notice: 'Échec.' })).toContain('Échec.');
  });

  it('grise la carte quand aucun explorateur ne peut s’ouvrir', () => {
    const html = renderCard({ mode: 'none' });

    expect(html).toContain('disabled');
  });
});

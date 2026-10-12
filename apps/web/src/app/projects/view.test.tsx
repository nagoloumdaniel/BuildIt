import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StoredProject } from '../../lib/projects';
import { newestFirst, ProjectsView, type ProjectsViewProps } from './view';

/** L'écran « Tous les projets », rendu sans DOM. */

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'mon-app-1',
    name: 'mon-app',
    directory: 'C:\\projets\\mon-app',
    fileCount: 42,
    bytes: 1024,
    generatedAt: '2026-01-05T10:00:00.000Z',
    technologies: ['next'],
    ...overrides,
  };
}

const RECENT = project({
  id: 'recent-2',
  name: 'recent-app',
  generatedAt: '2026-02-01T09:00:00.000Z',
});
const OLD = project({
  id: 'old-1',
  name: 'old-app',
  generatedAt: '2026-01-01T09:00:00.000Z',
});

function render(overrides: Partial<ProjectsViewProps> = {}): string {
  return renderToStaticMarkup(createElement(ProjectsView, { projects: [], ...overrides }));
}

describe('newestFirst — du plus récent au plus ancien', () => {
  it('trie par date décroissante sans muter l’entrée', () => {
    const input = [OLD, RECENT];
    const ordered = newestFirst(input);

    expect(ordered.map((item) => item.name)).toEqual(['recent-app', 'old-app']);
    expect(input.map((item) => item.name)).toEqual(['old-app', 'recent-app']);
  });

  it('ne laisse pas une date illisible passer devant', () => {
    const broken = project({ id: 'broken', name: 'broken-app', generatedAt: 'pas-une-date' });
    const ordered = newestFirst([broken, OLD]);

    expect(ordered.map((item) => item.name)).toEqual(['old-app', 'broken-app']);
  });
});

describe('ProjectsView — la liste', () => {
  it('montre tous les projets, du plus récent au plus ancien', () => {
    const html = render({ projects: [OLD, RECENT] });

    expect(html).toContain('recent-app');
    expect(html).toContain('old-app');
    expect(html.indexOf('recent-app')).toBeLessThan(html.indexOf('old-app'));
  });

  it('porte le retour à l’accueil et l’oubli unitaire', () => {
    const html = render({
      projects: [RECENT],
      onForget: () => undefined,
      onForgetAll: () => undefined,
    });

    expect(html).toContain('href="/"');
    expect(html).toContain('Retirer de la liste');
    expect(html).toContain('Vider la liste');
    expect(html).toContain('ne supprime aucun fichier sur le disque');
  });

  it('n’oublie jamais un projet sans le geste : pas de bouton sans rappel', () => {
    const html = render({ projects: [RECENT] });

    expect(html).not.toContain('Retirer de la liste');
  });

  it('propose l’export et l’architecture aux projets dont les choix sont gardés', () => {
    const manifest = {
      manifestVersion: 1,
      name: 'recent-app',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript' },
    } as const;
    const html = render({
      projects: [{ ...RECENT, manifest } as never, OLD],
      onExported: () => undefined,
    });

    expect(html.match(/Télécharger le ZIP ou installer/g)).toHaveLength(1);
    expect(html).toContain(`href="/projects/architecture?id=${RECENT.id}"`);
    // Un projet d'avant la version 0.2.0 dit pourquoi il ne peut rien refaire.
    expect(html).toContain('Généré avant la version 0.2.0');
  });

  it('ouvre le dépôt GitHub seulement quand son adresse est connue', () => {
    const html = render({
      projects: [{ ...RECENT, repositoryUrl: 'https://github.com/octocat/recent-app' }, OLD],
    });

    expect(html).toContain('href="https://github.com/octocat/recent-app"');
    expect(html.match(/Ouvrir sur GitHub/g)).toHaveLength(1);
    expect(html.match(/Connecter à GitHub/g)).toHaveLength(1);
  });
});

describe('ProjectsView — vider la liste demande une confirmation', () => {
  it('propose de vider, sans rien effacer au premier clic', () => {
    const html = render({ projects: [RECENT], onForgetAll: () => undefined });

    expect(html).toContain('Vider la liste');
    expect(html).not.toContain('Vider la liste ?');
  });

  it('demande confirmation, avec les deux issues', () => {
    const html = render({
      projects: [RECENT],
      onForgetAll: () => undefined,
      confirmingClear: true,
      onConfirmingClear: () => undefined,
    });

    expect(html).toContain('Vider la liste ?');
    expect(html).toContain('restent sur le disque');
    expect(html).toContain('Oui, vider la liste');
    expect(html).toContain('Annuler');
    expect(html).toContain('role="alert"');
  });
});

describe('ProjectsView — les états sans projet', () => {
  it('dit qu’il lit la liste plutôt que d’annoncer qu’elle est vide', () => {
    const html = render({ projects: null });

    expect(html).toContain('Lecture des projets enregistrés');
    expect(html).not.toContain('Aucun projet généré');
  });

  it('invite à créer un premier projet quand il n’y en a aucun', () => {
    const html = render({ projects: [] });

    expect(html).toContain('Aucun projet généré pour l’instant');
    expect(html).toContain('Créer un premier projet');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/"');
  });
});

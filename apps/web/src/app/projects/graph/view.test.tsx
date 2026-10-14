import type { Manifest } from '@buildit/manifest';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StoredProject } from '../../../lib/projects';
import type { ProjectLookup } from '../architecture/view';
import { ProjectGraphScreen } from './view';

/**
 * Le graphe de dépendances d'un projet déjà généré, rendu sans DOM.
 *
 * La recherche du projet (`?id=`) est celle de `/projects/architecture` et y
 * est testée : ici, ce sont les quatre formes de l'écran qui sont prouvées,
 * dont le calcul lancé pour un projet dont le manifest est conservé.
 */

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'mon-app',
  targets: ['api'],
  architecture: 'single-app',
  backend: { framework: 'hono', language: 'typescript' },
};

function project(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'mon-app-1',
    name: 'mon-app',
    directory: 'C:\\projets\\mon-app',
    fileCount: 12,
    bytes: 1024,
    generatedAt: '2026-01-05T10:00:00.000Z',
    technologies: ['hono'],
    ...overrides,
  };
}

function render(lookup: ProjectLookup | null): string {
  return renderToStaticMarkup(<ProjectGraphScreen lookup={lookup} />);
}

describe('ProjectGraphScreen', () => {
  it('lit le stockage avant de conclure, avec un retour vers les projets', () => {
    const html = render(null);
    expect(html).toContain('Graphe de dépendances');
    expect(html).toContain('Lecture du projet dans ce navigateur');
    expect(html).toContain('href="/projects"');
    expect(html).toContain('Tous les projets');
  });

  it('un projet introuvable le dit et ramène à la liste', () => {
    const html = render({ kind: 'unknown' });
    expect(html).toContain('Projet introuvable');
    expect(html).toContain('Retour aux projets');
    expect(html).toContain('href="/projects"');
  });

  it('un projet sans manifest explique pourquoi son graphe ne peut pas être recalculé', () => {
    const html = render({ kind: 'legacy', project: project() });
    expect(html).toContain('Le graphe n’a pas pu être calculé');
    expect(html).toContain('ne peut pas recalculer son graphe');
    expect(html).toContain('Retour aux projets');
  });

  it('un projet avec manifest lance le calcul de son graphe', () => {
    const html = render({ kind: 'ready', project: project(), manifest: MANIFEST });
    expect(html).toContain('Graphe de dépendances');
    // Le calcul part d'un vrai manifest : l'attente est celle du moteur.
    expect(html).toContain('Calcul du graphe');
    expect(html).toContain('Tous les projets');
  });
});

import type { Manifest } from '@buildit/manifest';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StoredProject } from '../../../lib/projects';
import { lookupProject, ProjectArchitectureScreen, type ProjectLookup } from './view';

/** L'architecture d'un projet déjà généré, rendue sans DOM. */

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
  return renderToStaticMarkup(<ProjectArchitectureScreen lookup={lookup} />);
}

describe('lookupProject : le projet désigné par ?id=', () => {
  const withManifest = project({ manifest: MANIFEST });
  const legacy = project({ id: 'ancien-1', name: 'ancien' });

  it('un projet avec son manifest est prêt', () => {
    expect(lookupProject([legacy, withManifest], 'mon-app-1')).toEqual({
      kind: 'ready',
      project: withManifest,
      manifest: MANIFEST,
    });
  });

  it('un projet sans manifest conservé est un projet d’avant cette version', () => {
    expect(lookupProject([legacy], 'ancien-1')).toEqual({ kind: 'legacy', project: legacy });
  });

  it('un identifiant inconnu, ou absent, ne désigne rien', () => {
    expect(lookupProject([legacy], 'autre')).toEqual({ kind: 'unknown' });
    expect(lookupProject([legacy], null)).toEqual({ kind: 'unknown' });
  });
});

describe('ProjectArchitectureScreen', () => {
  it('lit le stockage avant de conclure, avec un retour vers les projets', () => {
    const html = render(null);
    expect(html).toContain('Lecture du projet dans ce navigateur');
    expect(html).toContain('href="/projects"');
    expect(html).toContain('Tous les projets');
  });

  it('un projet introuvable le dit et ramène à la liste', () => {
    const html = render({ kind: 'unknown' });
    expect(html).toContain('Projet introuvable');
    expect(html).toContain('Retour aux projets');
  });

  it('un projet sans manifest explique pourquoi rien ne peut être montré', () => {
    const html = render({ kind: 'legacy', project: project() });
    expect(html).toContain('Architecture de mon-app');
    expect(html).toContain('Architecture indisponible pour ce projet');
    expect(html).toContain('Retour aux projets');
  });

  it('un projet avec manifest lance le calcul de son architecture', () => {
    const html = render({ kind: 'ready', project: project(), manifest: MANIFEST });
    expect(html).toContain('Architecture de mon-app');
    expect(html).toContain('Calcul de l’architecture par le moteur');
  });
});

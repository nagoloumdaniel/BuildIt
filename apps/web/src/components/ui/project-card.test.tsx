import type { Manifest } from '@buildit/manifest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FR, type Messages } from '../../lib/i18n/messages';
import type { StoredProject } from '../../lib/projects';
import {
  ProjectCard,
  type ProjectCardProps,
  projectDeletePlan,
  projectDeleteTargets,
} from './project-card';

/**
 * La carte d'un projet, rendue **sans DOM**.
 *
 * Ce fichier couvre les deux décisions que la carte prend à partir du projet,
 * et qui se sont déjà trompées une fois :
 *
 * 1. **où le projet existe vraiment** un projet téléchargé en ZIP n'a pas de
 *    dossier local, un projet jamais poussé n'a pas de dépôt. Les cibles
 *    proposées et le geste « ouvrir l'explorateur » en découlent ;
 * 2. **ce qui part quand on confirme** un plan pur, et un détachement du dépôt
 *    qui a lieu même quand GitHub répond « déjà supprimé » (`gone`).
 *
 * L'ouverture de la popup et le clic sur « Supprimer la sélection » demandent un
 * document : ils se prouvent dans un vrai navigateur (`pnpm test:e2e`), pas ici.
 */

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'mon-app',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript' },
};

const REPOSITORY = 'https://github.com/octocat/mon-app';

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

function render(overrides: Partial<ProjectCardProps> = {}): string {
  return renderToStaticMarkup(createElement(ProjectCard, { project: project(), ...overrides }));
}

describe('projectDeleteTargets n’offre que là où le projet est présent', () => {
  it('propose les trois plateformes pour un projet écrit et poussé', () => {
    const targets = projectDeleteTargets(project({ repositoryUrl: REPOSITORY }), FR);

    expect(targets.map((target) => target.id)).toEqual(['site', 'github', 'local']);
    for (const target of targets) {
      // Chaque cible dit ce qu'elle supprime **et** ce que ça coûte : une case
      // sans conséquence écrite est une case qu'on coche par erreur.
      expect(target.label).not.toBe('');
      expect(target.note).not.toBe('');
    }
  });

  it('ne propose pas de dossier local pour un projet téléchargé en ZIP', () => {
    const targets = projectDeleteTargets(project({ directory: '', repositoryUrl: REPOSITORY }), FR);

    expect(targets.map((target) => target.id)).toEqual(['site', 'github']);
    expect(targets.some((target) => target.id === 'local')).toBe(false);
  });

  it('ne propose pas de dépôt GitHub quand il n’y en a pas', () => {
    expect(projectDeleteTargets(project(), FR).map((target) => target.id)).toEqual([
      'site',
      'local',
    ]);
    expect(projectDeleteTargets(project({ directory: '' }), FR).map((target) => target.id)).toEqual(
      ['site'],
    );
  });

  it('garde le site même sans dossier ni dépôt : c’est la seule cible que BuildIt possède', () => {
    expect(projectDeleteTargets(project({ directory: '' }), FR)).toEqual([
      expect.objectContaining({ id: 'site' }),
    ]);
  });
});

describe('projectDeletePlan exécute ce qui a été coché', () => {
  it('déroule le site, le dépôt puis le dossier dans cet ordre', () => {
    const plan = projectDeletePlan(project({ repositoryUrl: REPOSITORY }), [
      'site',
      'github',
      'local',
    ]);

    expect(plan).toEqual([
      { kind: 'site' },
      { kind: 'repository', url: REPOSITORY, id: 'mon-app-1' },
      { kind: 'local', directory: 'C:\\projets\\mon-app' },
    ]);
  });

  it('ne garde que les cibles cochées', () => {
    const stored = project({ repositoryUrl: REPOSITORY });

    expect(projectDeletePlan(stored, ['site'])).toEqual([{ kind: 'site' }]);
    expect(projectDeletePlan(stored, ['local'])).toEqual([
      { kind: 'local', directory: stored.directory },
    ]);
    expect(projectDeletePlan(stored, [])).toEqual([]);
  });

  it('ignore une cible cochée dont la donnée manque', () => {
    // Les cases sont cochées à l'ouverture de la popup : entre-temps, le projet
    // a pu être détaché ou le dossier oublié. L'action ne part pas sur du vide.
    expect(projectDeletePlan(project({ directory: '' }), ['github', 'local'])).toEqual([]);
    expect(projectDeletePlan(project(), ['github'])).toEqual([]);
  });

  it('attache le détachement au projet visé, une seule fois', () => {
    const plan = projectDeletePlan(project({ id: 'autre', repositoryUrl: REPOSITORY }), ['github']);

    expect(plan).toEqual([{ kind: 'repository', url: REPOSITORY, id: 'autre' }]);
    expect(plan.filter((step) => step.kind === 'repository')).toHaveLength(1);
  });
});

describe('ProjectCard les gestes de la carte', () => {
  it('n’affiche plus le badge « Terminé » ni la croix de retrait', () => {
    const html = render({ onExported: () => undefined });

    expect(html).not.toContain('pf-badge-ok');
    expect(html).not.toContain('Terminé');
    expect(html).not.toContain('Retirer de la liste');
    expect(html).not.toContain('data-icon="close"');
  });

  it('porte une poubelle rouge, seule et nommée', () => {
    const html = render();
    const trash = html.match(/<button[^>]*aria-label="Supprimer…"[^>]*>[\s\S]*?<\/button>/g) ?? [];

    expect(trash).toHaveLength(1);
    expect(trash[0]).toContain('pf-btn-danger');
    expect(trash[0]).toContain('pf-btn-icon');
    expect(trash[0]).toContain('title="Supprimer…"');
  });

  it('ouvre l’explorateur seulement quand un dossier a réellement été écrit', () => {
    const written = render();

    expect(written).toContain('title="Ouvrir dans l’explorateur"');
    expect(written).toContain(
      `aria-label="Ouvrir dans l’explorateur de fichiers : C:\\projets\\mon-app"`,
    );

    expect(render({ project: project({ directory: '' }) })).not.toContain(
      'Ouvrir dans l’explorateur',
    );
  });

  it('dit qu’un projet sans dépôt n’en a plus, sans casser la carte', () => {
    const html = render();

    expect(html).toContain('Aucune adresse de dépôt');
    expect(html).toContain('Connecter à GitHub');
    expect(html).toContain('Supprimer…');
  });

  it('explique qu’une archive n’a pas de copie locale à pousser', () => {
    const html = render({ project: project({ directory: '' }) });

    expect(html).toContain('il n’y a pas de copie locale à pousser');
    // Sans dossier, rien à pousser : on ne propose pas « Connecter à GitHub ».
    expect(html).not.toContain('Connecter à GitHub');
  });

  it('ne montre jamais la popup avant qu’on la demande', () => {
    // `<dialog>` doit être monté pour que `showModal()` fonctionne : la carte ne
    // le monte donc qu'au clic. Un rendu statique ne doit rien ouvrir.
    expect(render()).not.toContain('<dialog');
    expect(render()).not.toContain('Supprimer la sélection');
  });

  it('n’offre l’export qu’à un projet dont les choix sont gardés', () => {
    const withManifest = render({
      onExported: () => undefined,
      project: project({ manifest: MANIFEST }),
    });

    expect(withManifest).toContain('Télécharger le ZIP ou installer');
    // Sans manifest, le panneau d'export n'aurait rien à réécrire.
    expect(render({ onExported: () => undefined })).not.toContain(
      'Télécharger le ZIP ou installer',
    );
  });
});

describe('projectDeleteTargets parle la langue du dictionnaire fourni', () => {
  it('rend les libellés anglais quand on lui donne l’anglais', () => {
    // Le garde-fou de la traduction : la fonction ne connaît que le
    // dictionnaire reçu, jamais une phrase française en dur.
    const pseudo = {
      projects: {
        ...FR.projects,
        deleteTargetSite: 'SITE-LABEL',
        deleteTargetLocal: 'LOCAL-LABEL',
      },
    } as unknown as Messages;

    const targets = projectDeleteTargets(project(), pseudo);

    expect(targets.map((target) => target.label)).toEqual(['SITE-LABEL', 'LOCAL-LABEL']);
  });
});

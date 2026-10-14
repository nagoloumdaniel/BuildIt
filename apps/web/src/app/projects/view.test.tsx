import type { Manifest } from '@buildit/manifest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { projectShareLink } from '../../components/ui/project-card';
import type { StoredProject } from '../../lib/projects';
import { newestFirst, ProjectsView, type ProjectsViewProps } from './view';

/** L'écran « Tous les projets », rendu sans DOM. */

/** Un manifest gardé : c'est lui qui ouvre l'architecture, le graphe, le partage. */
const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'recent-app',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript' },
};

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

describe('newestFirst du plus récent au plus ancien', () => {
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

describe('ProjectsView la liste', () => {
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
    const html = render({
      projects: [{ ...RECENT, manifest: MANIFEST }, OLD],
      onExported: () => undefined,
    });

    expect(html.match(/Télécharger le ZIP ou installer/g)).toHaveLength(1);
    expect(html).toContain(`href="/projects/architecture?id=${RECENT.id}"`);
    // Un projet d'avant la version 0.2.0 n'a ni export ni architecture : la
    // carte compacte ne le dit plus, elle ne propose simplement rien à refaire.
    expect(html).not.toContain(`href="/projects/architecture?id=${OLD.id}"`);
  });

  it('mène au graphe de dépendances du projet, et seulement si ses choix sont gardés', () => {
    const html = render({
      projects: [{ ...RECENT, manifest: MANIFEST }, OLD],
    });

    expect(html).toContain(`href="/projects/graph?id=${RECENT.id}"`);
    expect(html).toContain('aria-label="Graphe de dépendances"');
    expect(html).toContain('title="Graphe de dépendances"');
    // Sans manifest gardé, il n'y a pas de technologies à dessiner.
    expect(html).not.toContain(`href="/projects/graph?id=${OLD.id}"`);
  });

  it('donne un nom accessible et une infobulle aux quatre gestes en icône seule', () => {
    const html = render({
      projects: [
        {
          ...RECENT,
          manifest: MANIFEST,
          repositoryUrl: 'https://github.com/octocat/recent-app',
        },
      ],
    });

    // Les quatre gestes courts n'ont plus de libellé visible : sans `aria-label`
    // ils seraient muets pour un lecteur d'écran, sans `title` ils le seraient
    // à la souris.
    for (const name of [
      'Copier le lien GitHub',
      'Copier le lien de partage',
      'Architecture du projet',
      'Graphe de dépendances',
    ]) {
      expect(html).toContain(`aria-label="${name}"`);
      expect(html).toContain(`title="${name}"`);
    }
    // Le libellé long ne traîne plus dans la rangée dense.
    expect(html).not.toContain('>Architecture du projet<');

    // Contrôle générique : **aucune** icône seule de la carte n'est muette.
    const iconOnly = html.match(/<(?:a|button)[^>]*pf-btn-icon[^>]*>/g) ?? [];
    expect(iconOnly).toHaveLength(4);
    for (const tag of iconOnly) {
      expect(tag).toMatch(/aria-label="[^"]+"/);
      expect(tag).toMatch(/title="[^"]+"/);
    }
  });

  it('n’invente pas de route sans identifiant de projet', () => {
    // Un projet d'avant la version 0.2.0 n'a pas de manifest : aucun des deux
    // liens ne doit apparaître avec un `id` vide.
    const html = render({ projects: [OLD] });

    expect(html).not.toContain('href="/projects/graph?id="');
    expect(html).not.toContain('href="/projects/architecture?id="');
  });

  it('ouvre le dépôt GitHub seulement quand son adresse est connue', () => {
    const html = render({
      projects: [{ ...RECENT, repositoryUrl: 'https://github.com/octocat/recent-app' }, OLD],
    });

    expect(html).toContain('href="https://github.com/octocat/recent-app"');
    expect(html.match(/Ouvrir sur GitHub/g)).toHaveLength(1);
    expect(html.match(/Connecter à GitHub/g)).toHaveLength(1);
  });

  it('affiche la liste en deux colonnes sur grand écran', () => {
    const html = render({ projects: [RECENT, OLD] });

    expect(html).toContain('md:grid-cols-2');
  });

  it('copie le lien GitHub depuis la carte quand l’adresse est connue', () => {
    const html = render({
      projects: [{ ...RECENT, repositoryUrl: 'https://github.com/octocat/recent-app' }],
    });

    expect(html).toContain('aria-label="Copier le lien GitHub"');
    expect(html).toContain('title="Copier le lien GitHub"');
  });

  it('propose de copier le lien de partage dès que le manifest est gardé', () => {
    const html = render({ projects: [{ ...RECENT, manifest: MANIFEST }] });

    expect(html).toContain('aria-label="Copier le lien de partage"');
    expect(html).toContain('title="Copier le lien de partage"');
  });
});

/**
 * La copie du lien de partage de la carte.
 *
 * Le geste vit dans un bouton ; ce qu'il copie, lui, se **calcule**. C'est donc
 * ce calcul qui se prouve ici, sans DOM. Ce qui compte est l'origine, et elle
 * était fausse : la carte encodait avec `window.location.origin`, donc un lien
 * ouvert depuis `127.0.0.1` ne s'ouvrait que sur cette machine.
 */
describe('ProjectsView le lien de partage emploie l’origine publique', () => {
  afterEach(() => {
    delete process.env['PF_SHARE_BASE_URL'];
  });

  it('préfère l’origine publique du serveur à la boucle locale du navigateur', async () => {
    process.env['PF_SHARE_BASE_URL'] = 'https://exemple.fr';

    const link = await projectShareLink(MANIFEST, 'http://127.0.0.1:4173');

    expect(link.startsWith('https://exemple.fr/share#')).toBe(true);
    expect(link).not.toContain('127.0.0.1');
  });

  it('garde l’origine du navigateur quand le serveur n’en propose pas', async () => {
    const link = await projectShareLink(MANIFEST, 'https://trybuildit.vercel.app');

    expect(link.startsWith('https://trybuildit.vercel.app/share#')).toBe(true);
  });
});

describe('ProjectsView vider la liste demande une confirmation', () => {
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

describe('ProjectsView les états sans projet', () => {
  it('dit qu’il lit la liste plutôt que d’annoncer qu’elle est vide', () => {
    const html = render({ projects: null });

    expect(html).toContain('Lecture des projets enregistrés');
    expect(html).not.toContain('Aucun projet généré');
  });

  it('invite à créer un premier projet quand il n’y en a aucun', () => {
    const html = render({ projects: [] });

    expect(html).toContain('Aucun projet généré pour l’instant');
    expect(html).toContain('Créer un premier projet');
    expect(html).toContain('href="/create?new=1"');
    expect(html).toContain('href="/"');
  });
});

import type { Manifest } from '@buildit/manifest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { projectDeleteTargets, projectShareLink } from '../../components/ui/project-card';
import { FR } from '../../lib/i18n/messages';
import { detachRepository, PROJECTS_STORAGE_KEY, type StoredProject } from '../../lib/projects';
import {
  clearTargets,
  directories,
  newestFirst,
  ProjectsView,
  type ProjectsViewProps,
  repositoryUrls,
} from './view';

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

  it('supprime depuis la carte : une poubelle rouge, plus de croix', () => {
    const html = render({ projects: [RECENT] });

    // Les deux gestes d'avant ont disparu : « Retirer de la liste » et le
    // libellé de suppression étaient deux boutons pour un seul besoin.
    expect(html).not.toContain('Retirer de la liste');
    expect(html).not.toContain('Supprimer du disque');
    expect(html).not.toContain('data-icon="close"');
    // La poubelle reste, en icône, rouge, et nommée pour le lecteur d'écran.
    const trash = html.match(/<button[^>]*aria-label="Supprimer…"[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(trash).toHaveLength(1);
    expect(trash[0]).toContain('pf-btn-danger');
    expect(trash[0]).toContain('pf-btn-icon');
    expect(trash[0]).toContain('title="Supprimer…"');
    expect(trash[0]).toContain('data-icon="trash"');
  });

  it('n’affiche ni badge « Terminé » ni croix de retrait sur une carte', () => {
    const html = render({ projects: [{ ...RECENT, manifest: MANIFEST }] });

    expect(html).not.toContain('Terminé');
    expect(html).not.toContain('data-icon="close"');
  });

  it('n’ouvre l’explorateur que pour un projet réellement écrit sur le disque', () => {
    const written = render({ projects: [RECENT] });

    expect(written).toContain('title="Ouvrir dans l’explorateur"');
    expect(written).toContain(
      `aria-label="Ouvrir dans l’explorateur de fichiers : ${RECENT.directory}"`,
    );

    // Un projet téléchargé en ZIP n'a jamais eu de dossier ici : le geste
    // n'apparaît pas plutôt que d'échouer après le clic.
    const zipped = render({ projects: [{ ...RECENT, directory: '' }] });

    expect(zipped).not.toContain('Ouvrir dans l’explorateur');
    expect(zipped).not.toContain('data-icon="folderOpen"');
  });

  it('ne propose que les cibles où le projet est réellement présent', () => {
    const url = 'https://github.com/octocat/recent-app';

    // Écrit sur le disque et poussé : les trois endroits existent.
    expect(projectDeleteTargets({ ...RECENT, repositoryUrl: url }, FR).map((t) => t.id)).toEqual([
      'site',
      'github',
      'local',
    ]);
    // Écrit, jamais poussé : pas de dépôt, donc pas de cible GitHub.
    expect(projectDeleteTargets(RECENT, FR).map((t) => t.id)).toEqual(['site', 'local']);
    // Téléchargé en ZIP : pas de dossier local, jamais.
    expect(projectDeleteTargets({ ...RECENT, directory: '', repositoryUrl: url }, FR)).toEqual([
      expect.objectContaining({ id: 'site' }),
      expect.objectContaining({ id: 'github' }),
    ]);
    // Le site reste toujours offert : c'est la seule cible que BuildIt possède.
    expect(projectDeleteTargets({ ...RECENT, directory: '' }, FR)).toEqual([
      expect.objectContaining({ id: 'site' }),
    ]);
  });

  it('dit qu’un projet détaché n’a plus de dépôt au lieu de se taire', () => {
    // Un projet détaché n'a plus de clé `repositoryUrl` du tout : la fabriquer à
    // `undefined` est refusé par `exactOptionalPropertyTypes`, et c'est ce que
    // fait `detachRepository` en vrai.
    const { repositoryUrl: _detached, ...withoutRepository } = RECENT;
    const html = render({ projects: [withoutRepository] });

    expect(html).toContain('Aucune adresse de dépôt n’est enregistrée pour ce projet');
    expect(html).toContain('Connecter à GitHub');
    // Avec un dépôt, la phrase n'a plus lieu d'être.
    expect(
      render({ projects: [{ ...RECENT, repositoryUrl: 'https://github.com/octocat/recent-app' }] }),
    ).not.toContain('Aucune adresse de dépôt n’est enregistrée');
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
    // à la souris. Le cinquième est l'explorateur, qui n'existe que parce que
    // ce projet a un dossier.
    for (const name of [
      'Copier le lien GitHub',
      'Copier le lien de partage',
      'Architecture du projet',
      'Graphe de dépendances',
      `Ouvrir dans l’explorateur de fichiers : ${RECENT.directory}`,
    ]) {
      expect(html).toContain(`aria-label="${name}"`);
    }
    for (const name of [
      'Copier le lien GitHub',
      'Copier le lien de partage',
      'Architecture du projet',
      'Graphe de dépendances',
      'Ouvrir dans l’explorateur',
    ]) {
      expect(html).toContain(`title="${name}"`);
    }
    // Le libellé long ne traîne plus dans la rangée dense.
    expect(html).not.toContain('>Architecture du projet<');

    // Contrôle générique : **aucune** icône seule de la page n'est muette —
    // les cinq de la carte, plus le vidage de la liste dans l'en-tête.
    const iconOnly = html.match(/<(?:a|button)[^>]*pf-btn-icon[^>]*>/g) ?? [];
    expect(iconOnly).toHaveLength(6);
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

describe('ProjectsView vider la liste', () => {
  it('pose le bouton à droite du titre, avec un libellé qui s’efface en petit écran', () => {
    const html = render({ projects: [RECENT] });

    expect(html).toContain('Vider la liste');
    // En petit écran, seule l'icône reste : le nom accessible est alors le seul
    // libellé, et il doit être là même quand le texte est masqué.
    expect(html).toContain('aria-label="Vider la liste"');
    expect(html).toContain('<span class="hidden sm:inline">Vider la liste</span>');
    // Le bouton vit dans les actions de l'en-tête, pas au pied de la liste.
    expect(html).toContain('pf-page-head-actions');
    // Aucune cible à proposer sur une liste vide : le bouton disparaît.
    expect(render({ projects: [] })).not.toContain('aria-label="Vider la liste"');
  });

  it('n’offre que les plateformes réellement présentes dans la liste', () => {
    const withRepository = {
      ...RECENT,
      repositoryUrl: 'https://github.com/octocat/recent-app',
    };
    const zip = { ...OLD, directory: '' };

    expect(clearTargets([withRepository], FR).map((target) => target.id)).toEqual([
      'site',
      'github',
      'local',
    ]);
    // Un projet téléchargé en ZIP : pas de dossier local. Sans dépôt : pas de
    // GitHub. Vider une liste ne doit pas proposer ce qui n'existe pas.
    expect(clearTargets([zip], FR).map((target) => target.id)).toEqual(['site']);
    expect(clearTargets([RECENT], FR).map((target) => target.id)).toEqual(['site', 'local']);
    expect(clearTargets([], FR)).toHaveLength(0);
  });

  it('déduit les dépôts et les dossiers distincts, sans doublon', () => {
    const url = 'https://github.com/octocat/recent-app';
    const same = { ...OLD, directory: RECENT.directory, repositoryUrl: url };

    expect(repositoryUrls([{ ...RECENT, repositoryUrl: url }, same, OLD])).toEqual([url]);
    expect(directories([RECENT, same, { ...OLD, directory: '' }])).toEqual([RECENT.directory]);
  });

  it('détache le projet quand le dépôt a disparu, sans casser l’application', () => {
    // `gone` — dépôt supprimé côté GitHub ou introuvable pour le compte — est
    // traité **exactement** comme une suppression réussie : l'adresse est
    // retirée, le projet reste dans la liste, prêt à être reconnecté. Garder
    // l'adresse morte ferait échouer chaque geste qui s'appuie dessus.
    const memory = new Map<string, string>();
    const storage = {
      read: (key: string) => memory.get(key) ?? null,
      write: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const url = 'https://github.com/octocat/recent-app';
    const stored = { ...RECENT, repositoryUrl: url };
    storage.write(PROJECTS_STORAGE_KEY, JSON.stringify([stored, OLD]));

    const after = detachRepository(storage, stored.id);

    expect(after.find((project) => project.id === stored.id)?.repositoryUrl).toBeUndefined();
    // Le projet, lui, est toujours là : c'est ce qui rend la reconnexion
    // possible.
    expect(after.map((project) => project.id)).toEqual([stored.id, OLD.id]);
    // Et l'autre projet n'a pas bougé.
    expect(after.find((project) => project.id === OLD.id)).toEqual(OLD);
  });

  it('ne demande rien tant qu’on n’a pas cliqué sur le bouton', () => {
    // Le clic lui-même se prouve dans un vrai navigateur (`pnpm test:e2e`) :
    // ici, le rendu statique dit seulement que rien n'est ouvert au départ, et
    // qu'aucune suppression ne part toute seule.
    const html = render({ projects: [RECENT] });

    expect(html).not.toContain('Vider la sélection');
    expect(html).not.toContain('Liste vidée');
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

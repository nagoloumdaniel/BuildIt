import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FR } from '../../lib/i18n/messages';
import type { RepositoryView } from '../github/repositories';
import type { ClonePreviewView, CloneResultView } from './clone';
import {
  CloneView,
  type CloneViewProps,
  cloneBlocker,
  composedDirectory,
  destinationLabel,
  failureMessage,
  matchingRepositories,
  phaseLabel,
} from './view';

/** La vue de l'écran 22, rendue sans DOM. */

const c = FR.clone;

const PARENT = 'C:\\Projets';

const REPOSITORY: RepositoryView = {
  fullName: 'octocat/mon-app',
  owner: 'octocat',
  name: 'mon-app',
  private: true,
  description: 'une application',
  cloneUrl: 'https://github.com/octocat/mon-app.git',
  htmlUrl: 'https://github.com/octocat/mon-app',
};

const PREVIEW: ClonePreviewView = {
  ok: true,
  folder: 'mon-app',
  directory: 'C:\\Projets\\mon-app',
  repoName: 'mon-app',
  label: 'octocat/mon-app',
  protocol: 'https',
  host: 'github.com',
  github: true,
  destination: 'free',
  problem: null,
  issues: [],
};

const PROJECT: NonNullable<CloneResultView['project']> = {
  directory: 'C:\\Projets\\mon-app',
  label: 'JavaScript / TypeScript',
  ecosystem: 'node',
  packageManager: 'pnpm',
  source: 'lockfile',
  evidence: 'pnpm-lock.yaml',
  origin: 'd’après pnpm-lock.yaml',
  warnings: [],
  plainCommand: 'pnpm install',
  safeCommand: 'pnpm install --ignore-scripts',
  description: 'JavaScript / TypeScript : pnpm (d’après pnpm-lock.yaml)',
};

function render(overrides: Partial<CloneViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(CloneView, {
      tab: 'link',
      onTab: () => undefined,
      destinationMode: 'parent',
      connected: false,
      repositories: [],
      repositoriesLoading: false,
      repositoryIssues: [],
      query: '',
      onQuery: () => undefined,
      link: 'octocat/mon-app',
      onLink: () => undefined,
      folder: 'mon-app',
      onFolder: () => undefined,
      parent: PARENT,
      onParent: () => undefined,
      install: false,
      onInstall: () => undefined,
      ignoreScripts: true,
      onIgnoreScripts: () => undefined,
      preview: null,
      result: null,
      status: 'idle',
      progress: null,
      failure: null,
      onPreview: () => undefined,
      onClone: () => undefined,
      onCancel: () => undefined,
      onPick: () => undefined,
      ...overrides,
    }),
  );
}

describe('CloneView onglet « Mes dépôts »', () => {
  it('liste les dépôts du compte connecté', () => {
    const html = render({ tab: 'mine', connected: true, repositories: [REPOSITORY] });

    expect(html).toContain('octocat/mon-app');
    expect(html).toContain('une application');
    expect(html).toContain('privé');
    expect(html).toContain('Rechercher un dépôt');
  });

  it('annonce la lecture des dépôts sans squelette', () => {
    const html = render({ tab: 'mine', connected: true, repositoriesLoading: true });

    expect(html).toContain('Lecture de vos dépôts…');
    expect(html).not.toContain('pf-skeleton');
  });

  it('dit qu’aucun dépôt ne correspond au filtre', () => {
    const html = render({ tab: 'mine', connected: true, repositories: [REPOSITORY], query: 'zut' });

    expect(html).toContain('Aucun dépôt ne correspond à « zut »');
  });

  it('envoie se connecter quand aucun compte n’est connecté', () => {
    const html = render({ tab: 'mine', repositoryIssues: ['Connectez-vous à GitHub.'] });

    expect(html).toContain('Connecter un compte GitHub');
    expect(html).toContain('Connectez-vous à GitHub.');
  });
});

describe('CloneView la destination en local', () => {
  it('fait choisir un dossier parent dans l’explorateur, jamais un chemin tapé', () => {
    const html = render();

    expect(html).toContain('Lien du dépôt');
    expect(html).toContain('Dossier parent');
    expect(html).toContain('Choisir où cloner');
    // Le parent est un bouton qui ouvre l'explorateur : aucun champ de saisie
    // ne porte ce chemin, et le nom du sous-dossier reste le seul texte édité.
    expect(html).toMatch(/<button[^>]*id="pf-clone-parent"/);
    expect(html).not.toMatch(/<input[^>]*id="pf-clone-parent"/);
    expect(html).toContain('Nom du sous-dossier');
  });

  it('affiche le chemin complet qui sera écrit, parent compris', () => {
    const html = render({ folder: 'mon-app' });

    expect(html).toContain('Chemin complet qui sera écrit');
    expect(html).toContain('C:\\Projets\\mon-app');
  });

  it('affiche le chemin résolu par le serveur une fois la destination vérifiée', () => {
    const html = render({ preview: PREVIEW });

    expect(html).toContain('Destination');
    expect(html).toContain('C:\\Projets\\mon-app');
    expect(html).toContain('octocat/mon-app');
    expect(html).toContain('absent : le clone le créera.');
  });

  it('propose l’installation avec l’avertissement de confiance', () => {
    const html = render({ install: true });

    expect(html).toContain('Installer les dépendances');
    expect(html).toContain('sans exécuter les scripts');
    expect(html).toContain('code de confiance');
  });

  it('grise « Cloner » tant que rien n’a été vérifié, et dit pourquoi', () => {
    const html = render();

    expect(html).toContain('disabled');
    expect(html).toContain('Vérifiez d’abord le lien et le dossier de destination.');
  });

  it('demande le dossier parent avant même de vérifier', () => {
    const html = render({ parent: '' });

    expect(html).toContain('Choisissez d’abord le dossier où cloner.');
  });

  it('rend la destination vérifiée et affranchit le bouton', () => {
    const html = render({ preview: PREVIEW });

    expect(html).not.toContain('Vérifiez d’abord le lien');
    expect(html).toContain('Cloner');
  });

  it('pose le lien, le dossier et la vérification sur une même ligne', () => {
    const html = render();

    expect(html).toContain('flex flex-wrap items-end gap-3');
    expect(html).toContain('flex-1 min-w-[16rem]');
    expect(html).toContain('w-40');
    expect(html).toContain(c.verifyLink);
  });

  it('dit « Lien valide » après la vérification, et « Vérifier le lien » avant', () => {
    expect(render()).toContain(c.verifyLink);
    expect(render({ preview: PREVIEW })).toContain(c.linkValid);
  });

  it('remplit le champ grisé avec le nom déduit du lien, sinon le dossier saisi', () => {
    // Avant toute vérification, le champ reprend le nom du dossier déjà saisi.
    const before = render({ folder: 'mon-app' }).match(
      /<input[^>]*id="pf-clone-project-name"[^>]*>/,
    )?.[0];
    expect(before).toBeDefined();
    expect(before).toMatch(/readonly/i);
    expect(before).toContain('value="mon-app"');

    // Une fois le lien vérifié, le nom du dépôt déduit s'affiche.
    const after = render({ preview: PREVIEW }).match(
      /<input[^>]*id="pf-clone-project-name"[^>]*>/,
    )?.[0];
    expect(after).toContain('value="mon-app"');

    // Sans nom déduit, on retombe sur le dossier saisi.
    const fallback = render({ preview: { ...PREVIEW, repoName: '' } }).match(
      /<input[^>]*id="pf-clone-project-name"[^>]*>/,
    )?.[0];
    expect(fallback).toContain('value="mon-app"');
  });

  it('propose d’ouvrir dans l’explorateur après un clone réussi', () => {
    const html = render({
      status: 'done',
      result: {
        ok: true,
        directory: 'C:\\Projets\\mon-app',
        issues: [],
        warnings: [],
        installed: false,
      },
    });

    expect(html).toContain(c.openInExplorer);
  });
});

describe('CloneView destination refusée', () => {
  const REFUSED: ClonePreviewView = {
    ...PREVIEW,
    ok: false,
    folder: 'mon-app',
    directory: '',
    destination: 'unknown',
    problem: 'parent',
    issues: [
      'Le dossier C:\\absent n’est pas accessible : il n’existe pas, ou ce compte n’a pas le droit de le lire. Choisissez-en un autre dans l’explorateur.',
    ],
  };

  it('dit « pas accessible » et propose de choisir un autre dossier', () => {
    const html = render({ parent: 'C:\\absent', preview: REFUSED });

    expect(html).toContain('Dossier pas accessible');
    expect(html).toContain('n’est pas accessible');
    expect(html).toContain('Choisir un autre dossier');
    // Le geste de reprise est le même explorateur, monté une seule fois.
    expect(html).toContain('id="pf-clone-parent-retry"');
    expect(html).not.toContain('id="pf-clone-parent"');
  });

  it('ne montre aucune barre de chargement quand le dossier est refusé', () => {
    const html = render({ parent: 'C:\\absent', preview: REFUSED });

    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('pf-bar-indeterminate');
  });

  it('ne dit pas « pas accessible » pour un parent encore vide', () => {
    const html = render({
      parent: '',
      preview: {
        ...REFUSED,
        issues: ['Choisissez le dossier où le dépôt doit atterrir.'],
      },
    });

    expect(html).not.toContain('Dossier pas accessible');
    expect(html).toContain('Choisir où cloner');
  });

  it('dit le refus d’un dossier déjà occupé, et garde le geste de correction', () => {
    const html = render({
      preview: {
        ...PREVIEW,
        ok: false,
        destination: 'taken',
        problem: 'occupied',
        issues: ['Le dossier existe déjà et n’est pas vide.'],
      },
    });

    expect(html).toContain('existant et non vide : refusé.');
    expect(html).toContain('Le dossier existe déjà et n’est pas vide.');
  });
});

describe('CloneView la destination en hébergé', () => {
  const hosted: NonNullable<CloneViewProps['hosted']> = {
    canWrite: true,
    plan: null,
    status: 'idle',
    progress: null,
    outcome: null,
    failure: null,
    partial: null,
    onCheck: () => undefined,
    onCopy: () => undefined,
    onDownload: () => undefined,
    onCancel: () => undefined,
  };

  it('passe la main à la copie hébergée, et dit avant tout ce qu’elle n’est pas', () => {
    const html = render({ destinationMode: 'root', folder: 'mon-projet', hosted });

    expect(html).toContain(c.hostedTitle);
    expect(html).toContain('sans historique git');
    expect(html).toContain('une page web ne peut lancer aucun programme');
    expect(html).toContain(c.chooseDestination);
    // Ni explorateur du serveur, ni racine de travail, ni installation.
    expect(html).not.toContain('Choisir où cloner');
    expect(html).not.toContain('Dossier parent');
    expect(html).not.toContain(c.installAfter);
    expect(html).not.toContain(c.projectNameLabel);
  });

  it('sans la copie hébergée, n’affiche aucun geste qui ne marcherait pas', () => {
    const html = render({ destinationMode: 'root', folder: 'mon-projet' });

    expect(html).not.toContain(c.chooseDestination);
    expect(html).not.toContain(c.installAfter);
  });
});

describe('CloneView l’avancement', () => {
  it('montre la phase réelle, le pourcentage et la sortie brute de git', () => {
    const html = render({
      status: 'cloning',
      progress: { phase: 'receiving', percent: 62, detail: '520/1234 · 3.00 MiB/s' },
    });

    expect(html).toContain('Clonage en cours');
    expect(html).toContain('Réception des objets');
    expect(html).toContain('62');
    expect(html).toContain('520/1234');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="62"');
    expect(html).toContain('Annuler');
  });

  it('n’invente aucun pourcentage tant que git n’a rien dit', () => {
    const html = render({ status: 'cloning', progress: null });

    expect(html).toContain('Connexion au dépôt');
    expect(html).toContain('pf-bar-indeterminate');
    expect(html).not.toContain('aria-valuenow');
  });

  it('garde la phase atteinte après l’arrêt, sans barre qui tourne', () => {
    const html = render({
      status: 'cancelled',
      progress: { phase: 'receiving', percent: 62, detail: '520/1234' },
      result: null,
    });

    expect(html).toContain('Suivi interrompu');
    expect(html).toContain('le clonage peut continuer côté serveur');
    expect(html).toContain('incomplet');
    expect(html).toContain('Dernière phase atteinte');
    expect(html).toContain('Réception des objets');
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain('Annuler');
  });

  it('raconte un suivi perdu sans laisser croire que rien n’a été écrit', () => {
    const html = render({ status: 'failed', failure: { reason: 'timeout', seconds: 60 } });

    expect(html).toContain('Le suivi du clone s’est arrêté');
    expect(html).toContain('depuis 60 secondes');
    expect(html).not.toContain('role="progressbar"');
  });

  it('dit que la vérification n’a pas abouti quand le serveur ne répond pas', () => {
    const html = render({ status: 'unavailable' });

    expect(html).toContain('La vérification n’a pas abouti');
    expect(html).toContain('Rien n’a été cloné');
    expect(html).not.toContain('Vérification…');
    expect(html).not.toContain('role="progressbar"');
  });
});

describe('CloneView le résultat, conservé après la fin', () => {
  it('annonce le clone, le projet détecté et l’installation', () => {
    const html = render({
      preview: PREVIEW,
      status: 'done',
      progress: { phase: 'done', percent: 100 },
      result: {
        ok: true,
        directory: 'C:\\Projets\\mon-app',
        issues: [],
        warnings: ['Aucun projet reconnu dans ce dossier.'],
        installed: true,
        installCommand: 'pnpm install --ignore-scripts',
        project: PROJECT,
      },
    });

    expect(html).toContain('Dépôt cloné dans C:\\Projets\\mon-app');
    expect(html).toContain('Projet détecté : JavaScript / TypeScript : pnpm');
    expect(html).toContain('Commande d’installation : pnpm install --ignore-scripts.');
    expect(html).toContain('Dépendances installées.');
    expect(html).toContain('Aucun projet reconnu dans ce dossier.');
    // Le résultat reste affiché avec la phase atteinte.
    expect(html).toContain('Terminé');
  });

  it('rend le refus du clone tel quel, avec sa sortie moteur', () => {
    const html = render({
      status: 'done',
      result: {
        ok: false,
        directory: 'C:\\Projets\\mon-app',
        issues: ['Le dossier existe déjà et n’est pas vide : un clone n’écrase rien.'],
        warnings: [],
        installed: false,
      },
    });

    expect(html).toContain('Le clone n’a pas été effectué');
    expect(html).toContain('n’écrase rien');
  });
});

describe('cloneBlocker', () => {
  it('dit l’étape manquante, le refus, puis rien', () => {
    expect(cloneBlocker(null, { busy: false, destinationMode: 'parent', parent: '' }, c)).toBe(
      c.blockerNoParent,
    );
    expect(cloneBlocker(null, { busy: false, destinationMode: 'parent', parent: PARENT }, c)).toBe(
      c.blockerNoPreview,
    );
    expect(
      cloneBlocker(
        { ...PREVIEW, ok: false, issues: ['refus'] },
        { busy: false, destinationMode: 'root', parent: '' },
        c,
      ),
    ).toBe('refus');
    expect(cloneBlocker(PREVIEW, { busy: false, destinationMode: 'root', parent: '' }, c)).toBe(
      undefined,
    );
    expect(cloneBlocker(PREVIEW, { busy: true, destinationMode: 'root', parent: '' }, c)).toBe(
      c.blockerBusy,
    );
  });
});

describe('les phrases de la vue', () => {
  it('traduit chaque phase', () => {
    expect(phaseLabel('receiving', c)).toBe('Réception des objets');
    expect(phaseLabel('done', c)).toBe('Terminé');
  });

  it('traduit chaque état de dossier', () => {
    expect(destinationLabel('free', c)).toBe(c.folderFree);
    expect(destinationLabel('taken', c)).toBe(c.folderTaken);
    expect(destinationLabel('unknown', c)).toBe(c.folderUnknown);
  });

  it('compose le chemin complet avec le séparateur du parent', () => {
    expect(composedDirectory('C:\\Projets', 'mon-app')).toBe('C:\\Projets\\mon-app');
    expect(composedDirectory('/home/dev/', 'mon-app')).toBe('/home/dev/mon-app');
    expect(composedDirectory('C:\\Projets', '')).toBe('C:\\Projets');
    expect(composedDirectory('', 'mon-app')).toBe('');
  });

  it('raconte chaque fin du suivi', () => {
    expect(failureMessage({ reason: 'timeout', seconds: 60 }, c)).toContain('60 secondes');
    expect(failureMessage({ reason: 'network' }, c)).toContain('liaison');
    expect(failureMessage({ reason: 'http', status: 500 }, c)).toContain('500');
    expect(failureMessage({ reason: 'malformed' }, c)).toContain('illisible');
    expect(failureMessage({ reason: 'incomplete' }, c)).toContain('avant la fin');
  });
});

describe('matchingRepositories', () => {
  it('filtre sur le nom et la description, sans tenir compte de la casse', () => {
    expect(matchingRepositories([REPOSITORY], 'MON-APP')).toHaveLength(1);
    expect(matchingRepositories([REPOSITORY], 'application')).toHaveLength(1);
    expect(matchingRepositories([REPOSITORY], 'autre')).toHaveLength(0);
    expect(matchingRepositories([REPOSITORY], '  ')).toHaveLength(1);
  });
});

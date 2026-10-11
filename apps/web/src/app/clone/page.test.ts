import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RepositoryView } from '../github/repositories';
import type { ClonePreviewView } from './clone';
import { CloneView, type CloneViewProps, cloneBlocker, matchingRepositories } from './view';

/** La vue de l'écran 22, rendue sans DOM. */

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
  directory: 'C:\\travail\\mon-app',
  label: 'octocat/mon-app',
  protocol: 'https',
  host: 'github.com',
  github: true,
  destination: 'free',
  issues: [],
};

function render(overrides: Partial<CloneViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(CloneView, {
      tab: 'link',
      onTab: () => undefined,
      root: 'C:\\travail',
      connected: false,
      repositories: [],
      repositoryIssues: [],
      query: '',
      onQuery: () => undefined,
      link: '',
      onLink: () => undefined,
      folder: '',
      onFolder: () => undefined,
      install: false,
      onInstall: () => undefined,
      ignoreScripts: true,
      onIgnoreScripts: () => undefined,
      preview: null,
      result: null,
      busy: false,
      onPreview: () => undefined,
      onClone: () => undefined,
      onPick: () => undefined,
      ...overrides,
    }),
  );
}

describe('CloneView — onglet « Mes dépôts »', () => {
  it('liste les dépôts du compte connecté', () => {
    const html = render({ tab: 'mine', connected: true, repositories: [REPOSITORY] });

    expect(html).toContain('octocat/mon-app');
    expect(html).toContain('une application');
    expect(html).toContain('privé');
    expect(html).toContain('Rechercher un dépôt');
  });

  it('envoie se connecter quand aucun compte n’est connecté', () => {
    const html = render({ tab: 'mine', repositoryIssues: ['Connectez-vous à GitHub.'] });

    expect(html).toContain('Connecter un compte GitHub');
    expect(html).toContain('Connectez-vous à GitHub.');
  });
});

describe('CloneView — onglet « Depuis un lien »', () => {
  it('affiche le dossier, la racine de travail et l’option d’installation', () => {
    const html = render({ root: 'C:\\travail', install: true });

    expect(html).toContain('Lien du dépôt');
    expect(html).toContain('C:\\travail');
    expect(html).toContain('Installer les dépendances');
    expect(html).toContain('sans exécuter les scripts');
    expect(html).toContain('code de confiance');
  });

  it('grise « Cloner » tant que rien n’a été vérifié, et dit pourquoi', () => {
    const html = render();

    expect(html).toContain('disabled');
    expect(html).toContain('Vérifiez d’abord le lien et le dossier de destination.');
  });

  it('rend la destination vérifiée et affranchit le bouton', () => {
    const html = render({ preview: PREVIEW });

    expect(html).toContain('octocat/mon-app');
    expect(html).toContain('absent — le clone le créera.');
    expect(html).not.toContain('Vérifiez d’abord le lien');
  });

  it('dit le refus d’un dossier déjà occupé', () => {
    const html = render({
      preview: { ...PREVIEW, ok: false, destination: 'taken', issues: ['Le dossier existe déjà.'] },
    });

    expect(html).toContain('existant et non vide : refusé.');
    expect(html).toContain('Le dossier existe déjà.');
  });

  it('rend le résultat du clone et l’installation', () => {
    const html = render({
      preview: PREVIEW,
      result: {
        ok: true,
        directory: 'C:\\travail\\mon-app',
        issues: [],
        warnings: [],
        installed: true,
        installCommand: 'pnpm install',
      },
    });

    expect(html).toContain('Dépôt cloné dans');
    expect(html).toContain('Dépendances installées.');
  });
});

describe('cloneBlocker', () => {
  it('dit l’étape manquante, le refus, puis rien', () => {
    expect(cloneBlocker(null, false)).toContain('Vérifiez d’abord');
    expect(cloneBlocker({ ...PREVIEW, ok: false, issues: ['refus'] }, false)).toBe('refus');
    expect(cloneBlocker(PREVIEW, false)).toBeUndefined();
    expect(cloneBlocker(PREVIEW, true)).toContain('en cours');
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

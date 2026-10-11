import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AccessView, RepositoryStatusView, RoleView } from './sharing';
import { createBlocker, inviteBlocker, RepoView, type RepoViewProps, shareBlocker } from './view';

/** La vue de l'écran 24, rendue sans DOM. */

const ROLES: readonly RoleView[] = [
  { role: 'read', label: 'Lecture', note: 'Voit le dépôt sans écrire.' },
  { role: 'write', label: 'Écriture', note: 'Pousse du code et des branches.' },
];

const WITH_REPO: RepositoryStatusView = {
  ok: true,
  directory: 'C:\\projets\\mon-app',
  isRepository: true,
  hasCommit: true,
  origin: 'git@github.com:octocat/mon-app.git',
  github: true,
  owner: 'octocat',
  name: 'mon-app',
  url: 'https://github.com/octocat/mon-app',
  visibility: 'private',
  proposedName: 'mon-app',
  issues: [],
};

const NO_REPO: RepositoryStatusView = {
  ok: true,
  directory: 'C:\\projets\\mon-app',
  isRepository: false,
  hasCommit: false,
  github: false,
  visibility: 'unknown',
  proposedName: 'mon-app',
  issues: [],
};

const ACCESS: AccessView = {
  ok: true,
  owner: 'octocat',
  name: 'mon-app',
  url: 'https://github.com/octocat/mon-app',
  collaborators: [
    { login: 'octocat', role: 'admin' },
    { login: 'bob', role: 'push' },
  ],
  invitations: [{ login: 'carol', role: 'write' }],
  issues: [],
};

function render(overrides: Partial<RepoViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(RepoView, {
      directory: 'C:\\projets\\mon-app',
      onDirectory: () => undefined,
      status: null,
      access: null,
      roles: ROLES,
      role: 'write',
      onRole: () => undefined,
      username: '',
      onUsername: () => undefined,
      name: '',
      onName: () => undefined,
      isPrivate: true,
      onIsPrivate: () => undefined,
      description: '',
      onDescription: () => undefined,
      busy: false,
      onInspect: () => undefined,
      onCreate: () => undefined,
      onInvite: () => undefined,
      onRemove: () => undefined,
      ...overrides,
    }),
  );
}

describe('shareBlocker — le partage n’existe que via GitHub', () => {
  it('explique, puis se tait quand le dépôt existe', () => {
    expect(shareBlocker(null)).toContain('Lisez d’abord');
    expect(shareBlocker(NO_REPO)).toContain('créez-le d’abord');
    expect(shareBlocker(WITH_REPO)).toBeUndefined();
  });
});

describe('createBlocker — la création du dépôt', () => {
  it('dit ce qui manque, et refuse d’en créer un second', () => {
    expect(createBlocker(null, 'mon-app', false)).toContain('Lisez d’abord');
    expect(createBlocker(NO_REPO, '  ', false)).toContain('nom de dépôt');
    expect(createBlocker(NO_REPO, 'mon-app', false)).toBeUndefined();
    expect(createBlocker(WITH_REPO, 'mon-app', false)).toContain('déjà un dépôt GitHub');
    expect(createBlocker(NO_REPO, 'mon-app', true)).toContain('en cours');
  });
});

describe('inviteBlocker — l’invitation', () => {
  it('hérite du refus de partage et exige un nom', () => {
    expect(inviteBlocker(NO_REPO, 'bob', false)).toContain('créez-le d’abord');
    expect(inviteBlocker(WITH_REPO, '', false)).toContain('nom d’utilisateur');
    expect(inviteBlocker(WITH_REPO, 'bob', false)).toBeUndefined();
  });
});

describe('RepoView — l’état du dépôt', () => {
  it('affiche le lien et la visibilité d’un dépôt GitHub', () => {
    const html = render({ status: WITH_REPO });

    expect(html).toContain('https://github.com/octocat/mon-app');
    expect(html).toContain('privé');
    expect(html).toContain('git@github.com:octocat/mon-app.git');
  });

  it('grise « Partager le projet » avec l’explication quand il n’y a pas de dépôt', () => {
    const html = render({ status: NO_REPO });

    expect(html).toContain('disabled');
    expect(html).toContain('créez-le d’abord');
    expect(html).toContain('lecture seule');
  });

  it('propose la création du dépôt, privé par défaut, quand il n’y en a pas', () => {
    const html = render({ status: NO_REPO, name: 'mon-app' });

    expect(html).toContain('Nom du dépôt');
    expect(html).toContain('Créer le dépôt et pousser le code');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Recommandé');
  });

  it('rend les problèmes d’un dossier illisible', () => {
    const html = render({
      status: { ...NO_REPO, ok: false, issues: ['Le dossier C:\\absent n’existe pas.'] },
    });

    expect(html).toContain('n’existe pas');
  });
});

describe('RepoView — le partage', () => {
  it('liste collaborateurs et invitations, avec les rôles', () => {
    const html = render({ status: WITH_REPO, access: ACCESS, role: 'write' });

    expect(html).toContain('Collaborateurs');
    expect(html).toContain('octocat');
    expect(html).toContain('Invitations en attente');
    expect(html).toContain('carol');
    expect(html).toContain('Retirer');
    expect(html).toContain('Annuler');
    expect(html).toContain('Écriture (write)');
    expect(html).toContain('Pousse du code et des branches.');
  });

  it('grise l’invitation tant qu’aucun nom n’est saisi', () => {
    const html = render({ status: WITH_REPO, access: ACCESS, username: '' });

    expect(html).toContain('Indiquez un nom d’utilisateur GitHub.');
  });

  it('dit qu’un dépôt n’a pas encore de collaborateur', () => {
    const html = render({
      status: WITH_REPO,
      access: { ...ACCESS, collaborators: [], invitations: [] },
    });

    expect(html).toContain('Personne d’autre n’a accès');
  });
});

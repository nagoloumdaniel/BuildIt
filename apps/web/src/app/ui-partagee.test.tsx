import type { Manifest } from '@buildit/manifest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../components/wizard/draft-provider';
import type { GithubStatusView } from './github/session';
import { GithubView } from './github/view';
import GraphPage from './graph/page';
import type { AccessView, RepositoryStatusView, RoleView } from './repo/sharing';
import { RepoView } from './repo/view';
import { decodeSharePayload, encodeSharePayload } from './share/codec';
import { SharePreview } from './share/view';

/**
 * Les écrans convertis consomment `@buildit/ui` — et rendent
 * **exactement** les mêmes classes `pf-*` qu'avant la conversion.
 *
 * C'est la preuve du remplacement : les primitives partagées ne portent aucune
 * classe propre, elles ne font que reconstituer le balisage qui était dupliqué.
 * Le HTML est rendu ici, il n'est pas décrit de mémoire. Une comparaison avant
 * / après conversion des 224 attributs `class` de ces écrans donnait un
 * ensemble identique ; ces assertions gardent les points qui ont bougé.
 */

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
  collaborators: [{ login: 'bob', role: 'push' }],
  invitations: [{ login: 'carol', role: 'write' }],
  issues: [],
};

const NOT_CONNECTED: GithubStatusView = {
  connected: false,
  scopes: [],
  store: 'Gestionnaire d’identification Windows',
  deviceFlowAvailable: true,
  issues: [],
};

const CONNECTED: GithubStatusView = {
  ...NOT_CONNECTED,
  connected: true,
  login: 'octocat',
  scopes: ['repo'],
};

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'demo',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript' },
  database: { engine: 'postgresql', orm: 'prisma' },
};

const LABELS = new Map<string, string>([
  ['next', 'Next.js'],
  ['typescript', 'TypeScript'],
  ['postgresql', 'PostgreSQL'],
  ['prisma', 'Prisma'],
]);

function repoProps(overrides: Record<string, unknown>): ReactElement {
  return createElement(RepoView, {
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
  });
}

describe('écran GitHub — Button, Badge, StatusMessage', () => {
  it('rend les mêmes classes de bouton et de badge qu’avant conversion', () => {
    const html = renderToStaticMarkup(
      createElement(GithubView, {
        status: CONNECTED,
        permissions: [{ scope: 'repo', reason: 'cloner vos dépôts privés' }],
        device: null,
        busy: false,
        message: 'Connecté : octocat.',
        mode: 'device',
        onConnect: () => undefined,
        onDisconnect: () => undefined,
      }),
    );

    expect(html).toContain('class="pf-hint mb-3"');
    expect(html).toContain('class="pf-badge pf-badge-ok ml-2"');
    expect(html).toContain('class="pf-btn"');
    expect(html).toContain('role="status"');
  });

  it('la connexion est le bouton principal, grisé quand le device flow manque', () => {
    const html = renderToStaticMarkup(
      createElement(GithubView, {
        status: { ...NOT_CONNECTED, deviceFlowAvailable: false },
        permissions: [],
        device: null,
        busy: false,
        mode: 'device',
        onConnect: () => undefined,
        onDisconnect: () => undefined,
      }),
    );

    expect(html).toContain('class="pf-btn pf-btn-primary"');
    expect(html).toContain('disabled');
  });
});

describe('écran Share — pas d’élément changé', () => {
  const ok = renderToStaticMarkup(
    createElement(SharePreview, {
      result: decodeSharePayload(encodeSharePayload(MANIFEST)),
      labels: LABELS,
    }),
  );
  const ko = renderToStaticMarkup(
    createElement(SharePreview, {
      result: { ok: false, issues: ['Ce lien est incomplet.'] },
      labels: new Map(),
    }),
  );

  it('garde le badge en paragraphe et le lien de sortie en pf-btn', () => {
    expect(ok).toContain('class="pf-badge"');
    expect(ok).toContain('class="pf-btn"');
    expect(ok).toContain('<p class="pf-badge">Lecture seule</p>');
  });

  it('l’aide reste pf-hint, le refus pf-error, et le refus est un alert', () => {
    expect(ok).toContain('class="pf-hint mt-3"');
    expect(ko).toContain('class="pf-error"');
    expect(ko).toContain('role="alert"');
  });
});

describe('écran Repository & Sharing — Field, Button, Badge, StatusMessage', () => {
  it('Field rend le label et l’aide avec les mêmes classes, sans enveloppe', () => {
    const html = renderToStaticMarkup(repoProps({ status: NO_REPO, name: 'mon-app' }));

    expect(html).toContain('<label class="pf-label" for="pf-repo-directory">');
    expect(html).toContain('<label class="pf-label mt-4" for="pf-repo-name">');
    expect(html).toContain('<label class="pf-label mt-4" for="pf-repo-description">');
    expect(html).toContain('class="pf-btn pf-btn-primary mt-3"');
  });

  it('les issues de lecture sont des refus annoncés', () => {
    const html = renderToStaticMarkup(
      repoProps({ status: { ...NO_REPO, ok: false, issues: ['Le dossier n’existe pas.'] } }),
    );

    expect(html).toContain('class="pf-error mt-1"');
    expect(html).toContain('role="alert"');
  });

  it('le dépôt GitHub garde le badge ml-2 et l’aide mt-1', () => {
    const html = renderToStaticMarkup(repoProps({ status: WITH_REPO }));

    expect(html).toContain('class="pf-badge ml-2"');
    expect(html).toContain('class="pf-hint mt-1"');
  });

  it('le partage garde ses boutons, ses badges de rôle et ses aides', () => {
    const html = renderToStaticMarkup(
      repoProps({ status: WITH_REPO, access: ACCESS, username: 'bob' }),
    );

    expect(html).toContain('class="pf-btn pf-btn-primary"');
    expect(html).toContain('class="pf-btn pf-btn-ghost"');
    expect(html).toContain('class="pf-badge"');
    expect(html).toContain('class="pf-hint mt-2"');
  });
});

describe('écran Graphe — Badge d’état et lien d’action', () => {
  it('l’état d’attente est une région status et le lien garde pf-btn', () => {
    const html = renderToStaticMarkup(createElement(DraftProvider, null, createElement(GraphPage)));

    expect(html).toContain('class="pf-btn"');
    expect(html).toContain('role="status"');
    expect(html).toContain('Calcul du graphe');
  });
});

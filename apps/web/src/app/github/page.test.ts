import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { GithubStatusView } from './session';
import { GithubView, type GithubViewProps } from './view';

/** La vue de l'écran 21, rendue sans DOM : ce que l'utilisateur lit vraiment. */

const PERMISSIONS = [
  { scope: 'repo', reason: 'cloner vos dépôts privés, créer un dépôt, gérer ses collaborateurs' },
];

function render(overrides: Partial<GithubViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(GithubView, {
      status: null,
      permissions: PERMISSIONS,
      device: null,
      busy: false,
      onConnect: () => undefined,
      onDisconnect: () => undefined,
      ...overrides,
    }),
  );
}

const DISCONNECTED: GithubStatusView = {
  connected: false,
  scopes: [],
  store: 'Gestionnaire d’identification Windows',
  deviceFlowAvailable: true,
  issues: [],
};

const CONNECTED: GithubStatusView = {
  connected: true,
  login: 'octocat',
  scopes: ['repo'],
  store: 'Gestionnaire d’identification Windows',
  deviceFlowAvailable: true,
  issues: [],
};

describe('GithubView — déconnecté', () => {
  it('propose la connexion et annonce les permissions en clair', () => {
    const html = render({ status: DISCONNECTED });

    expect(html).toContain('Se connecter à GitHub');
    expect(html).toContain('Permissions demandées');
    expect(html).toContain('repo');
    expect(html).toContain('cloner vos dépôts privés');
  });

  it('grise la connexion et dit quoi faire quand le device flow n’est pas configuré', () => {
    const html = render({
      status: {
        ...DISCONNECTED,
        deviceFlowAvailable: false,
        issues: ['Définissez PF_GITHUB_CLIENT_ID avec l’identifiant de l’application.'],
      },
    });

    expect(html).toContain('disabled');
    expect(html).toContain('PF_GITHUB_CLIENT_ID');
  });

  it('affiche le code à saisir et l’adresse de vérification', () => {
    const html = render({
      status: DISCONNECTED,
      device: {
        id: 'opaque',
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
        expiresIn: 900,
        interval: 5,
      },
    });

    expect(html).toContain('ABCD-1234');
    expect(html).toContain('https://github.com/login/device');
    expect(html).toContain('En attente de votre accord');
    // L'identifiant opaque du serveur n'a rien à faire à l'écran.
    expect(html).not.toContain('opaque');
  });
});

describe('GithubView — connecté', () => {
  it('montre le compte, les permissions accordées et l’emplacement du jeton', () => {
    const html = render({ status: CONNECTED });

    expect(html).toContain('octocat');
    expect(html).toContain('Connecté');
    expect(html).toContain('repo');
    expect(html).toContain('Gestionnaire d’identification Windows');
    expect(html).toContain('Se déconnecter');
  });

  it('ne laisse jamais passer un jeton', () => {
    const html = render({
      status: { ...CONNECTED, scopes: [], store: 'Trousseau macOS' },
    });

    expect(html).toContain('celles du jeton à grain fin');
    expect(html).not.toContain('ghp_');
    expect(html).not.toContain('token=');
  });
});

describe('GithubView — messages', () => {
  it('rend le message d’état en région d’annonce', () => {
    const html = render({ status: CONNECTED, message: 'Connecté : octocat.' });

    expect(html).toContain('role="status"');
    expect(html).toContain('Connecté : octocat.');
  });
});

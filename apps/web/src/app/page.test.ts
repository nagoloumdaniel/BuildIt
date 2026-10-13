import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DraftState, freshDraft } from '../lib/draft';
import type { GenerationReport } from './create/report/result';
import { DashboardView } from './dashboard-view';

/**
 * L'écran 1 rend le brouillon du parcours, donc il vit sous `DraftProvider`.
 * Le provider est ici remplacé par un brouillon pilotable : c'est le seul moyen
 * de rendre les deux états — vierge et en cours — sans DOM ni `localStorage`.
 */

const state = vi.hoisted<{ draft: DraftState }>(() => ({
  draft: undefined as unknown as DraftState,
}));

vi.mock('../components/wizard/draft-provider', () => ({
  useDraft: () => state.draft,
  useSession: () => ({ reset: () => undefined, update: () => undefined }),
}));

// Le champ « lien partagé reçu » navigue : le routeur n'existe pas hors de Next.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
}));

import Home from './page';

function render(): string {
  return renderToStaticMarkup(createElement(Home));
}

beforeEach(() => {
  state.draft = freshDraft();
});

describe('Dashboard — le menu d’accueil (§18bis)', () => {
  it('ouvre sur les trois chemins, sans répéter le nom du produit', () => {
    const html = render();

    expect(html).toContain('Créer un projet');
    expect(html).toContain('Cloner un projet');
    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('href="/create?new=1"');
    expect(html).toContain('href="/clone"');
    // Volontairement absent : le nom et la promesse du produit sont dans
    // l'en-tête de l'application, l'accueil n'a pas de titre à lui.
    expect(html).not.toContain('pf-display');
  });

  it('dit qu’il n’y a rien à reprendre quand le brouillon est vierge', () => {
    const html = render();

    expect(html).toContain('Aucun brouillon en cours');
    expect(html).not.toContain('Reprendre');
  });

  it('offre d’ouvrir un lien partagé reçu, en lecture seule', () => {
    const html = render();
    const field = html.match(/<input[^>]*id="pf-shared-link"[^>]*>/)?.[0] ?? '';

    expect(html).toContain('Lien partagé reçu');
    // Le champ est saisissable — la Phase 9 est livrée, il n'est plus désactivé.
    expect(field).not.toBe('');
    expect(field).not.toContain('disabled');
    // Et il dit où vit la donnée : après le `#`, donc hors du serveur.
    expect(html).toContain('ne quitte jamais votre navigateur');
  });

  it('mène au compte GitHub et au dépôt', () => {
    const html = render();

    expect(html).toContain('href="/github"');
    expect(html).toContain('href="/repo"');
  });
});

describe('Dashboard — le brouillon en cours', () => {
  it('propose de reprendre à l’étape quittée', () => {
    state.draft = { ...freshDraft(), name: 'mon-app', step: 'stack' };
    const html = render();

    expect(html).toContain('mon-app');
    expect(html).toContain('href="/create/stack"');
    expect(html).toContain('stack technique');
    expect(html).toContain('Repartir de zéro');
  });

  it('renvoie la première étape vers /create, pas /create/create', () => {
    state.draft = { ...freshDraft(), name: 'mon-app' };
    const html = render();

    expect(html).toContain('href="/create?new=1"');
    expect(html).not.toContain('/create/create');
  });

  it('reprend dès qu’un choix a été fait, même sans nom', () => {
    state.draft = { ...freshDraft(), targets: ['web'] };
    const html = render();

    expect(html).toContain('Projet sans nom');
    expect(html).toContain('Reprendre');
  });
});

describe('Dashboard — projets créés (§6.14)', () => {
  const SUCCESS: GenerationReport = {
    ok: true,
    directory: '/tmp/pf/mon-projet',
    files: ['package.json'],
    bytes: 1024,
    warnings: [],
    steps: ['plan', 'write'],
    issues: [],
  };

  function renderView(draft: DraftState, report: GenerationReport | null = null): string {
    return renderToStaticMarkup(
      createElement(DashboardView, { draft, report, onReset: () => undefined }),
    );
  }

  it('un projet généré avec succès rejoint « Projets créés », pas le brouillon', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'report' };
    const html = renderView(draft, SUCCESS);

    expect(html).toContain('Projets créés');
    expect(html).toContain('mon-projet');
    expect(html).toContain('Terminé');
    expect(html).not.toContain('Reprendre');
    expect(html).not.toContain('Repartir de zéro');
  });

  it('propose GitHub et le rapport & la doc d’installation, jamais un retour en arrière', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'report' };
    const html = renderView(draft, SUCCESS);

    expect(html).toContain('href="/repo"');
    expect(html).toContain('Connecter à GitHub');
    expect(html).toContain('href="/create/report"');
    expect(html).toContain('la doc d’installation');
  });

  it('un rapport de refus ne compte pas comme un projet terminé', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'report' };
    const html = renderView(draft, { ...SUCCESS, ok: false, issues: ['refusé'] });

    expect(html).not.toContain('Projets créés');
  });

  it('étape « report » sans rapport en main (onglet rouvert) : pas de carte « projets créés »', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'report' };
    const html = renderView(draft, null);

    expect(html).not.toContain('Projets créés');
  });

  it('un brouillon encore en cours garde Reprendre et Repartir de zéro, sans « Projets créés »', () => {
    const draft: DraftState = { ...freshDraft(), name: 'mon-projet', step: 'stack' };
    const html = renderView(draft, null);

    expect(html).not.toContain('Projets créés');
    expect(html).toContain('Reprendre');
  });
});

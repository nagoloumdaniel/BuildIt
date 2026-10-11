import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DraftState, freshDraft } from '../lib/draft';

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

import Home from './page';

function render(): string {
  return renderToStaticMarkup(createElement(Home));
}

beforeEach(() => {
  state.draft = freshDraft();
});

describe('Dashboard — le menu d’accueil (§18bis)', () => {
  it('annonce le produit et les trois chemins', () => {
    const html = render();

    expect(html).toContain('Project Factory');
    expect(html).toContain('Créer un projet');
    expect(html).toContain('Cloner un projet');
    expect(html).toContain('Ouvrir un projet local');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/clone"');
    expect(html).toContain('href="/open"');
  });

  it('dit qu’il n’y a rien à reprendre quand le brouillon est vierge', () => {
    const html = render();

    expect(html).toContain('Aucun brouillon en cours');
    expect(html).not.toContain('Reprendre');
  });

  it('annonce le lien partagé reçu comme à venir (Phase 9)', () => {
    const html = render();

    expect(html).toContain('Lien partagé reçu');
    expect(html).toContain('Phase 9');
    expect(html).toContain('disabled');
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

    expect(html).toContain('href="/create"');
    expect(html).not.toContain('/create/create');
  });

  it('reprend dès qu’un choix a été fait, même sans nom', () => {
    state.draft = { ...freshDraft(), targets: ['web'] };
    const html = render();

    expect(html).toContain('Projet sans nom');
    expect(html).toContain('Reprendre');
  });
});

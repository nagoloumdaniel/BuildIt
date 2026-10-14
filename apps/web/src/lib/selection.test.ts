import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import { selectionFor, selectionOf } from './selection';

/**
 * Une seule sélection pour le moteur, quelle que soit la liste du brouillon où
 * le choix a été posé. Le catalogue n'est pas lu ici : ce module ne connaît que
 * des listes, et c'est ce qui lui permet d'être appelé par les trois écrans.
 */

describe('selectionFor', () => {
  it('unit technologies, capacités et choix d’infrastructure, triés', () => {
    const selection = selectionOf({
      ...freshDraft(),
      targets: ['web', 'api'],
      technologies: ['next', 'typescript'],
      capabilities: ['stripe'],
      infra: { docker: true, ci: true },
    });

    expect(selection.targets).toEqual(['web', 'api']);
    // `docker` et `github-actions` sont les deux identifiants que les booléens
    // ajoutent : ils comptent comme des choix, au même titre qu'une technologie.
    expect(selection.technologies).toEqual([
      'docker',
      'github-actions',
      'next',
      'stripe',
      'typescript',
    ]);
  });

  it('déduplique et trie : l’ordre des clics ne change pas la vérification', () => {
    const parts = { targets: ['web'], infra: { docker: false, ci: false } };
    const first = selectionFor({
      ...parts,
      technologies: ['next'],
      capabilities: ['next', 'zod'],
    });
    const second = selectionFor({
      ...parts,
      technologies: ['zod'],
      capabilities: ['next'],
    });

    expect(first).toEqual(second);
    expect(first.technologies).toEqual(['next', 'zod']);
  });

  it('n’ajoute rien quand ni Docker ni la CI ne sont cochés', () => {
    expect(selectionOf(freshDraft()).technologies).toEqual([]);
  });

  it('copie les cibles : la sélection ne partage pas la référence du brouillon', () => {
    const targets = ['web'];
    const selection = selectionFor({
      targets,
      technologies: [],
      capabilities: [],
      infra: { docker: false, ci: false },
    });

    expect(selection.targets).toEqual(['web']);
    expect(selection.targets).not.toBe(targets);
  });
});

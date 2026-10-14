import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ConfirmDeleteDialog,
  type ConfirmDeleteDialogProps,
  type DeleteTarget,
} from './confirm-delete-dialog';

/**
 * La popup de confirmation, rendue **sans DOM**.
 *
 * Ce que ce fichier prouve, et ce qu'il ne peut pas prouver : le balisage (une
 * case par cible, l'erreur annoncée, l'étape de suivi qui remplace le
 * formulaire). `showModal()`, l'Échap et le clic sur le fond demandent un vrai
 * document c'est le rôle de `pnpm test:e2e`, qui pilote un navigateur ; le
 * rendu statique, lui, ne monte aucun effet et n'a donc pas de `<dialog>` à
 * ouvrir.
 *
 * Le composant ne contient aucune phrase : les libellés viennent tous de
 * l'appelant. C'est aussi ce qui rend ce test lisible il vérifie la structure,
 * pas la rédaction.
 */

const TARGETS: readonly DeleteTarget[] = [
  { id: 'site', label: 'Retirer de la liste BuildIt', note: 'Rien n’est effacé.' },
  { id: 'github', label: 'Supprimer le dépôt GitHub', note: 'Définitif.' },
  { id: 'local', label: 'Supprimer le dossier local', note: 'Définitif.' },
];

function render(overrides: Partial<ConfirmDeleteDialogProps> = {}): string {
  return renderToStaticMarkup(
    createElement(ConfirmDeleteDialog, {
      busy: false,
      busyLabel: 'Suppression en cours…',
      cancelLabel: 'Annuler',
      closeLabel: 'Fermer',
      confirmLabel: 'Supprimer la sélection',
      description: 'Choisissez ce qui doit disparaître.',
      onClose: () => undefined,
      onConfirm: () => undefined,
      targets: TARGETS,
      title: 'Supprimer « mon-app » ?',
      ...overrides,
    }),
  );
}

describe('ConfirmDeleteDialog le formulaire', () => {
  it('est un vrai `<dialog>` nommé par son titre', () => {
    const html = render();

    expect(html).toContain('<dialog');
    expect(html).toContain('aria-labelledby="pf-delete-dialog-title"');
    expect(html).toContain('id="pf-delete-dialog-title"');
    expect(html).toContain('Supprimer « mon-app » ?');
    expect(html).toContain('Choisissez ce qui doit disparaître.');
  });

  it('rend une case par cible, avec son libellé et ce qu’elle détruit', () => {
    const html = render();

    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    for (const target of TARGETS) {
      expect(html).toContain(`id="pf-delete-${target.id}"`);
      expect(html).toContain(`for="pf-delete-${target.id}"`);
      expect(html).toContain(target.label);
      expect(html).toContain(target.note);
    }
  });

  it('coche toutes les cibles par défaut', () => {
    const html = render();

    // La question est « supprimer quoi ? » : la réponse la plus courante est
    // « tout ce qui est proposé ». Une case décochée est un retrait explicite.
    expect(html.match(/checked=""/g)).toHaveLength(3);
  });

  it('n’offre que les cibles qu’on lui donne', () => {
    // Un projet téléchargé en ZIP n'a pas de dossier local : l'appelant ne
    // passe pas la cible, la popup ne doit donc pas en inventer une.
    const html = render({ targets: TARGETS.slice(0, 2) });

    expect(html.match(/type="checkbox"/g)).toHaveLength(2);
    expect(html).not.toContain('id="pf-delete-local"');
    expect(html).not.toContain('Supprimer le dossier local');
  });

  it('porte les deux issues, dont le geste destructeur', () => {
    const html = render();

    expect(html).toContain('Supprimer la sélection');
    expect(html).toContain('Annuler');
    expect(html).toContain('pf-btn-danger');
  });

  it('désactive tout et le dit pendant une suppression', () => {
    const html = render({ busy: true });

    expect(html).toContain('Suppression en cours…');
    // Les trois cases, le geste destructeur et l'abandon : rien n'est
    // cliquable tant que le disque travaille.
    expect(html.match(/disabled/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('affiche l’échec sans refermer la popup', () => {
    const html = render({ error: 'La suppression n’a pas abouti : refus.' });

    expect(html).toContain('role="status"');
    expect(html).toContain('La suppression n’a pas abouti : refus.');
    // Le formulaire est toujours là : on peut réessayer.
    expect(html).toContain('type="checkbox"');
  });

  it('remplace le formulaire par l’étape de suivi, et ne propose plus que Fermer', () => {
    const html = render({
      result: createElement('p', null, 'Dépôt introuvable sur GitHub'),
    });

    expect(html).toContain('Dépôt introuvable sur GitHub');
    expect(html).toContain('Fermer');
    // Plus de case à cocher ni de geste destructeur : le suivi n'invite pas à
    // supprimer une deuxième fois.
    expect(html).not.toContain('type="checkbox"');
    expect(html).not.toContain('Supprimer la sélection');
    expect(html).not.toContain('Annuler');
  });
});

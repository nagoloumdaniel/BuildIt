import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RouteError from './error';
import Loading from './loading';
import NotFound from './not-found';

/**
 * Les trois états qu'une route peut prendre **en dehors** de son contenu :
 * l'adresse inconnue, l'arrêt, l'attente.
 *
 * Ce sont les seuls écrans que l'utilisateur voit sans les avoir demandés. Ils
 * ont donc deux obligations, vérifiées ici : dire ce qui se passe, et offrir
 * une sortie. Aucun d'eux n'est un cul-de-sac, et aucun n'imite un squelette.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/create/plateformes',
}));

describe('NotFound', () => {
  it('rend le code et les sorties', () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).toContain('404');
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/projects"');
  });

  it('ne rend pas l’adresse demandée avant le montage', () => {
    // Le rendu serveur d'une 404 ne connaît aucun chemin : l'afficher tout de
    // suite faisait diverger l'hydratation (`#418`). Elle apparaît après le
    // montage, et ce test tient la règle.
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).not.toContain('/create/plateformes');
  });

  it('ne montre aucun squelette ni pourcentage inventé', () => {
    const html = renderToStaticMarkup(<NotFound />);

    expect(html).not.toContain('pf-bar-fill');
    expect(html).not.toContain('aria-valuenow');
  });
});

describe('RouteError', () => {
  it('donne les deux gestes : réessayer et revenir', () => {
    const html = renderToStaticMarkup(
      <RouteError
        error={Object.assign(new Error('boom'), { digest: 'abc123' })}
        reset={() => {}}
      />,
    );

    expect(html).toContain('Cet écran s’est arrêté');
    expect(html).toContain('Réessayer');
    expect(html).toContain('Accueil');
    expect(html).toContain('role="alert"');
    // Le digest n'est pas traduit : c'est la valeur qui relie l'écran au journal.
    expect(html).toContain('abc123');
  });
});

describe('Loading', () => {
  it('dit qu’un travail est en cours, sans dessiner la page qui arrive', () => {
    const html = renderToStaticMarkup(<Loading />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('pf-bar-indeterminate');
    // Indéterminée : aucun pourcentage n'est connu, donc aucun n'est affiché.
    expect(html).not.toContain('aria-valuenow');
    expect(html).not.toContain('pf-bar-fill');
  });
});

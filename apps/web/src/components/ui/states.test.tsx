import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ErrorState } from './error-state';
import { Illustration } from './illustration';
import { LoadingLine, ProgressPanel } from './loading';

/**
 * Les états de la fondation : l'arrêt, le vide, l'attente.
 *
 * Rendus sans DOM (`renderToStaticMarkup`) : c'est le HTML que le serveur
 * envoie, donc ce qu'un lecteur d'écran annonce avant toute hydratation. Ce
 * qui se vérifie ici est ce qui doit tenir sans JavaScript — le reste est du
 * ressort des tests d'écran.
 */

describe('ErrorState', () => {
  it('annonce l’arrêt, explique et donne la sortie', () => {
    const html = renderToStaticMarkup(
      <ErrorState
        actions={<button type="button">Réessayer</button>}
        body="Rien n’a été écrit sur le disque."
        title="Cet écran s’est arrêté"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('Cet écran s’est arrêté');
    expect(html).toContain('Rien n’a été écrit sur le disque.');
    expect(html).toContain('Réessayer');
  });

  it('affiche les refus du moteur tels quels, sans les traduire', () => {
    const html = renderToStaticMarkup(
      <ErrorState issues={['next ne va pas avec vite', 'prisma exige postgres']} title="Refus" />,
    );

    expect(html).toContain('next ne va pas avec vite');
    expect(html).toContain('prisma exige postgres');
    expect(html.match(/pf-error/g)).toHaveLength(2);
  });

  it('ne laisse pas de liste vide quand il n’y a rien à dire', () => {
    const html = renderToStaticMarkup(<ErrorState issues={[]} title="Refus" />);

    expect(html).not.toContain('<ul');
    expect(html).not.toContain('pf-error');
  });
});

describe('Illustration', () => {
  it('est décorative : aucun lecteur d’écran ne la lit', () => {
    const html = renderToStaticMarkup(<Illustration name="lost" />);

    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('<title>');
  });

  it('change de tracé selon le nom demandé', () => {
    const forge = renderToStaticMarkup(<Illustration name="forge" />);
    const lost = renderToStaticMarkup(<Illustration name="lost" />);
    const empty = renderToStaticMarkup(<Illustration name="empty" />);

    expect(new Set([forge, lost, empty]).size).toBe(3);
  });

  it('tire sa couleur du thème, jamais d’une valeur en dur', () => {
    const html = renderToStaticMarkup(<Illustration name="forge" />);

    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

describe('les indicateurs d’attente', () => {
  it('la ligne nomme le travail en cours et reste annoncée', () => {
    const html = renderToStaticMarkup(<LoadingLine>Lecture de vos dépôts…</LoadingLine>);

    expect(html).toContain('role="status"');
    expect(html).toContain('Lecture de vos dépôts…');
    expect(html).toContain('pf-spinner');
  });

  it('le panneau ne montre un pourcentage que lorsqu’il est connu', () => {
    const known = renderToStaticMarkup(
      <ProgressPanel detail="1 284 / 3 002" title="Clone" value={42} />,
    );
    const unknown = renderToStaticMarkup(<ProgressPanel title="Clone" />);

    expect(known).toContain('42 %');
    expect(known).toContain('1 284 / 3 002');
    expect(known).toContain('aria-valuenow="42"');
    expect(unknown).not.toContain('aria-valuenow');
    expect(unknown).toContain('pf-bar-indeterminate');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from './draft-provider';
import { Progress, ScreenShell, StepShell } from './shell';

/**
 * Le cadre commun des écrans : progression, navigation, raison bloquante.
 *
 * Rendu sans DOM (`renderToStaticMarkup`) : c'est le HTML que le serveur envoie,
 * donc ce que voit un lecteur d'écran avant toute hydratation. Un `Continuer`
 * grisé sans explication est un cul-de-sac — le test l'interdit.
 */
function render(node: React.ReactElement): string {
  return renderToStaticMarkup(<DraftProvider>{node}</DraftProvider>);
}

describe('StepShell', () => {
  it('affiche l’étape, la progression et les deux liens de navigation', () => {
    const html = render(
      <StepShell step="target" title="Plateformes cibles" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('Plateformes cibles');
    expect(html).toContain('aria-label="Progression du parcours"');
    // L'étape courante est annoncée, pas seulement colorée.
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/create/type"');
  });

  it('dit pourquoi on ne peut pas avancer, et désactive le lien', () => {
    const html = render(
      <StepShell step="target" title="Plateformes cibles" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('Choisissez au moins une plateforme.');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="status"');
  });

  it('sur la première étape, « Précédent » ramène à l’accueil et non dans le vide', () => {
    const html = render(
      <StepShell step="create" title="Créer un projet" description="Nommez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('href="/"');
    expect(html).not.toContain('href="/create/create"');
  });

  it('hidePrevious verrouille la navigation : accueil seul, jamais « Précédent » ni « Continuer »', () => {
    const html = render(
      <StepShell step="report" title="Rapport" description="Ce qui a été écrit." hidePrevious>
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('Accueil');
    expect(html).not.toContain('Précédent');
    expect(html).not.toContain('Continuer');
  });

  it('la progression ne propose aucun saut en avant : la progression est une liste, pas un menu', () => {
    const html = renderToStaticMarkup(<Progress current="stack" />);
    expect(html).not.toContain('<a ');
  });
});

describe('ScreenShell', () => {
  it('rend le titre, la description et les actions', () => {
    const html = renderToStaticMarkup(
      <ScreenShell
        title="Dependency Graph"
        description="Vue avancée."
        actions={<span>action</span>}
      >
        <p>graphe</p>
      </ScreenShell>,
    );

    expect(html).toContain('Dependency Graph');
    expect(html).toContain('Vue avancée.');
    expect(html).toContain('action');
  });

  it('sans description, ne laisse pas de paragraphe vide', () => {
    const html = renderToStaticMarkup(
      <ScreenShell title="Accueil">
        <p>contenu</p>
      </ScreenShell>,
    );

    expect(html).not.toContain('pf-subtitle');
  });
});

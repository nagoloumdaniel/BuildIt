import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import InfrastructurePage from './page';

describe('écran Infrastructure (§6.9)', () => {
  it('rend le cadre de l’étape et les deux cases Docker / CI-CD', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <InfrastructurePage />
      </DraftProvider>,
    );

    // 8e étape du parcours (§6 écran 9 : le menu et le graphe ne sont pas des étapes).
    expect(html).toContain('Étape 8 sur 12');
    expect(html).toContain('Infrastructure');
    expect(html).toContain('Docker');
    expect(html).toContain('Intégration continue');
    expect(html).toContain('type="checkbox"');
  });

  it('dit où va le cloud cible, sans inventer de champ au brouillon', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <InfrastructurePage />
      </DraftProvider>,
    );

    expect(html).toContain('Cloud cible');
    // La catégorie du catalogue qui porte l’hébergeur.
    expect(html).toContain('hosting');
  });

  it('ne détaille plus la traduction brouillon → manifest : le plan du projet la montre', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <InfrastructurePage />
      </DraftProvider>,
    );

    expect(html).not.toContain('Ce que l’écran écrit dans le manifest');
    expect(html).not.toContain('github-actions');
  });

  it('marque les trois sections qu’un crayon du plan peut viser', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <InfrastructurePage />
      </DraftProvider>,
    );

    // Docker, CI et le cloud cible : chacun s'arrête sous l'en-tête collant.
    expect(html.match(/pf-deep-target/g)?.length).toBe(3);
  });
});

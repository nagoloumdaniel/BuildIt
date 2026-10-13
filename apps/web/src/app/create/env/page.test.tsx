import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import EnvPage from './page';

/**
 * §6.8 et §24 : l'écran montre les variables requises **sans jamais afficher ni
 * stocker de valeur**. Ces tests en font une propriété de la page : le rendu ne
 * contient aucun champ de saisie, donc aucune valeur ne peut transiter par lui.
 */
describe('écran Environment & Secrets (§6.8, §24)', () => {
  it('rend le cadre de l’étape et annonce son objet', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <EnvPage />
      </DraftProvider>,
    );

    expect(html).toContain('Étape 7 sur 12');
    expect(html).toContain('Environnement');
    expect(html).toContain('.env.local');
    expect(html).toContain('commit');
  });

  it('n’offre qu’un champ : le **nom** d’une variable, jamais sa valeur', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <EnvPage />
      </DraftProvider>,
    );

    expect(html.match(/<input/g)).toHaveLength(1);
    expect(html).toContain('Nom de la variable');
    expect(html).not.toContain('<textarea');
    expect(html).not.toMatch(/type="password"/);
  });

  it('dit que seuls les noms sont conservés, et où mettre les valeurs', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <EnvPage />
      </DraftProvider>,
    );

    expect(html).toContain('noms');
    expect(html).toContain('gitignore');
    expect(html).toContain('valeur');
  });
});

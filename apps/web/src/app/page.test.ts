import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from './page';

describe('page racine', () => {
  it('annonce le produit et les trois chemins du menu', () => {
    const html = renderToStaticMarkup(Home());
    expect(html).toContain('Project Factory');
    expect(html).toContain('Créer un projet');
    expect(html).toContain('Cloner un projet');
    expect(html).toContain('Ouvrir un projet local');
  });
});

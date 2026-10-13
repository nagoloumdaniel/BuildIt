import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EN, FR } from '../../lib/i18n/messages';
import { ShareLinkRow } from './link-row';

/**
 * La ligne de partage, rendue sans DOM : on prouve sa forme (un bouton, puis
 * le champ et sa copie sur la même ligne). Les retours temporisés (« Lien
 * créé », « Lien copié ») dépendent d'un clic et ne se rendent pas ici.
 */
describe('ShareLinkRow', () => {
  it('avant création : le bouton seul, sans champ ni copie', () => {
    const html = renderToStaticMarkup(<ShareLinkRow link={null} onCreate={() => true} />);

    expect(html).toContain('Créer un lien de partage');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Copier le lien');
  });

  it('après création : le champ en lecture seule et la copie, à droite du bouton', () => {
    const html = renderToStaticMarkup(
      <ShareLinkRow link="https://trybuildit.vercel.app/share#abc" onCreate={() => true} />,
    );

    const button = html.indexOf('pf-share-create');
    const field = html.indexOf('pf-share-field');
    expect(button).toBeGreaterThan(-1);
    expect(field).toBeGreaterThan(button);
    expect(html).toContain('value="https://trybuildit.vercel.app/share#abc"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('aria-label="Copier le lien"');
    expect(html).toContain('data-icon="copy"');
  });

  it('garde la place de « Lien créé » sans l’afficher ni l’annoncer au repos', () => {
    const html = renderToStaticMarkup(<ShareLinkRow link={null} onCreate={() => true} />);
    expect(html).toContain('data-shown="false" aria-hidden="true"');
    expect(html).toContain('Lien créé');
  });

  it('a ses deux langues', () => {
    expect(EN.blueprintShare.copied).toBe('Link copied to clipboard');
    expect(FR.blueprintShare.copied).toBe('Lien copié dans le presse-papiers');
  });
});

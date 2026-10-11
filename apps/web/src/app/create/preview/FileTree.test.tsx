import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FileTree } from './FileTree';
import { buildFileTree } from './tree';

/**
 * L'arborescence est un composant **pur** : il reçoit son arbre, il ne le lit
 * pas. C'est ce qui le rend vérifiable sans DOM (`renderToStaticMarkup`), et
 * c'est le même contrat que `ToastList`.
 */
describe('FileTree', () => {
  it('affiche les dossiers et les fichiers, chemins compris', () => {
    const html = renderToStaticMarkup(
      FileTree({ nodes: buildFileTree(['src/app/page.tsx', 'package.json']) }),
    );

    expect(html).toContain('src/');
    expect(html).toContain('app/');
    expect(html).toContain('page.tsx');
    expect(html).toContain('package.json');
    expect(html).toContain('Arborescence des fichiers à générer');
  });

  it('un plan vide rend une liste vide, pas un cadre muet', () => {
    const html = renderToStaticMarkup(FileTree({ nodes: [] }));
    expect(html).toContain('<ul');
    expect(html).not.toContain('page.tsx');
  });
});

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

  it('un dossier racine connu porte sa phrase (§6.12)', () => {
    const html = renderToStaticMarkup(
      FileTree({ nodes: buildFileTree(['apps/web/package.json', 'packages/ui/index.ts']) }),
    );
    expect(html).toContain('Les applications déployables du projet');
    expect(html).toContain('Le code partagé entre applications');
  });

  it('ne met jamais de phrase sur un dossier imbriqué, même au même nom qu’une racine connue', () => {
    // `apps` est connu à la racine ; un dossier `apps` plus profond dans
    // l'arbre ne doit recevoir aucune phrase — ce n'est pas la même chose.
    const html = renderToStaticMarkup(FileTree({ nodes: buildFileTree(['src/apps/legacy.ts']) }));
    expect(html).not.toContain('Les applications déployables du projet');
  });

  it('un dossier racine sans phrase connue reste silencieux', () => {
    const html = renderToStaticMarkup(FileTree({ nodes: buildFileTree(['dossier-inconnu/x.ts']) }));
    expect(html).toContain('dossier-inconnu/');
    expect(html).not.toContain('pf-hint');
  });

  it('un fichier racine ne reçoit jamais de phrase', () => {
    const html = renderToStaticMarkup(FileTree({ nodes: buildFileTree(['README.md']) }));
    expect(html).not.toContain('pf-hint');
  });
});

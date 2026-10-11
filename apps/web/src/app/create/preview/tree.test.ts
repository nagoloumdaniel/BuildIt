import { describe, expect, it } from 'vitest';
import { buildFileTree, countFiles, type TreeNode } from './tree';

/**
 * L'arborescence de l'aperçu (§6.12) est une **fonction pure** : elle reçoit
 * des chemins, elle rend un arbre. Aucun accès au disque, aucun contenu
 * inventé — c'est `previewManifestAction` qui dit quels fichiers existeront.
 */

/** Tous les chemins d'un arbre, profondeur d'abord — pour comparer d'un coup. */
function paths(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.path, ...paths(node.children)]);
}

function names(nodes: readonly TreeNode[]): string[] {
  return nodes.map((node) => node.name);
}

describe('buildFileTree — des chemins vers un arbre', () => {
  it('un plan vide rend une arborescence vide', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('des fichiers plats sont triés par nom, sans dossier inventé', () => {
    const tree = buildFileTree(['c.txt', 'a.txt', 'b.txt']);
    expect(names(tree)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(tree.every((node) => node.kind === 'file')).toBe(true);
  });

  it('les dossiers se composent, et les dossiers passent avant les fichiers', () => {
    const tree = buildFileTree([
      'package.json',
      'src/app/page.tsx',
      'src/lib/util.ts',
      'readme.md',
    ]);

    expect(names(tree)).toEqual(['src', 'package.json', 'readme.md']);
    const src = tree[0];
    expect(src?.kind).toBe('directory');
    expect(names(src?.children ?? [])).toEqual(['app', 'lib']);
    expect(paths(tree)).toContain('src/app/page.tsx');
    expect(paths(tree)).toContain('src/lib/util.ts');
  });

  it('l’ordre d’entrée ne change pas la sortie', () => {
    const files = [
      'src/app/page.tsx',
      'src/lib/util.ts',
      'github/workflows/ci.yml',
      'package.json',
    ];
    const forward = buildFileTree(files);
    const backward = buildFileTree([...files].reverse());

    expect(forward).toEqual(backward);
    // Les dossiers d'abord, chacun trié ; la profondeur suit son dossier.
    expect(names(forward)).toEqual(['github', 'src', 'package.json']);
    expect(paths(forward)).toEqual([
      'github',
      'github/workflows',
      'github/workflows/ci.yml',
      'src',
      'src/app',
      'src/app/page.tsx',
      'src/lib',
      'src/lib/util.ts',
      'package.json',
    ]);
  });

  it('les doublons sont fusionnés en un seul nœud', () => {
    const tree = buildFileTree([
      'package.json',
      'package.json',
      'src/app/page.tsx',
      'src/app/page.tsx',
    ]);
    expect(paths(tree)).toEqual(['src', 'src/app', 'src/app/page.tsx', 'package.json']);
  });

  it('un nom qui apparaît aussi comme dossier devient un dossier', () => {
    // `planProject` ne produit pas ce cas, mais une entrée hostile ne doit pas
    // casser l'écran : le dossier l'emporte, le fichier homonyme est absorbé.
    const tree = buildFileTree(['src', 'src/app.ts']);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.kind).toBe('directory');
    expect(names(tree[0]?.children ?? [])).toEqual(['app.ts']);
  });

  it('accepte les séparateurs Windows et normalise le chemin affiché', () => {
    const tree = buildFileTree(['src\\app\\page.tsx']);
    expect(paths(tree)).toEqual(['src', 'src/app', 'src/app/page.tsx']);
  });

  it('ignore les segments vides et les « . »', () => {
    const tree = buildFileTree(['src//app.ts', './package.json', '']);
    expect(paths(tree)).toEqual(['src', 'src/app.ts', 'package.json']);
  });
});

describe('countFiles — ce que l’écran annonce', () => {
  it('compte les fichiers, pas les dossiers', () => {
    const tree = buildFileTree(['src/app/page.tsx', 'src/lib/util.ts', 'package.json']);
    expect(countFiles(tree)).toBe(3);
  });

  it('ne compte rien sur un plan vide', () => {
    expect(countFiles([])).toBe(0);
  });
});

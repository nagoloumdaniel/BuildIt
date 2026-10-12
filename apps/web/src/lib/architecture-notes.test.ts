import { planProject } from '@buildit/generator';
import type { Manifest } from '@buildit/manifest';
import { PRESETS } from '@buildit/presets';
import { describe, expect, it } from 'vitest';
import {
  type ArchitectureNode,
  buildArchitecture,
  buildFileTree,
  countFiles,
  directoryPaths,
  indexPlan,
  initiallyOpen,
  NOTE_RULES,
  type NoteRule,
  noteFor,
  scopeOf,
  type TreeNode,
  uncoveredRoots,
} from './architecture-notes';
import { EN, FR } from './i18n/messages';

/**
 * L'architecture affichée est une **fonction pure** du plan : des chemins
 * entrent, un arbre annoté sort. Le moteur, lui, est le vrai : les presets
 * passent par `planProject`, comme l'adaptateur `engine.ts` le fait pour
 * l'écran. Une phrase qui décrirait un fichier que le générateur ne produit
 * plus, ou un nouveau fichier racine sans phrase, se voit ici.
 */

/** Tous les chemins d'un arbre, profondeur d'abord, pour comparer d'un coup. */
function paths(nodes: readonly TreeNode[]): string[] {
  return nodes.flatMap((node) => [node.path, ...paths(node.children)]);
}

function names(nodes: readonly TreeNode[]): string[] {
  return nodes.map((node) => node.name);
}

function find(nodes: readonly ArchitectureNode[], path: string): ArchitectureNode | undefined {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }
    const inner = find(node.children, path);
    if (inner !== undefined) {
      return inner;
    }
  }
  return undefined;
}

function planOf(manifest: Manifest, recipes: readonly string[] = []): readonly string[] {
  const result = planProject(manifest, '/pf-preview', { recipes });
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join('\n'));
  }
  return result.value.plan.files.map((file) => file.path);
}

describe('buildFileTree : des chemins vers un arbre', () => {
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
    expect(names(tree[0]?.children ?? [])).toEqual(['app', 'lib']);
  });

  it('l’ordre d’entrée ne change pas la sortie', () => {
    const files = [
      'src/app/page.tsx',
      'src/lib/util.ts',
      'github/workflows/ci.yml',
      'package.json',
    ];
    const forward = buildFileTree(files);
    expect(forward).toEqual(buildFileTree([...files].reverse()));
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
    const tree = buildFileTree(['package.json', 'package.json', 'src/a.ts', 'src/a.ts']);
    expect(paths(tree)).toEqual(['src', 'src/a.ts', 'package.json']);
  });

  it('un nom qui apparaît aussi comme dossier devient un dossier', () => {
    // `planProject` ne produit pas ce cas, mais une entrée hostile ne doit pas
    // casser l'écran : le dossier l'emporte, le fichier homonyme est absorbé.
    const tree = buildFileTree(['src', 'src/app.ts']);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.kind).toBe('directory');
    expect(names(tree[0]?.children ?? [])).toEqual(['app.ts']);
  });

  it('accepte les séparateurs Windows, ignore les segments vides et les « . »', () => {
    expect(paths(buildFileTree(['src\\app\\page.tsx']))).toEqual([
      'src',
      'src/app',
      'src/app/page.tsx',
    ]);
    expect(paths(buildFileTree(['src//app.ts', './package.json', '']))).toEqual([
      'src',
      'src/app.ts',
      'package.json',
    ]);
  });

  it('countFiles compte les fichiers, pas les dossiers', () => {
    expect(countFiles(buildFileTree(['src/a/b.ts', 'src/c.ts', 'package.json']))).toBe(3);
    expect(countFiles([])).toBe(0);
  });
});

describe('scopeOf : le chemin vu depuis son application', () => {
  it('un fichier d’application de monorepo se lit depuis l’application', () => {
    expect(scopeOf('apps/web/lib/db.ts')).toEqual({ prefix: 'apps/web', relative: 'lib/db.ts' });
    expect(scopeOf('packages/shared/src/index.ts')).toEqual({
      prefix: 'packages/shared',
      relative: 'src/index.ts',
    });
  });

  it('le dossier d’une application, et tout le reste, se lisent depuis la racine', () => {
    expect(scopeOf('apps/web')).toEqual({ prefix: '', relative: 'apps/web' });
    expect(scopeOf('apps')).toEqual({ prefix: '', relative: 'apps' });
    expect(scopeOf('lib/db.ts')).toEqual({ prefix: '', relative: 'lib/db.ts' });
    expect(scopeOf('src/apps/web/x.ts')).toEqual({ prefix: '', relative: 'src/apps/web/x.ts' });
  });
});

describe('noteFor : la règle la plus spécifique l’emporte', () => {
  const index = indexPlan(['app/page.tsx', 'next.config.ts', 'src/app.ts', 'src/app.test.ts']);

  it('un chemin exact', () => {
    expect(noteFor('app/page.tsx', 'file', index)).toBe('homePage');
    expect(noteFor('README.md', 'file', index)).toBe('readme');
  });

  it('un motif de nom de fichier (`next.config.*`, `.github/workflows/*.yml`)', () => {
    expect(noteFor('next.config.ts', 'file', index)).toBe('nextConfig');
    expect(noteFor('next.config.mjs', 'file', index)).toBe('nextConfig');
    expect(noteFor('.github/workflows/ci.yml', 'file', index)).toBe('ci');
    expect(noteFor('.github/workflows/nested/ci.yml', 'file', index)).toBeUndefined();
  });

  it('un motif « n’importe où » cède devant un chemin ancré', () => {
    expect(noteFor('lib/signups.test.ts', 'file', index)).toBe('unitTest');
    expect(noteFor('deep/in/tree/x.test.ts', 'file', index)).toBe('unitTest');
    expect(noteFor('src/app.test.ts', 'file', index)).toBe('honoTest');
  });

  it('le type compte : un dossier n’hérite pas d’une règle de fichier', () => {
    expect(noteFor('README.md', 'directory', index)).toBeUndefined();
    expect(noteFor('lib', 'file', index)).toBeUndefined();
  });

  it('une condition de stack choisit la phrase du dossier `app`', () => {
    expect(noteFor('app', 'directory', index)).toBe('appRouter');
    // Une application Vite range une feuille de style dans `app/` : ce n'est
    // pas l'App Router, et l'écran ne doit pas le prétendre.
    expect(noteFor('app', 'directory', indexPlan(['app/globals.css']))).toBe('appStyles');
  });

  it('une condition s’évalue dans la même application, pas dans une voisine', () => {
    const mono = indexPlan([
      'apps/web/next.config.ts',
      'apps/web/app/page.tsx',
      'apps/api/app/x.css',
    ]);
    expect(noteFor('apps/web/app', 'directory', mono)).toBe('appRouter');
    expect(noteFor('apps/api/app', 'directory', mono)).toBe('appStyles');
  });

  it('`src` n’est décrit que là où le gabarit Hono l’a produit', () => {
    expect(noteFor('src', 'directory', index)).toBe('honoSrc');
    expect(noteFor('src', 'directory', indexPlan(['src/main.ts']))).toBeUndefined();
    expect(noteFor('packages/shared/src/index.ts', 'file', index)).toBeUndefined();
  });

  it('un chemin inconnu reste muet', () => {
    expect(noteFor('dossier-inconnu', 'directory', index)).toBeUndefined();
  });

  it('à spécificité égale, la première règle gagne', () => {
    const rules: readonly NoteRule[] = [
      { match: 'x.ts', note: 'readme' },
      { match: 'x.ts', note: 'gitignore' },
    ];
    expect(noteFor('x.ts', 'file', index, rules)).toBe('readme');
  });

  it('les caractères spéciaux d’un motif sont pris à la lettre', () => {
    const rules: readonly NoteRule[] = [{ match: 'a.(b)', note: 'readme' }];
    expect(noteFor('a.(b)', 'file', index, rules)).toBe('readme');
    expect(noteFor('aX(b)', 'file', index, rules)).toBeUndefined();
  });
});

describe('buildArchitecture : l’arbre annoté', () => {
  const files = [
    'components/ui/button.tsx',
    'components/ui/card.tsx',
    'lib/db.ts',
    'README.md',
    'inconnu/fichier.txt',
  ];
  const tree = buildArchitecture(files);

  it('compte les fichiers de chaque dossier, toutes profondeurs', () => {
    expect(find(tree, 'components')?.fileCount).toBe(2);
    expect(find(tree, 'components/ui')?.fileCount).toBe(2);
    expect(find(tree, 'README.md')?.fileCount).toBe(1);
  });

  it('porte la profondeur de chaque nœud', () => {
    expect(find(tree, 'components')?.depth).toBe(0);
    expect(find(tree, 'components/ui/button.tsx')?.depth).toBe(2);
  });

  it('un fichier sans rien de propre à dire n’a pas de phrase', () => {
    expect(find(tree, 'components/ui')?.note).toBe('componentsUi');
    expect(find(tree, 'components/ui/button.tsx')?.note).toBeUndefined();
    expect(find(tree, 'inconnu')?.note).toBeUndefined();
  });

  it('une phrase dite par un ancêtre ne se répète pas plus bas', () => {
    const rules: readonly NoteRule[] = [
      { match: 'lib', note: 'lib' },
      { match: 'lib/*', note: 'lib' },
    ];
    const local = buildArchitecture(['lib/db.ts'], rules);
    expect(find(local, 'lib')?.note).toBe('lib');
    expect(find(local, 'lib/db.ts')?.note).toBeUndefined();
  });

  it('la liste des racines sans phrase', () => {
    expect(uncoveredRoots(tree)).toEqual(['inconnu']);
  });

  it('les dossiers, et ceux ouverts à l’arrivée', () => {
    expect(directoryPaths(tree)).toEqual(['components', 'components/ui', 'inconnu', 'lib']);
    expect([...initiallyOpen(tree)]).toEqual(['components', 'inconnu', 'lib']);
  });
});

describe('la base de connaissance face aux vrais plans du moteur', () => {
  const cases = PRESETS.flatMap((preset) => [
    { label: preset.id, files: planOf(preset.manifest('demo')) },
    { label: `${preset.id} + recettes`, files: planOf(preset.manifest('demo'), preset.recipes) },
  ]);

  it.each(cases)('$label : chaque dossier et chaque fichier racine a sa phrase', ({ files }) => {
    expect(files.length).toBeGreaterThan(0);
    expect(uncoveredRoots(buildArchitecture(files))).toEqual([]);
  });

  it('le monorepo décrit ses applications et le contrat partagé', () => {
    const fullstack = PRESETS.find((preset) => preset.id === 'fullstack');
    const tree = buildArchitecture(planOf(fullstack?.manifest('demo') as Manifest));
    expect(find(tree, 'apps/web')?.note).toBe('appWeb');
    expect(find(tree, 'apps/api')?.note).toBe('appApi');
    expect(find(tree, 'packages/shared')?.note).toBe('shared');
    expect(find(tree, 'apps/web/app')?.note).toBe('appRouter');
    expect(find(tree, 'apps/web/lib/db.ts')?.note).toBe('db');
    expect(find(tree, 'apps/api/src/contract.test.ts')?.note).toBe('contractTest');
    expect(find(tree, 'package.json')?.note).toBe('packageJsonMonorepo');
    expect(find(tree, 'apps/web/package.json')?.note).toBe('packageJson');
    expect(find(tree, 'pnpm-workspace.yaml')?.note).toBe('pnpmWorkspaceMonorepo');
  });

  it('une application seule n’a pas les phrases du monorepo', () => {
    const saas = PRESETS.find((preset) => preset.id === 'saas');
    const tree = buildArchitecture(planOf(saas?.manifest('demo') as Manifest));
    expect(find(tree, 'package.json')?.note).toBe('packageJson');
    expect(find(tree, 'pnpm-workspace.yaml')?.note).toBe('pnpmWorkspace');
    expect(find(tree, 'src')).toBeUndefined();
  });

  it('chaque règle pointe vers une phrase écrite dans les deux langues', () => {
    for (const rule of NOTE_RULES) {
      expect(FR.architecture.notes[rule.note], rule.note).toBeTruthy();
      expect(EN.architecture.notes[rule.note], rule.note).toBeTruthy();
    }
  });

  it('chaque phrase de la base sert au moins une règle', () => {
    const used = new Set(NOTE_RULES.map((rule) => rule.note));
    const unused = Object.keys(FR.architecture.notes).filter((key) => !used.has(key as never));
    expect(unused).toEqual([]);
  });
});

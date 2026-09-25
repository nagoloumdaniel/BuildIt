import type { Manifest } from '@project-factory/manifest';
import type { RegistryEntry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { buildScaffold } from './scaffold.js';

function entry(patch: Partial<RegistryEntry> & { id: string }): RegistryEntry {
  return {
    name: patch.id,
    category: 'frontend',
    targets: ['web'],
    status: 'stable',
    generation: 'declared',
    license: 'MIT',
    lastReviewedAt: '2026-09-23',
    ...patch,
  };
}

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'quai3',
  targets: ['web'],
  architecture: 'single-app',
};

function built(manifest: Manifest, entries: RegistryEntry[]) {
  const result = buildScaffold(manifest, entries);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(' | '));
  }
  return result.value;
}

function scaffoldFiles(manifest: Manifest, entries: RegistryEntry[]) {
  return built(manifest, entries).files;
}

function fileNamed(files: readonly { path: string; contents: string }[], path: string): string {
  const found = files.find((file) => file.path === path);
  if (found === undefined) {
    throw new Error(`fichier absent : ${path} (présents : ${files.map((f) => f.path).join(', ')})`);
  }
  return found.contents;
}

function codesOf(manifest: Manifest, entries: RegistryEntry[]): string[] {
  const result = buildScaffold(manifest, entries);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('fichiers produits', () => {
  it('produit le socle minimal', () => {
    const files = scaffoldFiles(MANIFEST, []);
    expect(files.map((file) => file.path).sort()).toEqual([
      '.env.example',
      '.gitignore',
      'README.md',
      'package.json',
    ]);
  });

  it('ajoute pnpm-workspace.yaml en monorepo', () => {
    const files = scaffoldFiles({ ...MANIFEST, architecture: 'monorepo' }, []);
    expect(files.map((file) => file.path)).toContain('pnpm-workspace.yaml');
  });

  it('n’ajoute pas pnpm-workspace.yaml hors monorepo', () => {
    expect(scaffoldFiles(MANIFEST, []).map((file) => file.path)).not.toContain(
      'pnpm-workspace.yaml',
    );
  });

  it('ajoute turbo.json quand Turborepo est sélectionné', () => {
    const files = scaffoldFiles({ ...MANIFEST, architecture: 'monorepo' }, [
      entry({ id: 'turborepo', category: 'monorepo' }),
    ]);
    expect(files.map((file) => file.path)).toContain('turbo.json');
  });

  it('chaque fichier indique son origine — traçabilité du §6.14', () => {
    for (const file of scaffoldFiles(MANIFEST, [])) {
      expect(file.source.length, `origine manquante : ${file.path}`).toBeGreaterThan(0);
    }
  });
});

describe('package.json', () => {
  it('porte le nom du projet', () => {
    const json = JSON.parse(fileNamed(scaffoldFiles(MANIFEST, []), 'package.json')) as {
      name: string;
    };
    expect(json.name).toBe('quai3');
  });

  it('est du JSON valide et se termine par un saut de ligne', () => {
    const contents = fileNamed(scaffoldFiles(MANIFEST, []), 'package.json');
    expect(() => JSON.parse(contents)).not.toThrow();
    expect(contents.endsWith('\n')).toBe(true);
  });

  it('déclare les dépendances de la stack', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({ id: 'next', packages: ['next'], packageRanges: { next: '^15.0.0' } }),
    ]);
    const json = JSON.parse(fileNamed(files, 'package.json')) as {
      dependencies: Record<string, string>;
    };
    expect(json.dependencies).toEqual({ next: '^15.0.0' });
  });

  it('sépare les dépendances de développement', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({
        id: 'vitest',
        category: 'testing',
        devPackages: ['vitest'],
        packageRanges: { vitest: '^3.0.0' },
      }),
    ]);
    const json = JSON.parse(fileNamed(files, 'package.json')) as {
      devDependencies: Record<string, string>;
    };
    expect(json.devDependencies).toEqual({ vitest: '^3.0.0' });
  });

  it('ajoute les scripts apportés par les technologies choisies', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({ id: 'vitest', category: 'testing' }),
      entry({ id: 'biome', category: 'linting' }),
    ]);
    const json = JSON.parse(fileNamed(files, 'package.json')) as {
      scripts: Record<string, string>;
    };
    expect(json.scripts['test']).toBe('vitest run');
    expect(json.scripts['lint']).toBe('biome check .');
  });

  it('n’ajoute aucun script pour une technologie sans intégration connue', () => {
    const files = scaffoldFiles(MANIFEST, [entry({ id: 'postgresql', category: 'database' })]);
    const json = JSON.parse(fileNamed(files, 'package.json')) as {
      scripts: Record<string, string>;
    };
    expect(json.scripts).toEqual({});
  });

  it('refuse deux technologies qui réclament le même script', () => {
    expect(
      codesOf(MANIFEST, [
        entry({ id: 'vitest', category: 'testing' }),
        entry({ id: 'jest', category: 'testing' }),
      ]),
    ).toContain('GEN_SCRIPT_CONFLICT');
  });

  it('nomme les deux technologies et le script en conflit', () => {
    const result = buildScaffold(MANIFEST, [
      entry({ id: 'vitest', category: 'testing' }),
      entry({ id: 'jest', category: 'testing' }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const message = result.issues[0]?.message ?? '';
      expect(message).toContain('test');
      expect(message).toContain('vitest');
      expect(message).toContain('jest');
    }
  });

  it('déclare le plancher Node et le gestionnaire de paquets', () => {
    const json = JSON.parse(fileNamed(scaffoldFiles(MANIFEST, []), 'package.json')) as {
      engines: { node: string };
      packageManager: string;
    };
    expect(json.engines.node).toMatch(/^>=/);
    expect(json.packageManager).toMatch(/^pnpm@/);
  });

  it('trie les clés — deux générations identiques donnent le même fichier', () => {
    const a = fileNamed(
      scaffoldFiles(MANIFEST, [entry({ id: 'vitest', category: 'testing' })]),
      'package.json',
    );
    const b = fileNamed(
      scaffoldFiles(MANIFEST, [entry({ id: 'vitest', category: 'testing' })]),
      'package.json',
    );
    expect(a).toBe(b);
  });
});

/**
 * §24 : aucune valeur sensible dans un fichier généré. Le registry interdit
 * déjà le signe « = » dans un nom de variable, mais le générateur ne fait pas
 * confiance à son entrée — il revérifie.
 */
describe('.env.example', () => {
  it('liste les variables des technologies choisies', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({ id: 'postgresql', category: 'database', env: ['DATABASE_URL'] }),
      entry({ id: 'better-auth', category: 'authentication', env: ['BETTER_AUTH_SECRET'] }),
    ]);
    const contents = fileNamed(files, '.env.example');
    expect(contents).toContain('DATABASE_URL=');
    expect(contents).toContain('BETTER_AUTH_SECRET=');
  });

  it('n’attribue aucune valeur', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({ id: 'postgresql', category: 'database', env: ['DATABASE_URL'] }),
    ]);
    for (const line of fileNamed(files, '.env.example').split('\n')) {
      if (line.length === 0 || line.startsWith('#')) {
        continue;
      }
      expect(line.endsWith('='), `valeur présente : ${line}`).toBe(true);
    }
  });

  it('trie les variables et ne les répète pas', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({ id: 'a', env: ['ZED', 'ALPHA'] }),
      entry({ id: 'b', category: 'orm', env: ['ALPHA'] }),
    ]);
    const names = fileNamed(files, '.env.example')
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => line.replace('=', ''));
    expect(names).toEqual(['ALPHA', 'ZED']);
  });

  it('refuse une variable qui porte une valeur — défense en profondeur', () => {
    expect(
      codesOf(MANIFEST, [
        entry({ id: 'a', env: ['AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIK7MDENGbPxRfiCYEXAMPLEKEY'] }),
      ]),
    ).toContain('GEN_SECRET_IN_ENV');
  });

  it('refuse une variable contenant une espace', () => {
    expect(codesOf(MANIFEST, [entry({ id: 'a', env: ['MA VARIABLE'] })])).toContain(
      'GEN_SECRET_IN_ENV',
    );
  });

  it('existe même sans aucune variable', () => {
    expect(fileNamed(scaffoldFiles(MANIFEST, []), '.env.example').length).toBeGreaterThan(0);
  });
});

describe('README.md', () => {
  it('porte le nom du projet', () => {
    expect(fileNamed(scaffoldFiles(MANIFEST, []), 'README.md')).toContain('quai3');
  });

  it('énonce le principe de non-dépendance — §1', () => {
    const readme = fileNamed(scaffoldFiles(MANIFEST, []), 'README.md');
    expect(readme).toContain('Project Factory');
    expect(readme.toLowerCase()).toContain('autonome');
  });

  it('liste les technologies du projet', () => {
    const readme = fileNamed(
      scaffoldFiles(MANIFEST, [entry({ id: 'next', name: 'Next.js' })]),
      'README.md',
    );
    expect(readme).toContain('Next.js');
  });
});

describe('buildScaffold ne lève jamais', () => {
  it('sur une stack vide', () => {
    expect(buildScaffold(MANIFEST, []).ok).toBe(true);
  });

  it('sur des fiches sans aucun champ optionnel', () => {
    expect(() => buildScaffold(MANIFEST, [entry({ id: 'a' })])).not.toThrow();
  });
});

/**
 * Le résolveur de dépendances calcule les avertissements « version non
 * épinglée ». Le socle les consommait sans les transmettre : l'avertissement
 * existait, personne ne le voyait. Un contrôle silencieux est pire que pas de
 * contrôle, parce qu'il donne l'illusion d'exister.
 */
describe('remontée des avertissements', () => {
  it('transmet l’avertissement de version non épinglée', () => {
    const result = built(MANIFEST, [entry({ id: 'next', packages: ['react'] })]);
    expect(result.warnings.map((warning) => warning.code)).toContain('GEN_UNPINNED_DEPENDENCY');
  });

  it('ne signale rien quand tout est épinglé', () => {
    const result = built(MANIFEST, [
      entry({ id: 'next', packages: ['next'], packageRanges: { next: '^15.0.0' } }),
    ]);
    expect(result.warnings).toEqual([]);
  });
});

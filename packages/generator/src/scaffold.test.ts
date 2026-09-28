import type { Manifest } from '@project-factory/manifest';
import type { Recipe } from '@project-factory/recipes';
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
    expect(json.scripts['test']).toBe('vitest run --passWithNoTests');
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

describe('problèmes transmis par le résolveur de dépendances', () => {
  it('remonte un conflit de plages sans le reformuler', () => {
    const codes = codesOf(MANIFEST, [
      entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
      entry({ id: 'b', category: 'ui', packages: ['react'], packageRanges: { react: '^18.0.0' } }),
    ]);
    expect(codes).toContain('GEN_DEPENDENCY_CONFLICT');
  });

  it('conserve le message d’origine — c’est le résolveur qui connaît les plages', () => {
    const result = buildScaffold(MANIFEST, [
      entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
      entry({ id: 'b', category: 'ui', packages: ['react'], packageRanges: { react: '^18.0.0' } }),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('^19.0.0');
      expect(result.issues[0]?.message).toContain('^18.0.0');
    }
  });

  it('rapporte les problèmes du socle et ceux des dépendances ensemble', () => {
    const codes = codesOf(MANIFEST, [
      entry({ id: 'vitest', category: 'testing' }),
      entry({ id: 'jest', category: 'testing' }),
      entry({ id: 'a', packages: ['react'], packageRanges: { react: '^19.0.0' } }),
      entry({ id: 'b', category: 'ui', packages: ['react'], packageRanges: { react: '^18.0.0' } }),
    ]);
    expect(codes).toContain('GEN_SCRIPT_CONFLICT');
    expect(codes).toContain('GEN_DEPENDENCY_CONFLICT');
  });
});

/**
 * 5B.1 — le socle doit passer ses propres vérifications.
 *
 * Un preset SaaS réellement généré puis installé échouait à `typecheck` (pas
 * de tsconfig) et à `lint` (formatage par défaut de Biome, en tabulations). La
 * CI générée était rouge avant la première ligne de l'utilisateur. Chaque test
 * ci-dessous verrouille une des causes, sans réseau ; le test de fumée
 * (`pnpm test:smoke`) vérifie l'ensemble pour de vrai.
 */
describe('le socle passe ses propres vérifications — 5B.1', () => {
  const TYPESCRIPT = entry({ id: 'typescript', category: 'language' });
  const BIOME = entry({ id: 'biome', category: 'linting' });

  function scripts(entries: RegistryEntry[]): Record<string, string> {
    return (
      JSON.parse(fileNamed(scaffoldFiles(MANIFEST, entries), 'package.json')) as {
        scripts: Record<string, string>;
      }
    ).scripts;
  }

  it('un script typecheck s’accompagne d’un tsconfig.json strict', () => {
    const files = scaffoldFiles(MANIFEST, [TYPESCRIPT]);
    const tsconfig = JSON.parse(fileNamed(files, 'tsconfig.json')) as {
      compilerOptions: Record<string, unknown>;
    };
    expect(tsconfig.compilerOptions['strict']).toBe(true);
    expect(tsconfig.compilerOptions['noEmit']).toBe(true);
  });

  it('pose un env.d.ts même sans variable : tsc échoue sur un projet sans aucune entrée', () => {
    const declaration = fileNamed(scaffoldFiles(MANIFEST, [TYPESCRIPT]), 'env.d.ts');
    // Pas d'interface vide, que le linter refuserait : un module vide suffit.
    expect(declaration).toContain('export {};');
    expect(declaration).not.toContain('interface');
  });

  it('env.d.ts type chaque variable de .env.example', () => {
    const files = scaffoldFiles(MANIFEST, [
      TYPESCRIPT,
      entry({ id: 'prisma', category: 'orm', env: ['DATABASE_URL'] }),
      entry({ id: 'stripe', category: 'payments', env: ['STRIPE_SECRET_KEY'] }),
    ]);
    const declaration = fileNamed(files, 'env.d.ts');
    expect(declaration).toContain('readonly DATABASE_URL?: string;');
    expect(declaration).toContain('readonly STRIPE_SECRET_KEY?: string;');
  });

  it('pas de tsconfig ni d’env.d.ts sans TypeScript', () => {
    const paths = scaffoldFiles(MANIFEST, [BIOME]).map((file) => file.path);
    expect(paths).not.toContain('tsconfig.json');
    expect(paths).not.toContain('env.d.ts');
  });

  it('Biome choisi ⇒ biome.json indenté en espaces, comme les fichiers générés', () => {
    const config = JSON.parse(fileNamed(scaffoldFiles(MANIFEST, [BIOME]), 'biome.json')) as {
      formatter: { indentStyle: string; indentWidth: number };
    };
    expect(config.formatter.indentStyle).toBe('space');
    expect(config.formatter.indentWidth).toBe(2);
  });

  it('les tests passent sur un projet qui n’en a pas encore', () => {
    expect(scripts([entry({ id: 'vitest', category: 'testing' })])['test']).toContain(
      '--passWithNoTests',
    );
  });

  it('pas de dev/build/start tant qu’aucun template ne pose l’application', () => {
    const declared = scripts([entry({ id: 'next' })]);
    expect(declared['build']).toBeUndefined();
    expect(declared['dev']).toBeUndefined();
    expect(declared['start']).toBeUndefined();
  });

  it('dev/build/start apparaissent quand la fiche est certifiée', () => {
    const certified = scripts([
      entry({ id: 'next', generation: 'certified', template: 'frontend/next' }),
    ]);
    expect(certified['build']).toBe('next build');
    expect(certified['dev']).toBe('next dev');
  });

  it('pas de scripts Prisma sans schéma à générer', () => {
    expect(scripts([entry({ id: 'prisma', category: 'orm' })])['db:generate']).toBeUndefined();
  });

  it('les fichiers de configuration disent d’où ils viennent', () => {
    const files = scaffoldFiles(MANIFEST, [TYPESCRIPT, BIOME]);
    const sources = files.map((file) => file.source);
    expect(sources).toContain('integration:typescript');
    expect(sources).toContain('integration:biome');
  });

  it('chaque fichier de configuration JSON généré est du JSON valide', () => {
    for (const file of scaffoldFiles(MANIFEST, [TYPESCRIPT, BIOME])) {
      if (file.path.endsWith('.json')) {
        expect(() => JSON.parse(file.contents), file.path).not.toThrow();
      }
    }
  });
});

/**
 * pnpm 11 refuse d'installer quand un paquet a un script de build non
 * approuvé (`ERR_PNPM_IGNORED_BUILDS`). Trouvé par le test de fumée : le
 * preset SaaS ne s'installait pas, à cause de Prisma.
 */
describe('scripts d’installation approuvés — pnpm 11', () => {
  const PRISMA = entry({ id: 'prisma', category: 'orm' });

  it('approuve les scripts de Prisma, même hors monorepo', () => {
    const workspace = fileNamed(scaffoldFiles(MANIFEST, [PRISMA]), 'pnpm-workspace.yaml');
    expect(workspace).toContain('allowBuilds:');
    expect(workspace).toContain('  prisma: true');
    expect(workspace).toContain('  "@prisma/engines": true');
  });

  it('hors monorepo, ne déclare pas de paquets de workspace', () => {
    const workspace = fileNamed(scaffoldFiles(MANIFEST, [PRISMA]), 'pnpm-workspace.yaml');
    expect(workspace).not.toContain('packages:');
  });

  it('en monorepo, déclare les deux', () => {
    const workspace = fileNamed(
      scaffoldFiles({ ...MANIFEST, architecture: 'monorepo' }, [PRISMA]),
      'pnpm-workspace.yaml',
    );
    expect(workspace).toContain('packages:');
    expect(workspace).toContain('allowBuilds:');
  });

  it('n’approuve rien qui ne soit demandé', () => {
    const workspace = fileNamed(
      scaffoldFiles({ ...MANIFEST, architecture: 'monorepo' }, []),
      'pnpm-workspace.yaml',
    );
    expect(workspace).not.toContain('allowBuilds');
  });

  it('les approbations sont triées et dédoublonnées', () => {
    const workspace = fileNamed(
      scaffoldFiles(MANIFEST, [PRISMA, entry({ id: 'vite' })]),
      'pnpm-workspace.yaml',
    );
    const approved = workspace
      .split('\n')
      .filter((line) => line.endsWith(': true'))
      .map((line) => line.trim().replace(/"/g, '').replace(': true', ''));
    expect(approved).toEqual([...new Set(approved)].sort());
  });
});

describe('recettes dans le socle — 5B.5', () => {
  const RECIPE: Recipe = {
    id: 'stripe-checkout',
    name: 'Stripe — Checkout',
    description: 'x',
    for: ['stripe'],
    packages: { stripe: '^18.0.0' },
    devPackages: { '@types/node': '^24.0.0' },
    env: ['STRIPE_WEBHOOK_SECRET'],
  };
  const STRIPE = entry({
    id: 'stripe',
    category: 'payments',
    packages: ['stripe'],
    packageRanges: { stripe: '^18.0.0' },
    env: ['STRIPE_SECRET_KEY'],
  });

  function withRecipes(recipes: Recipe[], entries: RegistryEntry[] = [STRIPE]) {
    const result = buildScaffold(MANIFEST, entries, recipes);
    if (!result.ok) {
      throw new Error(result.issues.map((issue) => issue.message).join(' | '));
    }
    return result.value.files;
  }

  it('ajoute les paquets de la recette au package.json', () => {
    const json = JSON.parse(fileNamed(withRecipes([RECIPE]), 'package.json')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(json.dependencies['stripe']).toBe('^18.0.0');
    expect(json.devDependencies['@types/node']).toBe('^24.0.0');
  });

  it('ajoute ses variables à .env.example, sans doublon avec la fiche', () => {
    const env = fileNamed(withRecipes([RECIPE]), '.env.example');
    expect(env).toContain('STRIPE_SECRET_KEY=');
    expect(env).toContain('STRIPE_WEBHOOK_SECRET=');
    expect(env.match(/STRIPE_WEBHOOK_SECRET=/g)).toHaveLength(1);
  });

  it('une plage de recette incompatible avec la fiche est un conflit', () => {
    const result = buildScaffold(
      MANIFEST,
      [STRIPE],
      [{ ...RECIPE, packages: { stripe: '^12.0.0' } }],
    );
    expect(!result.ok && result.issues.map((issue) => issue.code)).toEqual([
      'GEN_DEPENDENCY_CONFLICT',
    ]);
  });

  it('le README liste les recettes appliquées', () => {
    expect(fileNamed(withRecipes([RECIPE]), 'README.md')).toContain('Stripe — Checkout');
  });

  it('sans recette, le README n’a pas de section recettes', () => {
    expect(fileNamed(withRecipes([]), 'README.md')).not.toContain('## Recettes');
  });
});

describe('Docker dans le socle — 5B.6', () => {
  const DOCKER = entry({ id: 'docker', category: 'containers' });

  it('Docker choisi sans application à construire : pas de Dockerfile, un avertissement', () => {
    const result = built(MANIFEST, [DOCKER, entry({ id: 'next' })]);
    expect(result.files.map((file) => file.path)).not.toContain('Dockerfile');
    expect(result.warnings.map((warning) => warning.code)).toContain('GEN_DOCKERFILE_DEFERRED');
  });

  it('Docker choisi avec une application certifiée : Dockerfile, sans avertissement', () => {
    const result = built(MANIFEST, [
      DOCKER,
      entry({ id: 'next', generation: 'certified', template: 'frontend/next' }),
    ]);
    expect(result.files.map((file) => file.path)).toContain('Dockerfile');
    expect(result.warnings.map((warning) => warning.code)).not.toContain('GEN_DOCKERFILE_DEFERRED');
  });

  it('le Dockerfile copie pnpm-workspace.yaml quand le socle en a un', () => {
    const files = scaffoldFiles(MANIFEST, [
      DOCKER,
      entry({ id: 'next', generation: 'certified', template: 'frontend/next' }),
      entry({ id: 'prisma', category: 'orm' }),
    ]);
    expect(fileNamed(files, 'Dockerfile')).toContain('pnpm-workspace.yaml');
  });

  it('le devcontainer porte le nom du projet', () => {
    const files = scaffoldFiles(MANIFEST, [
      entry({ id: 'dev-container', category: 'dev-environment' }),
    ]);
    expect(fileNamed(files, '.devcontainer/devcontainer.json')).toContain('"name": "quai3"');
  });
});

/**
 * Phase 6.7a — Prisma câblé sur PostgreSQL. Le code dépend de la base :
 * fournisseur du schéma, adaptateur de pilote. Il n'est donc produit que pour
 * la combinaison vérifiée par le test de fumée, jamais pour Prisma seul.
 */
describe('intégration par combinaison : prisma + postgresql', () => {
  const PRISMA = entry({ id: 'prisma', category: 'orm' });
  const POSTGRES = entry({ id: 'postgresql', category: 'database' });
  const MYSQL = entry({ id: 'mysql', category: 'database' });

  function pkg(files: readonly { path: string; contents: string }[]) {
    return JSON.parse(fileNamed(files, 'package.json')) as {
      scripts: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
  }

  it('pose la configuration, un schéma PostgreSQL et le client', () => {
    const files = scaffoldFiles(MANIFEST, [PRISMA, POSTGRES]);
    expect(fileNamed(files, 'prisma.config.ts')).toContain("schema: 'prisma/schema'");
    expect(fileNamed(files, 'prisma/schema/schema.prisma')).toContain('provider = "postgresql"');
    expect(fileNamed(files, 'lib/db.ts')).toContain('PrismaPg');
  });

  it('la configuration ne fait pas échouer prisma generate sans DATABASE_URL', () => {
    // `env('DATABASE_URL')` de prisma/config lève quand la variable manque :
    // la CI, qui n'a pas de base, ne pourrait plus générer le client.
    const config = fileNamed(scaffoldFiles(MANIFEST, [PRISMA, POSTGRES]), 'prisma.config.ts');
    expect(config).toContain('process.env');
    expect(config).not.toContain("env('DATABASE_URL')");
  });

  it('génère le client à l’installation et ajoute l’adaptateur de pilote', () => {
    const json = pkg(scaffoldFiles(MANIFEST, [PRISMA, POSTGRES]));
    expect(json.scripts['postinstall']).toBe('prisma generate');
    expect(json.scripts['db:migrate']).toBe('prisma migrate dev');
    expect(json.dependencies?.['@prisma/adapter-pg']).toBeDefined();
    expect(json.devDependencies?.['@types/node']).toBeDefined();
  });

  it('Prisma sur une autre base : rien de faux, ni fichier ni script', () => {
    const files = scaffoldFiles(MANIFEST, [PRISMA, MYSQL]);
    const paths = files.map((file) => file.path);
    expect(paths).not.toContain('lib/db.ts');
    expect(paths).not.toContain('prisma.config.ts');
    expect(pkg(files).scripts['postinstall']).toBeUndefined();
    expect(pkg(files).dependencies?.['@prisma/adapter-pg']).toBeUndefined();
  });

  it('PostgreSQL sans Prisma : pas de code Prisma', () => {
    expect(scaffoldFiles(MANIFEST, [POSTGRES]).map((file) => file.path)).not.toContain('lib/db.ts');
  });

  it('le code engendré par Prisma n’est ni versionné ni linté', () => {
    const files = scaffoldFiles(MANIFEST, [
      PRISMA,
      POSTGRES,
      entry({ id: 'biome', category: 'linting' }),
    ]);
    expect(fileNamed(files, '.gitignore')).toContain('generated/');
    expect(fileNamed(files, 'biome.json')).toContain('"!**/generated"');
  });
});

describe('intégration par combinaison : playwright + next', () => {
  const PLAYWRIGHT = entry({ id: 'playwright', category: 'testing' });
  const NEXT = entry({ id: 'next', generation: 'certified', template: 'frontend/next' });

  it('pose une configuration qui démarre l’application, et un premier test', () => {
    const files = scaffoldFiles(MANIFEST, [PLAYWRIGHT, NEXT]);
    expect(fileNamed(files, 'playwright.config.ts')).toContain('webServer');
    expect(fileNamed(files, 'e2e/home.e2e.ts')).toContain("page.goto('/')");
  });

  it('les tests de bout en bout ne sont pas ramassés par Vitest', () => {
    // Vitest prend tout *.test.* et *.spec.* : un spec Playwright y serait
    // exécuté sans navigateur et ferait échouer `pnpm test`.
    const files = scaffoldFiles(MANIFEST, [PLAYWRIGHT, NEXT]);
    const specs = files.filter((file) => file.path.startsWith('e2e/'));
    expect(specs.every((file) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(file.path))).toBe(true);
    expect(fileNamed(files, 'playwright.config.ts')).toContain("testMatch: '**/*.e2e.ts'");
  });

  it('Playwright sans Next : pas de configuration devinée', () => {
    expect(scaffoldFiles(MANIFEST, [PLAYWRIGHT]).map((file) => file.path)).not.toContain(
      'playwright.config.ts',
    );
  });
});

describe('intégration par combinaison : better-auth + next + prisma + postgresql', () => {
  const STACK = [
    entry({ id: 'better-auth', category: 'authentication' }),
    entry({ id: 'next', generation: 'certified', template: 'frontend/next' }),
    entry({ id: 'prisma', category: 'orm' }),
    entry({ id: 'postgresql', category: 'database' }),
  ];

  it('pose les tables, la configuration serveur, le client et la route', () => {
    const files = scaffoldFiles(MANIFEST, STACK);
    const tables = fileNamed(files, 'prisma/schema/auth.prisma');
    for (const table of ['"user"', '"session"', '"account"', '"verification"']) {
      expect(tables).toContain(`@@map(${table})`);
    }
    expect(fileNamed(files, 'lib/auth.ts')).toContain(
      "prismaAdapter(db, { provider: 'postgresql' })",
    );
    expect(fileNamed(files, 'lib/auth-client.ts')).toContain('createAuthClient');
    expect(fileNamed(files, 'app/api/auth/[...all]/route.ts')).toContain('toNextJsHandler');
  });

  it('les tables n’ont ni générateur ni source de données : le schéma en dossier les a déjà', () => {
    const tables = fileNamed(scaffoldFiles(MANIFEST, STACK), 'prisma/schema/auth.prisma');
    expect(tables).not.toContain('generator client');
    expect(tables).not.toContain('datasource');
  });

  it.each(['next', 'prisma', 'postgresql'])(
    'sans %s, rien : la combinaison entière est requise',
    (missing) => {
      const paths = scaffoldFiles(
        MANIFEST,
        STACK.filter((item) => item.id !== missing),
      ).map((file) => file.path);
      expect(paths).not.toContain('lib/auth.ts');
      expect(paths).not.toContain('prisma/schema/auth.prisma');
    },
  );

  it('la provenance nomme toute la combinaison', () => {
    const route = scaffoldFiles(MANIFEST, STACK).find(
      (file) => file.path === 'app/api/auth/[...all]/route.ts',
    );
    expect(route?.source).toBe('integration:better-auth+next+prisma+postgresql');
  });
});

import type { Manifest } from '@project-factory/manifest';
import { loadRecipes } from '@project-factory/recipes';
import { describe, expect, it } from 'vitest';
import { planProject } from './pipeline.js';

/** Le preset Full-stack du §8, en monorepo : Next.js + Hono. */
const FULLSTACK: Manifest = {
  manifestVersion: 1,
  name: 'atelier',
  targets: ['web', 'api'],
  architecture: 'monorepo',
  frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
  backend: { framework: 'hono', language: 'typescript' },
  database: { engine: 'postgresql', orm: 'prisma' },
  auth: { provider: 'better-auth' },
  services: ['redis', 'zod'],
  quality: ['biome', 'vitest', 'playwright'],
  infra: ['turborepo', 'docker', 'github-actions'],
};

function plan(manifest: Manifest = FULLSTACK) {
  const result = planProject(manifest, '/cible');
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => `${issue.code} ${issue.message}`).join(' | '));
  }
  return result.value;
}

function file(path: string, manifest: Manifest = FULLSTACK): string {
  const found = plan(manifest).plan.files.find((planned) => planned.path === path);
  if (found === undefined) {
    throw new Error(`fichier absent : ${path}`);
  }
  return found.contents;
}

function paths(manifest: Manifest = FULLSTACK): string[] {
  return plan(manifest).plan.files.map((planned) => planned.path);
}

describe('monorepo : chaque application est générée comme une application seule', () => {
  it('l’application web est sous apps/web, l’API sous apps/api', () => {
    expect(paths()).toEqual(
      expect.arrayContaining([
        'apps/web/package.json',
        'apps/web/app/page.tsx',
        'apps/web/lib/auth.ts',
        'apps/web/prisma/schema/schema.prisma',
        'apps/web/playwright.config.ts',
        'apps/api/package.json',
        'apps/api/src/app.ts',
        'apps/api/lib/redis.ts',
      ]),
    );
  });

  it('rien d’une application ne reste à la racine', () => {
    const root = paths().filter((path) => !path.startsWith('apps/'));
    expect(root.sort()).toEqual([
      '.github/workflows/ci.yml',
      '.gitignore',
      'README.md',
      'biome.json',
      'docker-compose.yml',
      'package.json',
      'pnpm-workspace.yaml',
      'turbo.json',
    ]);
  });

  it('chaque application a son propre nom de paquet', () => {
    expect(JSON.parse(file('apps/web/package.json')).name).toBe('atelier-web');
    expect(JSON.parse(file('apps/api/package.json')).name).toBe('atelier-api');
  });

  it('la base et l’authentification vivent dans l’application web', () => {
    const api = paths().filter((path) => path.startsWith('apps/api/'));
    expect(api.some((path) => path.includes('prisma'))).toBe(false);
    expect(JSON.parse(file('apps/web/package.json')).dependencies['better-auth']).toBeDefined();
  });

  it('les outils partagés sont dans chaque application : TypeScript, Vitest', () => {
    for (const app of ['web', 'api']) {
      expect(paths()).toContain(`apps/${app}/tsconfig.json`);
      expect(JSON.parse(file(`apps/${app}/package.json`)).scripts.test).toContain('vitest');
    }
  });
});

describe('monorepo : la racine porte le dépôt entier', () => {
  it('build, typecheck, test délèguent à Turborepo ; lint lance Biome une fois', () => {
    const scripts = JSON.parse(file('package.json')).scripts as Record<string, string>;
    expect(scripts['build']).toBe('turbo run build');
    expect(scripts['typecheck']).toBe('turbo run typecheck');
    expect(scripts['test']).toBe('turbo run test');
    expect(scripts['dev']).toBe('turbo run dev');
    expect(scripts['lint']).toBe('biome check .');
  });

  it('les applications ne relintent pas : Biome est configuré à la racine', () => {
    expect(JSON.parse(file('apps/web/package.json')).scripts.lint).toBeUndefined();
  });

  it('pnpm-workspace.yaml réunit les scripts d’installation de toutes les applications', () => {
    const workspace = file('pnpm-workspace.yaml');
    expect(workspace).toContain('  - "apps/*"');
    expect(workspace).toContain('  prisma: true');
    expect(workspace).toContain('  esbuild: true');
  });

  it('docker-compose.yml réunit les services de toutes les applications', () => {
    const compose = file('docker-compose.yml');
    expect(compose).toContain('postgres:');
    expect(compose).toContain('redis:');
  });

  it('la CI lance les scripts de la racine', () => {
    const ci = file('.github/workflows/ci.yml');
    expect(ci).toContain('pnpm run build');
    expect(ci).toContain('pnpm run lint');
  });

  it('pas de Dockerfile par application : un avertissement le dit', () => {
    expect(paths().some((path) => path.endsWith('Dockerfile'))).toBe(false);
    expect(plan().warnings.map((warning) => warning.code)).toContain(
      'GEN_DOCKERFILE_MONOREPO_DEFERRED',
    );
  });

  it('turbo.json déclare dev comme tâche persistante, sans cache', () => {
    const turbo = JSON.parse(file('turbo.json')) as {
      tasks: Record<string, { persistent?: boolean; cache?: boolean }>;
    };
    expect(turbo.tasks['dev']).toEqual({ cache: false, persistent: true });
  });
});

describe('monorepo : une seule application', () => {
  it('web seul : apps/web, pas d’apps/api', () => {
    const { backend: _api, ...webOnly } = FULLSTACK;
    const all = paths({ ...webOnly, targets: ['web'], services: ['zod'] });
    expect(all).toContain('apps/web/package.json');
    expect(all.some((path) => path.startsWith('apps/api/'))).toBe(false);
  });
});

describe('le preset Full-stack du §8 est certifié — 6.7b', () => {
  it('aucun avertissement de combinaison expérimentale', () => {
    expect(plan().warnings.map((warning) => warning.code)).not.toContain(
      'COMPAT_EXPERIMENTAL_COMBINATION',
    );
  });
});

describe('monorepo : chemins d’erreur et variantes', () => {
  function codes(manifest: Manifest, options: Parameters<typeof planProject>[2] = {}): string[] {
    const result = planProject(manifest, '/cible', options);
    return result.ok ? [] : result.issues.map((issue) => issue.code);
  }

  it('sans framework ni backend, aucune application : refusé en le disant', () => {
    expect(
      codes({
        manifestVersion: 1,
        name: 'outils',
        targets: ['web'],
        architecture: 'monorepo',
        quality: ['biome'],
      }),
    ).toEqual(['GEN_MONOREPO_NO_APP']);
  });

  it('une recette va dans l’application qui porte sa technologie', () => {
    const result = planProject(FULLSTACK, '/cible', { recipes: ['dashboard-admin'] });
    const all = result.ok ? result.value.plan.files.map((file) => file.path) : [];
    expect(all).toContain('apps/web/app/dashboard/page.tsx');
    expect(all.some((path) => path.startsWith('apps/api/app/'))).toBe(false);
  });

  it('une recette dont le code enjambe deux applications est refusée', () => {
    const catalogue = loadRecipes([
      {
        id: 'pont',
        name: 'Pont',
        description: 'x',
        for: ['better-auth'],
        requires: ['hono'],
      },
    ]);
    if (!catalogue.ok) {
      throw new Error('fixture invalide');
    }
    expect(codes(FULLSTACK, { recipes: ['pont'], recipeCatalogue: catalogue.value })).toEqual([
      'GEN_RECIPE_ACROSS_APPS',
    ]);
  });

  it('sans Turborepo, la racine délègue à pnpm en récursif', () => {
    const { infra: _infra, ...rest } = FULLSTACK;
    const scripts = JSON.parse(file('package.json', { ...rest, infra: ['docker'] }))
      .scripts as Record<string, string>;
    expect(scripts['build']).toBe('pnpm --recursive --if-present run build');
  });

  it('un défaut dans une application remonte tel quel', () => {
    // vitest et jest réclament tous deux « test » dans chaque application.
    expect(codes({ ...FULLSTACK, quality: ['biome', 'vitest', 'jest'] })).toContain(
      'GEN_SCRIPT_CONFLICT',
    );
  });

  it('le devcontainer est à la racine, une seule fois', () => {
    const all = paths({ ...FULLSTACK, infra: [...(FULLSTACK.infra ?? []), 'dev-container'] });
    expect(all).toContain('.devcontainer/devcontainer.json');
    expect(all.filter((path) => path.endsWith('devcontainer.json'))).toHaveLength(1);
  });
});

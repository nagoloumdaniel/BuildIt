import { describe, expect, it } from 'vitest';
import { skeletonTree, withoutDuplicateShared } from './architecture-skeleton.js';
import { ARCHITECTURES } from './schema/enums.js';

const FULL = { frontend: true, backend: true };
const paths = (architecture: Parameters<typeof skeletonTree>[0], stack = FULL) =>
  skeletonTree(architecture, stack).map((dir) => dir.path);

describe('skeletonTree — dossiers de base par architecture', () => {
  it('donne à chaque dossier une responsabilité écrite, sans doublon ni chemin absolu', () => {
    for (const architecture of ARCHITECTURES) {
      const tree = skeletonTree(architecture, FULL);
      expect(tree.length).toBeGreaterThan(0);
      expect(new Set(tree.map((dir) => dir.path)).size).toBe(tree.length);
      for (const dir of tree) {
        expect(dir.path).not.toMatch(/^\/|\\|\/$/);
        expect(dir.role.length).toBeGreaterThan(10);
      }
    }
  });

  it('pose toujours docs/architecture et docs/decisions', () => {
    for (const architecture of ARCHITECTURES) {
      expect(paths(architecture)).toEqual(
        expect.arrayContaining(['docs/architecture', 'docs/decisions']),
      );
    }
  });

  it('monorepo : front sous apps/web, back sous apps/api, environnements sous infra', () => {
    const tree = paths('monorepo');
    expect(tree).toContain('apps/web/src/features');
    expect(tree).toContain('apps/api/src/modules/example/domain');
    expect(tree).toContain('infra/environments/production');
    expect(tree).toContain('tests/e2e');
    expect(tree.some((path) => path.startsWith('src/'))).toBe(false);
    expect(tree).toContain('packages/contracts');
    expect(paths('monorepo', { frontend: true, backend: false })).not.toContain(
      'packages/contracts',
    );
  });

  it('suit la stack : sans backend, pas de modules hexagonaux en application unique', () => {
    const tree = paths('single-app', { frontend: true, backend: false });
    expect(tree).toContain('src/features');
    expect(tree.some((path) => path.includes('modules'))).toBe(false);
    const api = paths('single-app', { frontend: false, backend: true });
    expect(api).toContain('src/modules/example/application');
    expect(api.some((path) => path.includes('features'))).toBe(false);
  });

  it('monolithe modulaire : les modules existent même sans backend déclaré', () => {
    expect(paths('modular-monolith', { frontend: true, backend: false })).toContain(
      'src/modules/example/domain',
    );
  });

  it('microservices, serverless, événements : leurs dossiers propres', () => {
    expect(paths('microservices')).toEqual(
      expect.arrayContaining([
        'services/gateway',
        'services/example-service/src/domain',
        'packages/event-contracts',
      ]),
    );
    expect(paths('serverless')).toEqual(
      expect.arrayContaining(['functions/http', 'functions/events', 'functions/scheduled']),
    );
    expect(paths('event-driven')).toEqual(
      expect.arrayContaining([
        'src/events/outbox',
        'src/events/dead-letter',
        'packages/event-contracts',
      ]),
    );
  });

  it('est déterministe', () => {
    expect(skeletonTree('monorepo', FULL)).toEqual(skeletonTree('monorepo', FULL));
  });
});

describe('withoutDuplicateShared — pas de shared/ui à côté de components/', () => {
  const dirs = skeletonTree('single-app', { frontend: true, backend: false });

  it('garde shared/ui et shared/lib sans équivalent', () => {
    const paths = withoutDuplicateShared(dirs, () => false).map((dir) => dir.path);
    expect(paths).toContain('src/shared/ui');
    expect(paths).toContain('src/shared/lib');
  });

  it('retire shared/ui si components/ existe, shared/lib si lib/ existe', () => {
    const existing = new Set(['components', 'lib']);
    const paths = withoutDuplicateShared(dirs, (path) => existing.has(path)).map((d) => d.path);
    expect(paths).not.toContain('src/shared/ui');
    expect(paths).not.toContain('src/shared/lib');
    expect(paths).toContain('src/features');
  });

  it('regarde au même niveau (src/components) et par application en monorepo', () => {
    const mono = skeletonTree('monorepo', { frontend: true, backend: true });
    const paths = withoutDuplicateShared(mono, (path) => path === 'apps/web/src/components').map(
      (d) => d.path,
    );
    expect(paths).not.toContain('apps/web/src/shared/ui');
    expect(paths).toContain('apps/web/src/shared/lib');
  });
});

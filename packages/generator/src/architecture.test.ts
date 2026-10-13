import type { Manifest } from '@buildit/manifest';
import type { RegistryEntry } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { architectureSkeleton, withArchitectureSkeleton } from './architecture.js';

const BASE: Manifest = {
  manifestVersion: 1,
  name: 'atelier',
  targets: ['web', 'api'],
  architecture: 'monorepo',
};

/** Seule la catégorie compte ici. */
const entry = (id: string, category: string) => ({ id, category }) as unknown as RegistryEntry;
const NEXT = entry('next', 'frontend');
const HONO = entry('hono', 'backend');

const pathsOf = (manifest: Manifest, entries: readonly RegistryEntry[]) =>
  architectureSkeleton(manifest, entries).map((file) => file.path);

describe('architectureSkeleton', () => {
  it('pose un README par dossier, un ADR et la vue d’architecture', () => {
    const files = architectureSkeleton(BASE, [NEXT, HONO]);
    const paths = files.map((file) => file.path);
    expect(paths).toContain('apps/web/src/features/README.md');
    expect(paths).toContain('apps/api/src/modules/example/domain/README.md');
    expect(paths).toContain('docs/decisions/ADR-001-monorepo.md');
    expect(paths).toContain('docs/architecture/README.md');
    expect(paths).toContain('CONTRIBUTING.md');
    expect(paths).toContain('SECURITY.md');
    for (const file of files) {
      expect(file.source).toBe('architecture:monorepo');
      expect(file.contents.length).toBeGreaterThan(0);
    }
  });

  it('la vue d’architecture montre l’arborescence', () => {
    const view = architectureSkeleton(BASE, [NEXT, HONO]).find(
      (file) => file.path === 'docs/architecture/README.md',
    );
    expect(view?.contents).toContain('apps/api/src/modules/example/domain');
  });

  it('suit la stack : front seul, pas de modules en application unique', () => {
    const paths = pathsOf({ ...BASE, architecture: 'single-app' }, [NEXT]);
    expect(paths).toContain('src/features/README.md');
    expect(paths.some((path) => path.includes('modules'))).toBe(false);
  });

  it('ne produit aucun chemin en double', () => {
    const paths = pathsOf({ ...BASE, architecture: 'event-driven' }, [NEXT, HONO]);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('withArchitectureSkeleton', () => {
  it('laisse la main aux fichiers déjà planifiés', () => {
    const template = { path: 'SECURITY.md', contents: 'maison', source: 'template:x' };
    const merged = withArchitectureSkeleton([template], BASE, [NEXT, HONO]);
    expect(merged.filter((file) => file.path === 'SECURITY.md')).toEqual([template]);
    expect(merged.length).toBeGreaterThan(1);
  });

  it('garde le README d’un template au même chemin', () => {
    const template = { path: 'apps/web/src/features/README.md', contents: 'x', source: 't' };
    const merged = withArchitectureSkeleton([template], BASE, [NEXT]);
    expect(merged.filter((file) => file.path === template.path)).toHaveLength(1);
  });

  it('suit la convention de l’application : sans src/ planifié, les dossiers vont à sa racine', () => {
    const next = { path: 'app/page.tsx', contents: 'x', source: 't' };
    const single = { ...BASE, architecture: 'single-app' as const };
    const paths = withArchitectureSkeleton([next], single, [NEXT]).map((file) => file.path);
    expect(paths).toContain('features/README.md');
    expect(paths.some((path) => path.startsWith('src/'))).toBe(false);
    const view = withArchitectureSkeleton([next], single, [NEXT]).find(
      (file) => file.path === 'docs/architecture/README.md',
    );
    expect(view?.contents).toContain('shared/ui/');
    expect(view?.contents).not.toContain('src/shared');
  });

  it('garde src/ quand l’application l’utilise déjà', () => {
    const api = { path: 'apps/api/src/index.ts', contents: 'x', source: 't' };
    const paths = withArchitectureSkeleton([api], BASE, [HONO]).map((file) => file.path);
    expect(paths).toContain('apps/api/src/modules/README.md');
  });
});

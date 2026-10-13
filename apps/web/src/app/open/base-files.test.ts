import { describe, expect, it } from 'vitest';
import { baseFilesFor, missingBaseFiles, projectShape } from './base-files';

describe('projectShape — l’architecture d’un projet ouvert', () => {
  it('lit le manifest BuildIt quand il existe', () => {
    const shape = projectShape({
      folder: 'dossier',
      files: ['pf.manifest.json', 'package.json'],
      dirs: [],
      manifest: JSON.stringify({
        manifestVersion: 1,
        name: 'mon-app',
        targets: ['web', 'api'],
        architecture: 'monorepo',
        frontend: { framework: 'next', language: 'typescript' },
        backend: { framework: 'hono', language: 'typescript' },
      }),
    });
    expect(shape).toEqual({
      name: 'mon-app',
      architecture: 'monorepo',
      stack: { frontend: true, backend: true },
      source: 'manifest',
    });
  });

  it('déduit un monorepo de apps/ + packages/, et le front de package.json', () => {
    const shape = projectShape({
      folder: 'site',
      files: ['package.json', 'pnpm-workspace.yaml'],
      dirs: ['apps', 'packages'],
      packageJson: JSON.stringify({ name: 'site', dependencies: { next: '15.0.0' } }),
    });
    expect(shape.architecture).toBe('monorepo');
    expect(shape.stack).toEqual({ frontend: true, backend: false });
    expect(shape.source).toBe('inferred');
  });

  it('un projet Python sans manifest est une application unique côté back', () => {
    const shape = projectShape({ folder: 'api', files: ['pyproject.toml'], dirs: ['src'] });
    expect(shape).toMatchObject({
      name: 'api',
      architecture: 'single-app',
      stack: { frontend: false, backend: true },
    });
  });

  it('services/ dit microservices, functions/ dit serverless', () => {
    expect(projectShape({ folder: 'x', files: [], dirs: ['services'] }).architecture).toBe(
      'microservices',
    );
    expect(projectShape({ folder: 'x', files: [], dirs: ['functions'] }).architecture).toBe(
      'serverless',
    );
  });

  it('un manifest illisible ne casse rien : la déduction prend le relais', () => {
    const shape = projectShape({
      folder: 'x',
      files: ['pf.manifest.json'],
      dirs: [],
      manifest: '{',
    });
    expect(shape.source).toBe('inferred');
  });
});

describe('baseFilesFor / missingBaseFiles', () => {
  const shape = {
    name: 'mon-app',
    architecture: 'single-app',
    stack: { frontend: true, backend: false },
    source: 'inferred',
  } as const;

  it('pose README par dossier, vue d’architecture, ADR, CONTRIBUTING et SECURITY', () => {
    const paths = baseFilesFor(shape).map((file) => file.path);
    expect(paths).toContain('src/features/README.md');
    expect(paths).toContain('docs/architecture/README.md');
    expect(paths).toContain('docs/decisions/ADR-001-single-app.md');
    expect(paths).toContain('CONTRIBUTING.md');
    expect(paths).toContain('SECURITY.md');
  });

  it('n’écrase jamais : un fichier déjà présent est retiré de la liste', () => {
    const existing = new Set(['CONTRIBUTING.md', 'src/features/README.md']);
    const paths = missingBaseFiles(baseFilesFor(shape), (path) => existing.has(path)).map(
      (file) => file.path,
    );
    expect(paths).not.toContain('CONTRIBUTING.md');
    expect(paths).not.toContain('src/features/README.md');
    expect(paths).toContain('SECURITY.md');
  });
});

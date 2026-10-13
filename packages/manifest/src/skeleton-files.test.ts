import { describe, expect, it } from 'vitest';
import { skeletonTree } from './architecture-skeleton.js';
import { ARCHITECTURES } from './schema/enums.js';
import { skeletonFiles } from './skeleton-files.js';

describe('skeletonFiles — le contenu des fichiers de base, sans fs', () => {
  it.each(ARCHITECTURES)(
    '%s : README par dossier, vue, ADR, CONTRIBUTING, SECURITY',
    (architecture) => {
      const dirs = skeletonTree(architecture, { frontend: true, backend: true });
      const files = skeletonFiles('mon-app', architecture, dirs);
      const paths = files.map((file) => file.path);
      for (const dir of dirs) {
        expect(paths).toContain(`${dir.path}/README.md`);
      }
      expect(paths).toContain(`docs/decisions/ADR-001-${architecture}.md`);
      expect(paths).toContain('CONTRIBUTING.md');
      expect(paths).toContain('SECURITY.md');
      expect(new Set(paths).size).toBe(paths.length);
      const view = files.find((file) => file.path === 'docs/architecture/README.md');
      expect(view?.contents).toContain('# Architecture — mon-app');
    },
  );

  it('le README d’un dossier porte sa responsabilité', () => {
    const files = skeletonFiles('x', 'serverless', [{ path: 'functions/http', role: 'Rôle.' }]);
    expect(files[0]).toEqual({ path: 'functions/http/README.md', contents: '# http\n\nRôle.\n' });
  });
});

describe('skeletonFiles — date de l’ADR', () => {
  it('inscrit la date fournie, jamais « à la génération »', () => {
    const files = skeletonFiles('x', 'monorepo', [], { date: '2026-03-04' });
    const adr = files.find((file) => file.path === 'docs/decisions/ADR-001-monorepo.md');
    expect(adr?.contents).toContain('- Date : 2026-03-04');
    expect(adr?.contents).not.toContain('à la génération');
  });

  it('par défaut, la date du jour (AAAA-MM-JJ)', () => {
    const adr = skeletonFiles('x', 'monorepo', []).find((f) => f.path.includes('ADR-001'));
    expect(adr?.contents).toMatch(/- Date : \d{4}-\d{2}-\d{2}\n/);
  });
});

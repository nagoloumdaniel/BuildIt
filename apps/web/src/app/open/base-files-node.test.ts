import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyBaseFiles, planBaseFiles } from './base-files-node';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pf-base-'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ name: 'mon-app', dependencies: { next: '15' } }),
  );
  await writeFile(join(root, 'CONTRIBUTING.md'), 'le mien');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('fichiers de base d’un projet local (mode pf web)', () => {
  it('liste ce qui manque, jamais ce qui existe', async () => {
    const plan = await planBaseFiles(root);
    const paths = plan.missing.map((file) => file.path);
    expect(plan.shape.architecture).toBe('single-app');
    expect(paths).toContain('SECURITY.md');
    expect(paths).toContain('src/features/README.md');
    expect(paths).not.toContain('CONTRIBUTING.md');
  });

  it('écrit les manquants sans écraser un fichier existant', async () => {
    await mkdir(join(root, 'docs', 'architecture'), { recursive: true });
    await writeFile(join(root, 'docs', 'architecture', 'README.md'), 'à moi');
    const result = await applyBaseFiles(root);
    expect(result.ok).toBe(true);
    expect(await readFile(join(root, 'CONTRIBUTING.md'), 'utf8')).toBe('le mien');
    expect(await readFile(join(root, 'docs', 'architecture', 'README.md'), 'utf8')).toBe('à moi');
    expect(await readFile(join(root, 'SECURITY.md'), 'utf8')).toContain('# Sécurité');
    expect((await planBaseFiles(root)).missing).toEqual([]);
  });
});

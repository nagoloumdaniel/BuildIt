import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeIo } from '../fake-io.js';
import { doctor } from './doctor.js';

/**
 * `pf doctor` de bout en bout : un vrai dossier, un faux terminal. Les constats
 * et les scores appartiennent au paquet `doctor` ; ici on vérifie ce que la
 * commande en **fait** ce qu'elle affiche, ce qu'elle écrit, et son code de
 * sortie, qui doit rester utilisable dans un pipeline.
 */
async function project(files: Readonly<Record<string, string>> = {}): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-doctor-cli-'));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), content, 'utf8');
  }
  return root;
}

const PACKAGE = JSON.stringify({ name: 'quai3', scripts: { dev: 'next dev' } });

/** Un fichier qui lit une variable : sans quoi le constat d'environnement passe. */
const SERVER = {
  'src/server.ts': 'export const url = process.env.DATABASE_URL;\n',
};

describe('pf doctor', () => {
  it('diagnostique le dossier courant et rend 1 quand un constat échoue', async () => {
    const root = await project({ 'package.json': PACKAGE, ...SERVER });
    const io = fakeIo({ cwd: root });
    expect(await doctor([], io)).toBe(1);
    const out = io.text().out;
    expect(out).toContain('quai3 · santé du projet :');
    // Le détail nomme ce qui a été observé, pas seulement « KO ».
    expect(out).toContain('Variables d’environnement');
    expect(out).toContain('Corrections proposées :');
    expect(out).toContain('.env.example');
  });

  it('accepte un dossier en argument', async () => {
    const parent = await project();
    const child = join(parent, 'mon-projet');
    await writeFile(join(parent, 'placeholder'), '');
    const { mkdir } = await import('node:fs/promises');
    await mkdir(child);
    await writeFile(join(child, 'package.json'), PACKAGE, 'utf8');
    const io = fakeIo({ cwd: parent });
    expect(await doctor(['mon-projet'], io)).toBe(1);
    expect(io.text().out).toContain('quai3 · santé du projet :');
  });

  it('rend le rapport en JSON, sans mise en page', async () => {
    const root = await project({ 'package.json': PACKAGE });
    const io = fakeIo({ cwd: root });
    expect(await doctor(['--json'], io)).toBe(1);
    const parsed = JSON.parse(io.text().out) as {
      score: number;
      checks: { id: string; status: string }[];
    };
    expect(parsed.score).toBeLessThan(100);
    expect(parsed.checks.map((entry) => entry.id)).toContain('typescript');
    expect(parsed.checks.find((entry) => entry.id === 'typescript')?.status).toBe('warn');
  });

  it('un projet sain rend 0 : la commande sert de contrôle en pipeline', async () => {
    const root = await project({
      'package.json': JSON.stringify({
        name: 'quai3',
        scripts: { test: 'vitest', health: 'pf doctor' },
        dependencies: { typescript: '7', vitest: '5' },
      }),
      'tsconfig.json': '{}',
      'pnpm-lock.yaml': '',
      'node_modules/.keep': '',
      '.gitignore': 'node_modules',
      '.env.example': 'DATABASE_URL\n',
      'README.md': '# quai3',
      '.github/workflows/ci.yml': 'name: CI\n',
      'src/server.ts': 'export const url = process.env.DATABASE_URL;\n',
    });
    const io = fakeIo({ cwd: root });
    // Les constats sans objet (base de données, Docker) sortent de l'équation.
    // `rate-limiting` et `monitoring` avertissent deux demi-points et rien
    // n'échoue : 8 / 9 ≈ 89, et la commande rend 0.
    expect(await doctor(['--json'], io)).toBe(0);
    const report = JSON.parse(io.text().out) as {
      score: number;
      checks: { id: string; status: string }[];
    };
    expect(report.score).toBe(89);
    expect(report.checks.filter((entry) => entry.status === 'fail')).toEqual([]);
    expect(report.checks.filter((entry) => entry.status === 'warn')).toHaveLength(2);
  });

  it('applique les corrections après confirmation, et annonce le nouveau score', async () => {
    const root = await project({ 'package.json': PACKAGE, ...SERVER });
    const io = fakeIo({ cwd: root, interactive: true, answers: [true] });
    expect(await doctor(['--fix'], io)).toBe(1);
    expect(io.text().out).toContain('✎ créer .env.example');
    expect(io.text().out).toContain('✓ .env.example écrit.');
    expect(io.text().out).toMatch(/Score après correction : \d+\/100\./);
    // Le fichier proposé ne contient que des **noms** : aucune valeur.
    const written = await readFile(join(root, '.env.example'), 'utf8');
    expect(written).not.toContain('=');
    expect(written).toContain('DATABASE_URL');
  });

  it('n’écrit rien quand la confirmation est refusée', async () => {
    const root = await project({ 'package.json': PACKAGE, ...SERVER });
    const io = fakeIo({ cwd: root, interactive: true, answers: [false] });
    expect(await doctor(['--fix'], io)).toBe(1);
    expect(io.text().out).toContain('Rien n’a été écrit');
    await expect(readFile(join(root, '.env.example'), 'utf8')).rejects.toThrow();
  });

  it('n’écrit rien non plus sans terminal : --fix ne devine pas', async () => {
    const root = await project({ 'package.json': PACKAGE, ...SERVER });
    const io = fakeIo({ cwd: root });
    expect(await doctor(['--fix'], io)).toBe(1);
    expect(io.text().out).toContain('Rien n’a été écrit');
  });

  it('refuse deux dossiers et renvoie l’aide d’usage', async () => {
    const io = fakeIo();
    expect(await doctor(['a', 'b'], io)).toBe(2);
    expect(io.text().err).toContain('Un seul dossier attendu.');
  });

  it('affiche son aide', async () => {
    const io = fakeIo();
    expect(await doctor(['--help'], io)).toBe(0);
    expect(io.text().out).toContain('pf doctor [dossier] [--fix] [--json]');
  });

  it('refuse un manifest présent mais invalide plutôt que de constater à faux', async () => {
    const root = await project({
      'package.json': PACKAGE,
      'pf.manifest.json': JSON.stringify({ manifestVersion: 1, name: 'x' }),
    });
    const io = fakeIo({ cwd: root });
    expect(await doctor([], io)).toBe(1);
    expect(io.text().err).toMatch(/\(MANIFEST_[A-Z_]+\)/);
  });

  it('lit un manifest valide et en tire la pile', async () => {
    const root = await project({
      'package.json': JSON.stringify({ name: 'quai3', dependencies: { next: '15' } }),
      'pf.manifest.json': JSON.stringify({
        manifestVersion: 1,
        name: 'quai3',
        targets: ['web'],
        architecture: 'single-app',
        frontend: { framework: 'next', language: 'typescript' },
        database: { engine: 'postgresql' },
        infra: ['docker'],
      }),
    });
    const io = fakeIo({ cwd: root });
    expect(await doctor(['--json'], io)).toBe(1);
    const report = JSON.parse(io.text().out) as {
      checks: { id: string; status: string; detail: string }[];
    };
    // La base est déclarée au manifest : le constat le dit.
    expect(report.checks.find((entry) => entry.id === 'database')?.status).toBe('pass');
    expect(report.checks.find((entry) => entry.id === 'database')?.detail).toContain('postgresql');
    // Docker est annoncé sans Dockerfile : avertissement, pas (« n/a »).
    expect(report.checks.find((entry) => entry.id === 'docker')?.status).toBe('warn');
  });
});

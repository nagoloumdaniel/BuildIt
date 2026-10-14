import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDoctor } from '@buildit/doctor';
import { type Manifest, serializeManifest } from '@buildit/manifest';
import { loadCatalogue } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { formatReport } from './doctor.js';
import {
  applyFixes,
  dependenciesIn,
  envNamesIn,
  type FileSource,
  fileSourceAt,
  nameIn,
  readFacts,
  scriptsIn,
} from './doctor-model.js';

/** Une racine en mémoire : le Doctor lit des faits, les tests les fabriquent. */
function fakeSource(files: Readonly<Record<string, string>>, dirs: readonly string[] = []) {
  const tree = new Map(Object.entries(files));
  const directories = new Set<string>(dirs);
  for (const path of tree.keys()) {
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join('/'));
    }
  }
  // Le CLI assemble ses chemins avec `node:path` : sous Windows, `join` produit
  // des `\` et un préfixe de lecteur. La source en mémoire est en chemins
  // relatifs séparés par `/`, comme la carte ci-dessus.
  const key = (path: string): string =>
    path
      .replaceAll('\\', '/')
      .replace(/^[A-Za-z]:/, '')
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');
  const source: FileSource = {
    path: (relative) => relative,
    read: async (path) => tree.get(key(path)),
    exists: async (path) => tree.has(key(path)) || directories.has(key(path).replace(/\/$/, '')),
    list: async (path) => {
      const prefix = key(path) === '.' ? '' : `${key(path).replace(/\/$/, '')}/`;
      return [...directories, ...tree.keys()]
        .filter((entry) => entry.startsWith(prefix) && entry !== prefix)
        .map((entry) => entry.slice(prefix.length).split('/')[0] ?? '')
        .filter((entry, index, all) => entry !== '' && all.indexOf(entry) === index);
    },
  };
  return { source, tree };
}

describe('la lecture des faits ne décide de rien', () => {
  it('trouve les variables lues, et écarte ce qui n’est pas de la configuration', () => {
    const text = [
      'const a = process.env.DATABASE_URL;',
      'const b = process.env["REDIS_URL"];',
      'const c = process.env.NEXT_PUBLIC_SENTRY_DSN;',
      'const d = process.env.NODE_ENV;',
      'const e = process.env.PF_E2E_SKIP;',
      'const f = process.env.GIT_AUTHOR_NAME;',
      'const g = process.env.PATH;',
    ].join('\n');
    expect(envNamesIn(text)).toEqual(['DATABASE_URL', 'NEXT_PUBLIC_SENTRY_DSN', 'REDIS_URL']);
  });

  it('lit les scripts et les dépendances sans exploser sur un JSON cassé', () => {
    const pkg = JSON.stringify({
      name: 'mon-app',
      scripts: { test: 'vitest', build: 'tsdown' },
      dependencies: { next: '15' },
      devDependencies: { vitest: '5' },
    });
    expect(scriptsIn(pkg)).toEqual(['test', 'build']);
    expect(dependenciesIn(pkg)).toEqual(['next', 'vitest']);
    expect(scriptsIn('{ pas du json')).toEqual([]);
    expect(dependenciesIn(undefined)).toEqual([]);
    expect(scriptsIn(JSON.stringify({ scripts: 'oui' }))).toEqual([]);
  });

  it('préfère le nom du package.json, sinon le nom du dossier', () => {
    expect(nameIn(JSON.stringify({ name: 'quai3' }), '/tmp/x')).toBe('quai3');
    expect(nameIn(undefined, 'C:\\projets\\quai3\\')).toBe('quai3');
    expect(nameIn('{ cassé', '/tmp/mon-app')).toBe('mon-app');
    expect(nameIn(JSON.stringify({ name: '   ' }), '/tmp/mon-app')).toBe('mon-app');
  });
});

describe('readFacts ce que le Doctor voit d’un projet', () => {
  const catalogue = loadCatalogue();
  const registry = catalogue.ok ? catalogue.value : undefined;

  const manifest: Manifest = {
    manifestVersion: 1,
    name: 'quai3',
    targets: ['web'],
    architecture: 'single-app',
    frontend: { framework: 'next', language: 'typescript', styling: 'tailwind' },
    database: { engine: 'postgresql', orm: 'prisma' },
    quality: ['vitest'],
    infra: ['docker', 'github-actions'],
  };

  it('rassemble ce qu’un projet généré montre, et le nomme', async () => {
    const { source } = fakeSource(
      {
        'package.json': JSON.stringify({
          name: 'quai3',
          scripts: { test: 'vitest', build: 'next build' },
          dependencies: { next: '15.5.27', '@prisma/client': '7' },
          devDependencies: { vitest: '5', typescript: '6' },
        }),
        'tsconfig.json': '{}',
        'pnpm-lock.yaml': '',
        'README.md': '# Quai3',
        '.gitignore': 'node_modules',
        Dockerfile: 'FROM node:20',
        '.dockerignore': 'node_modules',
        '.env.example': 'DATABASE_URL\n',
        '.github/workflows/ci.yml': 'name: CI',
        'src/server.ts': 'const url = process.env.DATABASE_URL;',
      },
      ['node_modules', 'src'],
    );
    const facts = await readFacts(source, {
      manifest,
      registry,
      name: 'quai3',
    });

    expect(facts).toMatchObject({
      name: 'quai3',
      typescript: true,
      packageManager: true,
      installed: true,
      gitignore: true,
      docker: true,
      dockerignore: true,
      tests: true,
      ci: true,
      envExample: true,
      readme: true,
      envUsed: ['DATABASE_URL'],
    });
    // Les technologies viennent du manifest **et** des dépendances : les deux
    // comptent pour constater un écart entre la pile annoncée et l'installé.
    expect(facts.technologies).toContain('next');
    expect(facts.expectedPackages.find((entry) => entry.id === 'next')?.packages).toContain('next');
    // Un identifiant que le catalogue ne connaît pas n'entre pas dans les
    // constats : le catalogue reste seul juge de ce qui existe.
    expect(facts.catalogueIds.every((id) => registry?.get(id) !== undefined)).toBe(true);
    expect(runDoctor(facts, { nameOf: (id) => registry?.get(id)?.name }).score).toBeGreaterThan(0);
  });

  it('un projet nu est un projet constaté, pas un plantage', async () => {
    const { source } = fakeSource({ 'index.js': 'console.log("bonjour")' });
    const facts = await readFacts(source, { name: 'nu' });
    expect(facts.typescript).toBe(false);
    expect(facts.installed).toBe(false);
    expect(facts.docker).toBe(false);
    expect(facts.envUsed).toEqual([]);
    expect(facts.name).toBe('nu');
    expect(facts.expectedPackages).toEqual([]);
  });
});

describe('applyFixes le Doctor propose, il n’écrase pas', () => {
  it('crée un fichier absent, et n’écrase jamais celui qui existe', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-doctor-create-'));
    await writeFile(join(root, '.dockerignore'), 'deja-la', 'utf8');
    const source = fileSourceAt(root);
    const written = await applyFixes(
      [
        { path: '.env.example', action: 'create', content: 'DATABASE_URL\n', reason: 'x' },
        { path: '.dockerignore', action: 'create', content: 'node_modules\n', reason: 'x' },
      ],
      source,
    );
    expect(written).toEqual(['.env.example']);
    expect(await readFile(join(root, '.env.example'), 'utf8')).toBe('DATABASE_URL\n');
    // Le fichier qui existait déjà est intact : c'est la promesse du `create`.
    expect(await readFile(join(root, '.dockerignore'), 'utf8')).toBe('deja-la');
    expect(await readdir(root)).toContain('.env.example');
  });

  it('fusionne un JSON sans écraser de clé, mais écrit pour de vrai', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-doctor-merge-'));
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ name: 'quai3', scripts: { test: 'vitest' } }, null, 2),
      'utf8',
    );
    const written = await applyFixes(
      [
        {
          path: 'package.json',
          action: 'merge-json',
          content: JSON.stringify({ scripts: { test: 'autre', health: 'pf doctor' } }),
          reason: 'x',
        },
      ],
      fileSourceAt(root),
    );
    expect(written).toEqual(['package.json']);
    const parsed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string;
      scripts: Record<string, string>;
    };
    // `test` existait : il n'est pas remplacé. `health` est ajouté.
    expect(parsed.scripts).toEqual({ test: 'vitest', health: 'pf doctor' });
    expect(parsed.name).toBe('quai3');
  });

  it('ignore un merge-json sur un fichier illisible plutôt que de le réécrire', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-doctor-broken-'));
    await writeFile(join(root, 'package.json'), '{ pas du json', 'utf8');
    const written = await applyFixes(
      [
        {
          path: 'package.json',
          action: 'merge-json',
          content: JSON.stringify({ scripts: { health: 'pf doctor' } }),
          reason: 'x',
        },
      ],
      fileSourceAt(root),
    );
    expect(written).toEqual([]);
    expect(await readFile(join(root, 'package.json'), 'utf8')).toBe('{ pas du json');
  });

  it('n’écrit rien pour un fichier qui n’existe pas et qu’il faudrait compléter', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-doctor-missing-'));
    const written = await applyFixes(
      [
        {
          path: 'package.json',
          action: 'merge-json',
          content: JSON.stringify({ scripts: { health: 'pf doctor' } }),
          reason: 'x',
        },
      ],
      fileSourceAt(root),
    );
    expect(written).toEqual([]);
  });
});

describe('formatReport le rapport se lit', () => {
  it('affiche le score, les symboles du §16 et les corrections proposées', () => {
    const report = runDoctor(
      {
        name: 'quai3',
        dependencies: [],
        scripts: [],
        typescript: false,
        packageManager: false,
        installed: false,
        gitignore: false,
        docker: false,
        dockerignore: false,
        tests: false,
        ci: false,
        envExample: false,
        envUsed: ['DATABASE_URL'],
        readme: false,
        technologies: [],
        expectedPackages: [],
        catalogueIds: [],
      },
      { nameOf: () => undefined },
    );
    const text = formatReport(report, 'quai3');
    expect(text).toContain('quai3 · santé du projet :');
    expect(text).toContain('✕ Variables d’environnement');
    expect(text).toContain('Corrections proposées :');
    expect(text).toContain('.env.example');
    expect(text).toContain('point(s) ouvert(s)');
  });

  it('dit « rien à corriger » quand tous les constats sont sans objet', () => {
    const report = runDoctor(
      {
        name: 'vide',
        dependencies: ['next', 'rate-limiter-flexible'],
        scripts: ['test', 'health'],
        typescript: true,
        packageManager: true,
        installed: true,
        gitignore: true,
        docker: false,
        dockerignore: false,
        tests: true,
        ci: true,
        envExample: true,
        envUsed: [],
        readme: true,
        technologies: [],
        expectedPackages: [],
        catalogueIds: ['sentry'],
      },
      { nameOf: () => undefined },
    );
    expect(report.checks.filter((entry) => entry.status === 'warn')).toHaveLength(0);
    expect(formatReport(report, 'vide')).toContain('Rien à corriger.');
  });
});

describe('un manifest sérialisé reste lisible par le Doctor', () => {
  it('relit ce qu’il vient d’écrire', () => {
    const { source } = fakeSource({
      'pf.manifest.json': serializeManifest({
        manifestVersion: 1,
        name: 'quai3',
        targets: ['web'],
        architecture: 'single-app',
        frontend: { framework: 'next', language: 'typescript' },
      }),
    });
    expect(source.read('pf.manifest.json')).toBeDefined();
  });
});

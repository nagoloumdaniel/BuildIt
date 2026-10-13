import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Manifest } from '@buildit/manifest';
import { loadCatalogue } from '@buildit/registry';
import { afterEach, describe, expect, it } from 'vitest';
import { generateProject, planProject } from './pipeline.js';
import type { CommandResult, CommandRunner } from './postinstall.js';

/**
 * Projets hors Node (COBOL, Flutter) et applications natives Node (Expo,
 * Electron, Tauri) : chacun reçoit le socle de **sa** chaîne d'outils, et le
 * pipeline lance **ses** commandes — jamais un `pnpm install` dans un dossier
 * sans package.json.
 */

const created: string[] = [];

async function tempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'pf-toolchain-'));
  created.push(path);
  return path;
}

afterEach(async () => {
  while (created.length > 0) {
    const path = created.pop();
    if (path !== undefined) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

function fakeRunner(): CommandRunner & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async run(command, args): Promise<CommandResult> {
      calls.push(`${command} ${args.join(' ')}`);
      return command === 'git' && args[0] === 'rev-parse'
        ? { exitCode: 128, output: 'fatal: not a git repository' }
        : { exitCode: 0, output: '' };
    },
  };
}

const COBOL: Manifest = {
  manifestVersion: 1,
  name: 'batch',
  targets: ['library'],
  architecture: 'single-app',
  services: ['cobol', 'gnucobol', 'make'],
  quality: ['cobol-check'],
  infra: ['docker', 'github-actions'],
};

const FLUTTER: Manifest = {
  manifestVersion: 1,
  name: 'mobile_app',
  targets: ['mobile'],
  architecture: 'single-app',
  mobile: { framework: 'flutter', language: 'dart' },
  infra: ['github-actions'],
};

const EXPO: Manifest = {
  manifestVersion: 1,
  name: 'poche',
  targets: ['mobile'],
  architecture: 'single-app',
  mobile: { framework: 'expo', language: 'typescript' },
  quality: ['biome'],
  infra: ['github-actions'],
};

const ELECTRON: Manifest = {
  manifestVersion: 1,
  name: 'bureau',
  targets: ['desktop'],
  architecture: 'single-app',
  desktop: { framework: 'electron' },
  services: ['typescript'],
  quality: ['biome', 'vitest'],
};

const TAURI: Manifest = {
  manifestVersion: 1,
  name: 'fenetre',
  targets: ['desktop'],
  architecture: 'single-app',
  desktop: { framework: 'tauri' },
  services: ['typescript'],
  quality: ['biome'],
};

function plannedFiles(manifest: Manifest, target = '/tmp/p'): Map<string, string> {
  const planned = planProject(manifest, target);
  if (!planned.ok) {
    throw new Error(planned.issues.map((issue) => `${issue.code} ${issue.message}`).join(' | '));
  }
  return new Map(planned.value.plan.files.map((file) => [file.path, file.contents]));
}

function contents(files: Map<string, string>, path: string): string {
  const found = files.get(path);
  if (found === undefined) {
    throw new Error(`fichier absent : ${path} (présents : ${[...files.keys()].join(', ')})`);
  }
  return found;
}

describe('les fiches natives sont certifiées', () => {
  const registry = loadCatalogue();
  it.each([
    'cobol',
    'gnucobol',
    'make',
    'cobol-check',
    'expo',
    'flutter',
    'dart',
    'electron',
    'tauri',
  ])('%s', (id) => {
    expect(registry.ok && registry.value.get(id)?.generation).toBe('certified');
  });
});

describe('COBOL : GnuCOBOL, Make, cobol-check', () => {
  it('pose un projet Make, sans package.json', () => {
    const files = plannedFiles(COBOL);
    expect(files.has('package.json')).toBe(false);
    expect(files.has('pnpm-workspace.yaml')).toBe(false);
    expect(contents(files, 'Makefile')).toMatch(/^build:/m);
    expect(contents(files, 'Makefile')).toMatch(/^start:/m);
    expect(contents(files, 'cobol-check.mk')).toMatch(/^test:/m);
    expect(contents(files, 'src/main/cobol/HELLO.CBL')).toContain('PROGRAM-ID. HELLO.');
    expect(files.has('src/test/cobol/HELLO/GreetingTest.cut')).toBe(true);
    expect(contents(files, '.gitignore')).toContain('.cobol-check/');
    expect(contents(files, 'README.md')).toContain('make build');
  });

  it('CI et Dockerfile parlent GnuCOBOL, pas pnpm', () => {
    const files = plannedFiles(COBOL);
    const ci = contents(files, '.github/workflows/ci.yml');
    expect(ci).toContain('gnucobol3');
    expect(ci).toContain('run: make build');
    expect(ci).toContain('run: make test');
    expect(ci).not.toContain('pnpm');
    const dockerfile = contents(files, 'Dockerfile');
    expect(dockerfile).toContain('FROM debian:trixie-slim');
    expect(dockerfile).toContain('gnucobol3');
    expect(dockerfile).toContain('USER ');
    expect(dockerfile).not.toContain('pnpm');
  });

  it('le pipeline lance make, jamais pnpm', async () => {
    const runner = fakeRunner();
    const result = await generateProject(COBOL, join(await tempDir(), 'p'), {
      runner,
      install: true,
      git: true,
      validate: true,
    });
    expect(result.ok, result.ok ? '' : result.issues.map((i) => i.message).join()).toBe(true);
    expect(runner.calls.filter((call) => !call.startsWith('git '))).toEqual([
      'make build',
      'make test',
    ]);
  });

  it('sans cobol-check, pas de cible test ni de fichiers de test', () => {
    const files = plannedFiles({ ...COBOL, quality: undefined });
    expect(files.has('cobol-check.mk')).toBe(false);
    expect(files.has('src/test/cobol/HELLO/GreetingTest.cut')).toBe(false);
    expect(contents(files, '.github/workflows/ci.yml')).not.toContain('make test');
  });
});

describe('Flutter', () => {
  it('pose un projet pub, sans package.json', () => {
    const files = plannedFiles(FLUTTER);
    expect(files.has('package.json')).toBe(false);
    expect(contents(files, 'pubspec.yaml')).toContain('name: mobile_app');
    expect(files.has('lib/main.dart')).toBe(true);
    expect(files.has('test/widget_test.dart')).toBe(true);
    expect(contents(files, '.github/workflows/ci.yml')).toContain('run: flutter test');
  });

  it('le pipeline lance flutter', async () => {
    const runner = fakeRunner();
    const result = await generateProject(FLUTTER, join(await tempDir(), 'p'), {
      runner,
      install: true,
      validate: true,
    });
    expect(result.ok, result.ok ? '' : result.issues.map((i) => i.message).join()).toBe(true);
    expect(runner.calls).toEqual([
      'flutter pub get',
      'flutter analyze',
      'flutter test',
      'flutter build web',
    ]);
  });
});

describe('applications natives Node', () => {
  it('Expo : application, scripts et export Android', () => {
    const files = plannedFiles(EXPO);
    const pkg = JSON.parse(contents(files, 'package.json')) as {
      main?: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.main).toBe('index.ts');
    expect(pkg.scripts['build']).toContain('expo export');
    expect(pkg.dependencies['expo']).toBeDefined();
    expect(pkg.dependencies['react-native']).toBeDefined();
    expect(files.has('App.tsx')).toBe(true);
    expect(contents(files, 'app.json')).toContain('"slug": "poche"');
  });

  it('Electron : processus principal compilé, lancé par electron', () => {
    const files = plannedFiles(ELECTRON);
    const pkg = JSON.parse(contents(files, 'package.json')) as {
      main?: string;
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.main).toBe('dist/main.js');
    expect(pkg.scripts['build']).toContain('tsc -p tsconfig.build.json');
    expect(pkg.scripts['start']).toContain('electron');
    expect(pkg.devDependencies['electron']).toBeDefined();
    expect(files.has('src/main.ts')).toBe(true);
    expect(files.has('tsconfig.build.json')).toBe(true);
  });

  it('Tauri : interface Vite et crate src-tauri', () => {
    const files = plannedFiles(TAURI);
    const pkg = JSON.parse(contents(files, 'package.json')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['build']).toBe('vite build');
    expect(contents(files, 'src-tauri/Cargo.toml')).toContain('tauri =');
    expect(contents(files, 'src-tauri/tauri.conf.json')).toContain('"frontendDist": "../dist"');
    expect(files.has('src-tauri/src/main.rs')).toBe(true);
  });
});

describe('une chaîne d’outils ne se mélange pas à Node dans la même application', () => {
  it('COBOL avec Biome : refus nommé, pas un package.json orphelin', () => {
    const planned = planProject({ ...COBOL, quality: ['cobol-check', 'biome'] }, '/tmp/p');
    expect(planned.ok).toBe(false);
    if (!planned.ok) {
      expect(planned.issues.map((issue) => issue.code)).toContain('GEN_TOOLCHAIN_MIXED');
      expect(planned.issues[0]?.message).toContain('Biome');
    }
  });
});

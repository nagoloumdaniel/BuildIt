import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CommandRunner } from '@project-factory/exec';
import { describe, expect, it } from 'vitest';
import { type Detection, detectProject, formatCommand, install, installCommand } from './index.js';

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'pf-workspace-'));
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

async function detect(files: Record<string, string>): Promise<Detection> {
  const result = await detectProject(await project(files));
  if (!result.ok) {
    throw new Error(result.issues[0]?.message);
  }
  return result.value;
}

const PKG = JSON.stringify({ name: 'demo' });

describe('detectProject — JavaScript', () => {
  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
    ['npm-shrinkwrap.json', 'npm'],
  ])('%s ⇒ %s, et on dit d’où on le sait', async (lockfile, manager) => {
    const detection = await detect({ 'package.json': PKG, [lockfile]: '' });
    expect(detection).toMatchObject({
      ecosystem: 'node',
      packageManager: manager,
      source: 'lockfile',
      evidence: lockfile,
      warnings: [],
    });
  });

  it('sans verrou, le champ packageManager décide, version comprise', async () => {
    const detection = await detect({
      'package.json': JSON.stringify({ packageManager: 'yarn@4.5.0+sha512.abc' }),
    });
    expect(detection).toMatchObject({
      packageManager: 'yarn',
      packageManagerVersion: '4.5.0',
      source: 'packageManager',
    });
  });

  it('ni verrou ni champ : npm, annoncé comme une supposition', async () => {
    const detection = await detect({ 'package.json': PKG });
    expect(detection.source).toBe('assumed');
    expect(detection.packageManager).toBe('npm');
    expect(detection.warnings).toEqual([
      'Ni verrou ni champ packageManager : npm est une supposition.',
    ]);
  });

  it('un packageManager inconnu ou mal formé est ignoré', async () => {
    for (const value of ['deno@2.0.0', 'pnpm', 42]) {
      const detection = await detect({ 'package.json': JSON.stringify({ packageManager: value }) });
      expect(detection.source).toBe('assumed');
    }
  });

  it('plusieurs verrous : on suit le premier, et on le dit', async () => {
    const detection = await detect({
      'package.json': PKG,
      'pnpm-lock.yaml': '',
      'package-lock.json': '',
    });
    expect(detection.packageManager).toBe('pnpm');
    expect(detection.warnings[0]).toContain(
      'Plusieurs verrous : pnpm-lock.yaml, package-lock.json',
    );
  });

  it('verrou et packageManager en désaccord : le verrou gagne, avertissement', async () => {
    const detection = await detect({
      'package.json': JSON.stringify({ packageManager: 'yarn@4.0.0' }),
      'pnpm-lock.yaml': '',
    });
    expect(detection.packageManager).toBe('pnpm');
    expect(detection.packageManagerVersion).toBeUndefined();
    expect(detection.warnings[0]).toContain('on suit le verrou');
  });

  it('verrou et packageManager d’accord : la version est gardée', async () => {
    const detection = await detect({
      'package.json': JSON.stringify({ packageManager: 'pnpm@11.1.0' }),
      'pnpm-lock.yaml': '',
    });
    expect(detection.packageManagerVersion).toBe('11.1.0');
  });

  it('un package.json illisible n’empêche pas la détection', async () => {
    const detection = await detect({ 'package.json': '{ cassé', 'yarn.lock': '' });
    expect(detection.packageManager).toBe('yarn');
    expect(detection.warnings[0]).toContain('illisible');
  });

  it('un package.json qui n’est pas un objet est sans packageManager', async () => {
    const detection = await detect({ 'package.json': 'null' });
    expect(detection.source).toBe('assumed');
  });
});

describe('detectProject — autres écosystèmes', () => {
  it.each([
    [{ 'pyproject.toml': '', 'uv.lock': '' }, 'python', 'uv sync'],
    [{ 'pyproject.toml': '', 'poetry.lock': '' }, 'python', 'poetry install'],
    [{ 'pyproject.toml': '' }, 'python', 'pip install .'],
    [{ 'requirements.txt': '' }, 'python', 'pip install -r requirements.txt'],
    [{ 'Cargo.toml': '' }, 'rust', 'cargo fetch'],
    [{ 'go.mod': '' }, 'go', 'go mod download'],
    [{ 'composer.json': '' }, 'php', 'composer install'],
    [{ Gemfile: '' }, 'ruby', 'bundle install'],
  ])('%o ⇒ %s, commande à lancer soi-même : %s', async (files, ecosystem, command) => {
    const detection = await detect(files);
    expect(detection).toMatchObject({ ecosystem, manualCommand: command, source: 'manifest' });
    expect(detection.packageManager).toBeUndefined();
    expect(installCommand(detection)).toBeUndefined();
  });
});

describe('detectProject — refus', () => {
  it('dossier absent', async () => {
    const result = await detectProject('/pf/absent/nulle-part');
    expect(!result.ok && result.issues[0]?.code).toBe('WORKSPACE_NOT_FOUND');
  });

  it('un fichier n’est pas un dossier', async () => {
    const dir = await project({ 'a.txt': '' });
    const result = await detectProject(join(dir, 'a.txt'));
    expect(!result.ok && result.issues[0]?.code).toBe('WORKSPACE_NOT_A_DIRECTORY');
  });

  it('dossier sans projet reconnu : dit quoi chercher', async () => {
    const result = await detectProject(await project({ 'notes.md': '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('WORKSPACE_UNKNOWN');
      expect(result.issues[0]?.hint).toContain('pf create');
    }
  });
});

describe('installCommand', () => {
  const node = (packageManager: Detection['packageManager'], version?: string): Detection => ({
    ecosystem: 'node',
    label: 'JavaScript / TypeScript',
    ...(packageManager === undefined ? {} : { packageManager }),
    ...(version === undefined ? {} : { packageManagerVersion: version }),
    source: 'lockfile',
    evidence: 'x',
    warnings: [],
  });

  it.each([
    ['pnpm', undefined, 'pnpm install --ignore-scripts'],
    ['npm', undefined, 'npm install --ignore-scripts'],
    ['bun', undefined, 'bun install --ignore-scripts'],
    ['yarn', undefined, 'yarn install --ignore-scripts'],
    ['yarn', '1.22.22', 'yarn install --ignore-scripts'],
    ['yarn', '4.5.0', 'yarn install --mode=skip-build'],
  ] as const)('%s %s sans scripts : %s', (manager, version, expected) => {
    const command = installCommand(node(manager, version), { ignoreScripts: true });
    expect(command && formatCommand(command)).toBe(expected);
  });

  it('par défaut, l’installation normale', () => {
    const command = installCommand(node('pnpm'));
    expect(command).toEqual({ command: 'pnpm', args: ['install'] });
  });
});

describe('install', () => {
  const runner = (
    answer: { exitCode: number; output: string } | 'absent',
  ): CommandRunner & {
    calls: string[];
  } => {
    const calls: string[] = [];
    return {
      calls,
      async run(command, args) {
        calls.push([command, ...args].join(' '));
        if (answer === 'absent') {
          throw new Error('ENOENT');
        }
        return answer;
      },
    };
  };

  it('lance exactement la commande affichée', async () => {
    const detection = await detect({ 'package.json': PKG, 'pnpm-lock.yaml': '' });
    const fake = runner({ exitCode: 0, output: '' });
    expect(await install(detection, '/p', fake, { ignoreScripts: true })).toBeUndefined();
    expect(fake.calls).toEqual(['pnpm install --ignore-scripts']);
  });

  it('un échec rend la fin de la sortie, et dit si relancer a un sens', async () => {
    const detection = await detect({ 'package.json': PKG, 'pnpm-lock.yaml': '' });
    const failure = await install(
      detection,
      '/p',
      runner({ exitCode: 1, output: 'getaddrinfo EAI_AGAIN' }),
    );
    expect(failure?.retryable).toBe(true);
    expect(failure?.issues[0]?.code).toBe('WORKSPACE_INSTALL_FAILED');
    expect(failure?.issues[0]?.message).toContain('pnpm install');
  });

  it('gestionnaire absent : la piste Corepack, ou Node pour npm', async () => {
    const pnpm = await detect({ 'package.json': PKG, 'pnpm-lock.yaml': '' });
    const npm = await detect({ 'package.json': PKG });
    expect((await install(pnpm, '/p', runner('absent')))?.issues[0]?.hint).toContain(
      'corepack enable pnpm',
    );
    expect((await install(npm, '/p', runner('absent')))?.issues[0]?.hint).toContain('Node.js');
  });

  it('hors JavaScript : rien n’est lancé, la commande à taper est donnée', async () => {
    const detection = await detect({ 'Cargo.toml': '' });
    const fake = runner({ exitCode: 0, output: '' });
    const failure = await install(detection, '/p', fake);
    expect(fake.calls).toEqual([]);
    expect(failure?.issues[0]?.code).toBe('WORKSPACE_NOT_AUTOMATED');
    expect(failure?.issues[0]?.message).toContain('cargo fetch');
  });
});

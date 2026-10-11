import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { CommandResult, CommandRunner } from '@project-factory/exec';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectProjectAction, installProjectAction } from '../actions-node';
import {
  inspectProject,
  installProject,
  refuseMissingDirectory,
  resolveLocalDirectory,
} from './project';

/**
 * Ouvrir un projet local : de la vraie lecture de fichiers, un **faux runner**
 * pour les commandes. Aucune installation n'est réellement lancée.
 */

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

function fakeRunner(result: CommandResult = { exitCode: 0, output: '' }): {
  readonly runner: CommandRunner;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    runner: {
      async run(command, args, cwd) {
        calls.push({ command, args, cwd });
        return result;
      },
    },
  };
}

const created: string[] = [];

async function tempDir(prefix = 'pf-web-open-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  created.push(dir);
  return dir;
}

async function nodeProject(files: Record<string, string>): Promise<string> {
  const dir = await tempDir();
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  return dir;
}

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('resolveLocalDirectory — un chemin validé avant tout accès disque', () => {
  it('refuse un chemin relatif, vide ou porteur de caractères de contrôle', () => {
    expect(resolveLocalDirectory('mon-projet').ok).toBe(false);
    expect(resolveLocalDirectory('').ok).toBe(false);
    expect(resolveLocalDirectory('   ').ok).toBe(false);
    expect(resolveLocalDirectory('..\\ailleurs').ok).toBe(false);
    expect(resolveLocalDirectory('C:\\a\u0000b').ok).toBe(false);
    expect(resolveLocalDirectory(42).ok).toBe(false);
    expect(resolveLocalDirectory(undefined).ok).toBe(false);
  });

  it('accepte un chemin absolu et le normalise', async () => {
    const dir = await tempDir();
    const resolved = resolveLocalDirectory(dir);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value).toBe(resolve(dir));
    }
    expect(resolveLocalDirectory(`${dir}${join('/')}`).ok).toBe(true);
  });
});

describe('refuseMissingDirectory', () => {
  it('dit qu’un dossier manque, ou que ce n’est pas un dossier', async () => {
    const dir = await tempDir();
    expect(await refuseMissingDirectory(dir)).toBeUndefined();
    expect(await refuseMissingDirectory(join(dir, 'absent'))).toContain('n’existe pas');

    const file = join(dir, 'fichier.txt');
    await writeFile(file, 'x');
    expect(await refuseMissingDirectory(file)).toContain('n’est pas un dossier');
  });
});

describe('inspectProject — détecter, sans rien lancer', () => {
  it('détecte pnpm d’après son verrou et annonce la commande exacte', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app' }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    });

    const inspection = await inspectProject(dir);

    expect(inspection.ok).toBe(true);
    if (!inspection.ok) {
      return;
    }
    expect(inspection.value.packageManager).toBe('pnpm');
    expect(inspection.value.source).toBe('lockfile');
    expect(inspection.value.evidence).toBe('pnpm-lock.yaml');
    expect(inspection.value.origin).toBe('d’après pnpm-lock.yaml');
    expect(inspection.value.plainCommand).toBe('pnpm install');
    expect(inspection.value.safeCommand).toBe('pnpm install --ignore-scripts');
    expect(inspection.value.description).toBe(
      'JavaScript / TypeScript — pnpm (d’après pnpm-lock.yaml)',
    );
  });

  it('suit le verrou plutôt que le champ packageManager, et le dit', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app', packageManager: 'yarn@4.1.0' }),
      'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    });

    const inspection = await inspectProject(dir);

    expect(inspection.ok).toBe(true);
    if (inspection.ok) {
      expect(inspection.value.packageManager).toBe('pnpm');
      expect(inspection.value.warnings.join(' ')).toContain('on suit le verrou');
    }
  });

  it('déduit le gestionnaire du champ packageManager, et adapte yarn 4', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app', packageManager: 'yarn@4.1.0' }),
    });

    const inspection = await inspectProject(dir);

    expect(inspection.ok).toBe(true);
    if (inspection.ok) {
      expect(inspection.value.packageManager).toBe('yarn');
      expect(inspection.value.source).toBe('packageManager');
      expect(inspection.value.safeCommand).toBe('yarn install --mode=skip-build');
    }
  });

  it('annonce npm comme une supposition quand rien ne le dit', async () => {
    const dir = await nodeProject({ 'package.json': JSON.stringify({ name: 'mon-app' }) });

    const inspection = await inspectProject(dir);

    expect(inspection.ok).toBe(true);
    if (inspection.ok) {
      expect(inspection.value.packageManager).toBe('npm');
      expect(inspection.value.source).toBe('assumed');
      expect(inspection.value.warnings.join(' ')).toContain('supposition');
    }
  });

  it('nomme les écosystèmes non JavaScript et leur commande manuelle', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'pyproject.toml'), '[project]\nname = "mon-app"\n');
    await writeFile(join(dir, 'uv.lock'), '');

    const inspection = await inspectProject(dir);

    expect(inspection.ok).toBe(true);
    if (inspection.ok) {
      expect(inspection.value.ecosystem).toBe('python');
      expect(inspection.value.manualCommand).toBe('uv sync');
      expect(inspection.value.plainCommand).toBeUndefined();
    }
  });

  it('refuse un dossier sans manifeste reconnu, et sans lever', async () => {
    const dir = await tempDir();
    const inspection = await inspectProject(dir);

    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.issues.join(' ')).toContain('Aucun projet reconnu');
    }
  });
});

describe('installProject — seulement ce qui a été confirmé', () => {
  it('lance la commande du gestionnaire détecté, dans le dossier du projet', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app' }),
      'pnpm-lock.yaml': '',
    });
    const fake = fakeRunner();

    const result = await installProject(dir, false, fake.runner);

    expect(result.ok).toBe(true);
    expect(result.command).toBe('pnpm install');
    expect(fake.calls).toEqual([{ command: 'pnpm', args: ['install'], cwd: dir }]);
  });

  it('ajoute --ignore-scripts quand on l’a demandé', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app' }),
      'pnpm-lock.yaml': '',
    });
    const fake = fakeRunner();

    const result = await installProject(dir, true, fake.runner);

    expect(result.ok).toBe(true);
    expect(result.command).toBe('pnpm install --ignore-scripts');
    expect(fake.calls[0]?.args).toEqual(['install', '--ignore-scripts']);
  });

  it('rend la sortie d’un échec et dit s’il vaut la peine de relancer', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app' }),
      'pnpm-lock.yaml': '',
    });
    const fake = fakeRunner({
      exitCode: 1,
      output: 'ERR_PNPM_META_FETCH_FAIL GET https://registry.npmjs.org/x',
    });

    const result = await installProject(dir, false, fake.runner);

    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.issues.join(' ')).toContain('a échoué');
  });

  it('refuse d’automatiser un écosystème non JavaScript, et donne la commande', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'Cargo.toml'), '[package]\nname = "mon-app"\n');
    const fake = fakeRunner();

    const result = await installProject(dir, false, fake.runner);

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('arrive en V1');
    expect(fake.calls).toHaveLength(0);
  });
});

describe('les Server Actions de l’écran 23 — rien sans un chemin valide', () => {
  it('refuse un chemin relatif avant tout accès disque', async () => {
    const inspection = await inspectProjectAction('mon-projet');
    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.issues.join(' ')).toContain('chemin absolu');
    }
    const install = await installProjectAction({ directory: 'mon-projet', ignoreScripts: true });
    expect(install.ok).toBe(false);
    expect(install.directory).toBe('');
  });

  it('reconnaît un vrai dossier absolu', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app' }),
      'package-lock.json': '{}',
    });

    const inspection = await inspectProjectAction(dir);

    expect(inspection.ok).toBe(true);
    if (inspection.ok) {
      expect(inspection.value.packageManager).toBe('npm');
    }
  });

  it('refuse un dossier qui n’existe pas, sans lever', async () => {
    const dir = await tempDir();
    const inspection = await inspectProjectAction(join(dir, 'absent'));

    expect(inspection.ok).toBe(false);
    if (!inspection.ok) {
      expect(inspection.issues.join(' ')).toContain('n’existe pas');
    }
  });

  it('n’écrit rien avec un dossier inexistant', async () => {
    const dir = await tempDir();
    const result = await installProjectAction({
      directory: join(dir, 'absent'),
      ignoreScripts: false,
    });

    expect(result.ok).toBe(false);
    expect(result.command).toBe('');
  });
});

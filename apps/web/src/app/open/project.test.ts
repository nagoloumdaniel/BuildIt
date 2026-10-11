import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  type CommandResult,
  type CommandRunner,
  nodeCommandRunner,
  type RunOptions,
} from '@project-factory/exec';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectProjectAction, installProjectAction } from '../actions-node';
import {
  inspectProject,
  installProject,
  refuseMissingDirectory,
  resolveLocalDirectory,
  withoutServerSecrets,
} from './project';

/**
 * Ouvrir un projet local : de la vraie lecture de fichiers, un **faux runner**
 * pour les commandes. Aucune installation n'est réellement lancée.
 */

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly options?: RunOptions;
}

function fakeRunner(result: CommandResult = { exitCode: 0, output: '' }): {
  readonly runner: CommandRunner;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    runner: {
      async run(command, args, cwd, options) {
        calls.push(
          options === undefined ? { command, args, cwd } : { command, args, cwd, options },
        );
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

  it.skipIf(process.platform !== 'win32')(
    'accepte un chemin UNC — constat M3 du rapport, non corrigé',
    () => {
      // Sonde de comportement, pas d'approbation : `\\serveur\partage` est
      // `isAbsolute` sous Windows, donc accepté, et `stat`/`detectProject`
      // feront sortir une authentification SMB. Décision : le serveur n'écoute
      // que sur 127.0.0.1 (8B.6) et un partage réseau est un usage légitime
      // (persona « entreprise ») ; le refus est écrit au rapport de sécurité
      // (docs/superpowers/specs/2026-10-11-phase8-security-review.md). Ce test
      // fige le comportement pour qu'il ne change pas par accident.
      expect(resolveLocalDirectory('\\\\serveur\\partage\\projet').ok).toBe(true);
    },
  );
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
    expect(fake.calls).toEqual([
      {
        command: 'pnpm',
        args: ['install'],
        cwd: dir,
        // Le jeton du serveur est vidé pour le code du projet (§24).
        options: { env: { PF_GITHUB_TOKEN: '' } },
      },
    ]);
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

describe('installProject — le jeton du serveur n’atteint pas le code du projet (§24)', () => {
  const SECRET = 'ghp_serveur_0123456789abcdefghij';

  it('neutralise PF_GITHUB_TOKEN dans l’environnement de la commande lancée', async () => {
    const dir = await nodeProject({
      'package.json': JSON.stringify({ name: 'mon-app' }),
      'pnpm-lock.yaml': '',
    });
    const fake = fakeRunner();
    const saved = process.env['PF_GITHUB_TOKEN'];
    process.env['PF_GITHUB_TOKEN'] = SECRET;
    try {
      await installProject(dir, true, fake.runner);
    } finally {
      if (saved === undefined) {
        delete process.env['PF_GITHUB_TOKEN'];
      } else {
        process.env['PF_GITHUB_TOKEN'] = saved;
      }
    }

    // La variable est présente mais vidée : le `postinstall` du projet lit une
    // chaîne vide, pas le jeton du serveur.
    expect(fake.calls[0]?.options?.env?.['PF_GITHUB_TOKEN']).toBe('');
  });

  it('sonde le risque réel : sans le garde-fou, le processus hérite du jeton', async () => {
    // Sonde réaliste : un vrai processus Node, qui lit l'environnement comme le
    // ferait un `postinstall`. Elle prouve le risque ET la fermeture.
    const read = ['-e', 'process.stdout.write(process.env.PF_GITHUB_TOKEN ?? "<absent>")'];
    const saved = process.env['PF_GITHUB_TOKEN'];
    process.env['PF_GITHUB_TOKEN'] = SECRET;
    try {
      const brut = await nodeCommandRunner.run(process.execPath, read, process.cwd());
      expect(brut.output).toBe(SECRET);

      const ferme = await withoutServerSecrets(nodeCommandRunner).run(
        process.execPath,
        read,
        process.cwd(),
      );
      expect(ferme.output).toBe('');
    } finally {
      if (saved === undefined) {
        delete process.env['PF_GITHUB_TOKEN'];
      } else {
        process.env['PF_GITHUB_TOKEN'] = saved;
      }
    }
  });

  it('ne touche pas aux variables ajoutées par l’appelant (PF_GIT_TOKEN)', async () => {
    const fake = fakeRunner();
    await withoutServerSecrets(fake.runner).run('git', ['push'], process.cwd(), {
      env: { PF_GIT_TOKEN: 'jeton-du-helper' },
    });

    expect(fake.calls[0]?.options?.env?.['PF_GIT_TOKEN']).toBe('jeton-du-helper');
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

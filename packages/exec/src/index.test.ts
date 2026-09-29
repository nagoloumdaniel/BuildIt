import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  isTransientFailure,
  nodeCommandRunner,
  outputTail,
  resolveCommand,
  resolveWindowsCommand,
} from './index.js';

describe('nodeCommandRunner — le seul exécuteur réel', () => {
  it('rend le code de sortie et la sortie combinée', async () => {
    const result = await nodeCommandRunner.run(
      process.execPath,
      ['-e', 'process.stdout.write("out");process.stderr.write("err");process.exit(3)'],
      process.cwd(),
    );
    expect(result.exitCode).toBe(3);
    expect(result.output).toContain('out');
    expect(result.output).toContain('err');
  });

  it('ne passe jamais par un shell : un argument reste un argument', async () => {
    const result = await nodeCommandRunner.run(
      process.execPath,
      ['-e', 'process.stdout.write(process.argv[1])', '$(echo injecte); echo ; rm -rf x'],
      process.cwd(),
    );
    expect(result.output).toBe('$(echo injecte); echo ; rm -rf x');
  });

  it('rejette quand la commande n’existe pas', async () => {
    await expect(
      nodeCommandRunner.run('pf-commande-qui-n-existe-pas', [], process.cwd()),
    ).rejects.toThrow();
  });
});

describe('nodeCommandRunner — entrée standard et environnement', () => {
  it('passe `input` sur l’entrée standard, jamais en argument', async () => {
    const result = await nodeCommandRunner.run(
      process.execPath,
      ['-e', 'process.stdin.pipe(process.stdout)'],
      process.cwd(),
      { input: 'secret-par-stdin' },
    );
    expect(result.output).toBe('secret-par-stdin');
  });

  it('ajoute `env` à la commande seule, pas au processus courant', async () => {
    const result = await nodeCommandRunner.run(
      process.execPath,
      [
        '-e',
        'process.stdout.write(process.env.PF_TEST_VAR + ":" + (process.env.PATH ? "path" : ""))',
      ],
      process.cwd(),
      { env: { PF_TEST_VAR: 'valeur' } },
    );
    expect(result.output).toBe('valeur:path');
    expect(process.env['PF_TEST_VAR']).toBeUndefined();
  });
});

/**
 * La résolution Windows ne tourne que sous Windows, mais sa logique — chercher
 * dans le PATH, lancer le script JavaScript derrière un `.cmd` — se vérifie
 * partout avec de faux dossiers. Sans ces tests, la CI Linux ne l'exécuterait
 * jamais.
 */
describe('resolveWindowsCommand — aucun shell, même pour un .cmd', () => {
  const created: string[] = [];
  afterEach(async () => {
    while (created.length > 0) {
      await rm(created.pop() as string, { recursive: true, force: true });
    }
  });

  async function directory(files: string[]): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'pf-path-'));
    created.push(root);
    for (const file of files) {
      await mkdir(join(root, file, '..'), { recursive: true });
      await writeFile(join(root, file), '');
    }
    return root;
  }

  it('un vrai exécutable se lance tel quel', async () => {
    const bin = await directory(['git.exe']);
    expect(resolveWindowsCommand('git', bin)).toEqual({ file: join(bin, 'git.exe'), prefix: [] });
  });

  it('un lanceur .cmd de paquet npm : Node lance le script qu’il cache', async () => {
    const bin = await directory(['pnpm.cmd', 'node_modules/pnpm/bin/pnpm.cjs']);
    expect(resolveWindowsCommand('pnpm', bin)).toEqual({
      file: process.execPath,
      prefix: [join(bin, 'node_modules/pnpm/bin/pnpm.cjs')],
    });
  });

  it('un .cmd sans script JavaScript voisin n’est jamais confié à cmd.exe', async () => {
    const bin = await directory(['outil.cmd']);
    expect(resolveWindowsCommand('outil', bin)).toEqual({ file: 'outil', prefix: [] });
  });

  it('cherche dans chaque dossier du PATH, dans l’ordre', async () => {
    const empty = await directory([]);
    const bin = await directory(['git.exe']);
    expect(resolveWindowsCommand('git', `${empty};;${bin}`).file).toBe(join(bin, 'git.exe'));
  });

  it('introuvable : la commande est rendue telle quelle, spawn dira ENOENT', () => {
    expect(resolveWindowsCommand('absente', '')).toEqual({ file: 'absente', prefix: [] });
  });
});

describe('resolveCommand', () => {
  it('hors Windows, la commande est lancée telle quelle', () => {
    expect(resolveCommand('git', 'linux')).toEqual({ file: 'git', prefix: [] });
  });

  it('sous Windows, passe par la résolution sans shell', () => {
    expect(resolveCommand('pf-absente-partout', 'win32')).toEqual({
      file: 'pf-absente-partout',
      prefix: [],
    });
  });
});

describe('nodeCommandRunner — processus tué', () => {
  it.skipIf(process.platform === 'win32')(
    'un processus tué par un signal sort en échec',
    async () => {
      const result = await nodeCommandRunner.run(
        process.execPath,
        ['-e', 'process.kill(process.pid, "SIGKILL")'],
        process.cwd(),
      );
      expect(result.exitCode).toBe(1);
    },
  );
});

describe('outputTail', () => {
  it('garde les 20 dernières lignes, sans blancs finaux', () => {
    const output = `${Array.from({ length: 30 }, (_, i) => `ligne ${i}`).join('\n')}\n\n`;
    const lines = outputTail(output).split('\n');
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe('ligne 10');
    expect(lines.at(-1)).toBe('ligne 29');
  });
});

describe('isTransientFailure — git aussi', () => {
  it.each([
    "fatal: unable to access 'https://github.com/a/b.git/': Could not resolve host: github.com",
    'fatal: unable to access: Failed to connect to github.com port 443',
    'error: RPC failed; curl 56 GnuTLS recv error',
    'fatal: early EOF',
    'The requested URL returned error: 502',
  ])('%s', (output) => {
    expect(isTransientFailure(output)).toBe(true);
  });

  it.each([
    'remote: Repository not found.',
    'fatal: Authentication failed for',
    'The requested URL returned error: 403',
  ])('pas passager : %s', (output) => {
    expect(isTransientFailure(output)).toBe(false);
  });
});

import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CommandRunner, nodeCommandRunner, type RunOptions } from '@project-factory/exec';
import { describe, expect, it } from 'vitest';
import {
  cloneRepository,
  ensureInitialCommit,
  isGitFailure,
  pushToNewOrigin,
  repositoryState,
} from './operations.js';
import { type GitRemote, parseRemote } from './remote.js';

// Valeur de test, pas un jeton : assemblée à l'exécution pour que le scan de
// secrets ne la confonde pas avec un vrai.
const TOKEN = ['ghp', 'TestJetonFactice0123456789abcdefABCD'].join('_');

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly options: RunOptions | undefined;
}

type Answer = { exitCode: number; output: string } | 'absent';

/** Faux git : répond par sous-commande ; `onClone` simule ce qu'un clone écrit. */
function fakeGit(
  answers: Record<string, Answer> = {},
  onClone?: (target: string) => Promise<void>,
): CommandRunner & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async run(command, args, cwd, options) {
      calls.push({ command, args, cwd, options });
      const sub = args.find((arg) => !arg.startsWith('-') && !arg.includes('=')) ?? '';
      const answer =
        answers[`${sub} ${args.slice(args.indexOf(sub) + 1).join(' ')}`.trim()] ?? answers[sub];
      if (answer === 'absent') {
        throw new Error('ENOENT');
      }
      if (sub === 'clone' && onClone !== undefined) {
        await onClone(args.at(-1) as string);
      }
      return answer ?? { exitCode: 0, output: '' };
    },
  };
}

function remote(input: string): GitRemote {
  const parsed = parseRemote(input);
  if (!parsed.ok) {
    throw new Error(input);
  }
  return parsed.value;
}

const temp = (): Promise<string> => mkdtemp(join(tmpdir(), 'pf-git-'));

describe('cloneRepository', () => {
  it('durcit Git, sépare options et arguments, n’attend aucune saisie', async () => {
    const parent = await temp();
    const runner = fakeGit();
    expect(
      await cloneRepository(remote('octocat/Hello-World'), join(parent, 'hello'), { runner }),
    ).toBeUndefined();
    const [call] = runner.calls;
    expect(call?.args).toEqual([
      '-c',
      'protocol.ext.allow=never',
      '-c',
      'protocol.file.allow=never',
      'clone',
      '--',
      'https://github.com/octocat/Hello-World.git',
      join(parent, 'hello'),
    ]);
    expect(call?.options?.env).toMatchObject({ GIT_TERMINAL_PROMPT: '0' });
  });

  it('le jeton passe par l’environnement de git seul — jamais en argument ni dans l’URL', async () => {
    const runner = fakeGit();
    await cloneRepository(remote('octocat/Hello-World'), join(await temp(), 'x'), {
      runner,
      token: TOKEN,
    });
    const [call] = runner.calls;
    expect(call?.args.join(' ')).not.toContain(TOKEN);
    expect(call?.args.join(' ')).toContain('credential.helper=!f()');
    expect(call?.options?.env?.['PF_GIT_TOKEN']).toBe(TOKEN);
  });

  it('le jeton n’est donné qu’à github.com en HTTPS', async () => {
    for (const link of ['git@github.com:octocat/Hello-World.git', 'https://gitlab.com/a/b.git']) {
      const runner = fakeGit();
      await cloneRepository(remote(link), join(await temp(), 'x'), { runner, token: TOKEN });
      expect(JSON.stringify(runner.calls)).not.toContain(TOKEN);
    }
  });

  it('refuse un dossier non vide, sans lancer git', async () => {
    const target = await temp();
    await writeFile(join(target, 'a.txt'), '');
    const runner = fakeGit();
    const failure = await cloneRepository(remote('a/b'), target, { runner });
    expect(failure?.issues[0]?.code).toBe('GIT_TARGET_NOT_EMPTY');
    expect(runner.calls).toEqual([]);
  });

  it('refuse un fichier à la place du dossier', async () => {
    const parent = await temp();
    await writeFile(join(parent, 'f'), '');
    const failure = await cloneRepository(remote('a/b'), join(parent, 'f'), { runner: fakeGit() });
    expect(failure?.issues[0]?.code).toBe('GIT_TARGET_NOT_EMPTY');
  });

  // Gate 7B : un clone qui échoue ne laisse aucun dossier derrière lui.
  it('échec : le dossier créé est supprimé, parents créés compris', async () => {
    const parent = await temp();
    const runner = fakeGit(
      { clone: { exitCode: 128, output: 'fatal: something' } },
      async (target) => {
        await writeFile(join(target, 'partiel'), '');
      },
    );
    const failure = await cloneRepository(remote('a/b'), join(parent, 'n1', 'n2', 'clone'), {
      runner,
    });
    expect(failure?.issues[0]?.code).toBe('GIT_CLONE_FAILED');
    expect(await readdir(parent)).toEqual([]);
  });

  it('échec dans un dossier vide préexistant : il est gardé, et vidé', async () => {
    const target = await temp();
    const runner = fakeGit({ clone: { exitCode: 128, output: 'fatal' } }, async (dir) => {
      await mkdir(join(dir, '.git'));
      await writeFile(join(dir, 'partiel'), '');
    });
    await cloneRepository(remote('a/b'), target, { runner });
    expect(await readdir(target)).toEqual([]);
  });

  it('accès refusé : piste selon le cas, et jeton masqué dans la sortie', async () => {
    const output = `remote: Repository not found.\nfatal: Authentication failed (${TOKEN})`;
    const cases: [string, string | undefined, string][] = [
      ['a/b', undefined, 'pf login'],
      ['a/b', TOKEN, 'compte connecté'],
      ['git@github.com:a/b.git', undefined, 'clé SSH'],
    ];
    for (const [link, token, hint] of cases) {
      const failure = await cloneRepository(remote(link), join(await temp(), 'x'), {
        runner: fakeGit({ clone: { exitCode: 128, output } }),
        ...(token === undefined ? {} : { token }),
      });
      expect(failure?.issues[0]?.code).toBe('GIT_AUTH_FAILED');
      expect(failure?.issues[0]?.hint).toContain(hint);
      if (token !== undefined) {
        expect(failure?.issues[0]?.message).not.toContain(TOKEN);
      }
    }
  });

  it('panne réseau : relançable', async () => {
    const failure = await cloneRepository(remote('a/b'), join(await temp(), 'x'), {
      runner: fakeGit({ clone: { exitCode: 128, output: 'Could not resolve host: github.com' } }),
    });
    expect(failure?.retryable).toBe(true);
  });

  it('git absent : dit où l’installer, et ne laisse rien', async () => {
    const parent = await temp();
    const failure = await cloneRepository(remote('a/b'), join(parent, 'x'), {
      runner: fakeGit({ clone: 'absent' }),
    });
    expect(failure?.issues[0]?.code).toBe('GIT_UNAVAILABLE');
    expect(await readdir(parent)).toEqual([]);
  });
});

/** Un vrai dépôt, avec une identité locale : ces tests lancent le vrai git. */
async function realRepository(withCommit: boolean): Promise<string> {
  const dir = await temp();
  const run = (args: string[]) => nodeCommandRunner.run('git', args, dir);
  await run(['init', '--initial-branch=main']);
  await run(['config', 'user.name', 'Test']);
  await run(['config', 'user.email', 'test@example.com']);
  if (withCommit) {
    await writeFile(join(dir, 'README.md'), '# test\n');
    await run(['add', '--all']);
    await run(['commit', '--message', 'init']);
  }
  return dir;
}

describe('repositoryState — vrai git', () => {
  it('un dossier hors dépôt', async () => {
    const state = await repositoryState(await temp(), nodeCommandRunner);
    expect(state).toEqual({ isRepository: false, hasCommit: false });
  });

  it('un dépôt sans commit, puis avec, puis avec un origin GitHub', async () => {
    const dir = await realRepository(false);
    expect(await repositoryState(dir, nodeCommandRunner)).toEqual({
      isRepository: true,
      hasCommit: false,
    });
    const committed = await realRepository(true);
    await nodeCommandRunner.run(
      'git',
      ['remote', 'add', 'origin', 'https://github.com/octocat/demo.git'],
      committed,
    );
    expect(await repositoryState(committed, nodeCommandRunner)).toEqual({
      isRepository: true,
      hasCommit: true,
      origin: 'https://github.com/octocat/demo.git',
      github: { owner: 'octocat', repo: 'demo' },
    });
  });

  it('un origin hors GitHub n’a pas de dépôt GitHub', async () => {
    const dir = await realRepository(true);
    await nodeCommandRunner.run(
      'git',
      ['remote', 'add', 'origin', 'https://gitlab.com/a/b.git'],
      dir,
    );
    const state = await repositoryState(dir, nodeCommandRunner);
    expect(!isGitFailure(state) && state.github).toBeUndefined();
  });

  it('un sous-dossier d’un dépôt n’est pas sa racine', async () => {
    const dir = await realRepository(true);
    await mkdir(join(dir, 'sous'));
    expect(await repositoryState(join(dir, 'sous'), nodeCommandRunner)).toEqual({
      isRepository: false,
      hasCommit: false,
    });
  });

  it('git absent : un échec, pas « pas un dépôt »', async () => {
    const state = await repositoryState('/x', fakeGit({ 'rev-parse': 'absent' }));
    expect(isGitFailure(state)).toBe(true);
  });
});

describe('ensureInitialCommit', () => {
  it('vrai git : crée le dépôt et le premier commit', async () => {
    const dir = await realRepository(false);
    await writeFile(join(dir, 'a.txt'), 'a');
    expect(await ensureInitialCommit(dir, nodeCommandRunner)).toBeUndefined();
    const state = await repositoryState(dir, nodeCommandRunner);
    expect(!isGitFailure(state) && state.hasCommit).toBe(true);
  });

  it('un dépôt qui a déjà un commit est laissé tel quel', async () => {
    const dir = await realRepository(true);
    const runner = fakeGit();
    const spy: CommandRunner = {
      run: (command, args, cwd, options) => {
        runner.calls.push({ command, args, cwd, options });
        return nodeCommandRunner.run(command, args, cwd, options);
      },
    };
    expect(await ensureInitialCommit(dir, spy)).toBeUndefined();
    expect(runner.calls.map((call) => call.args[0])).not.toContain('commit');
  });

  it('refuse un sous-dossier d’un autre dépôt : pas de dépôt imbriqué', async () => {
    const dir = await realRepository(true);
    await mkdir(join(dir, 'sous'));
    const failure = await ensureInitialCommit(join(dir, 'sous'), nodeCommandRunner);
    expect(failure?.issues[0]?.code).toBe('GIT_NOT_A_REPOSITORY');
  });

  it('dossier neuf : init, add, commit', async () => {
    const runner = fakeGit({
      'rev-parse --show-toplevel': { exitCode: 128, output: 'fatal: not a git repository' },
      'rev-parse --is-inside-work-tree': { exitCode: 128, output: 'fatal' },
    });
    expect(await ensureInitialCommit('/p', runner)).toBeUndefined();
    expect(runner.calls.map((call) => call.args[0])).toEqual([
      'rev-parse',
      'rev-parse',
      'init',
      'add',
      'commit',
    ]);
  });

  it('identité Git absente : dit comment la configurer', async () => {
    const runner = fakeGit({
      'rev-parse --show-toplevel': { exitCode: 0, output: '/p' },
      'rev-parse --verify --quiet HEAD': { exitCode: 1, output: '' },
      'remote get-url origin': { exitCode: 2, output: '' },
      commit: { exitCode: 128, output: '*** Please tell me who you are.' },
    });
    const failure = await ensureInitialCommit('/p', runner);
    expect(failure?.issues[0]?.code).toBe('GIT_IDENTITY_MISSING');
    expect(failure?.issues[0]?.hint).toContain('git config --global user.email');
  });

  it.each(['init', 'add', 'commit'])('« git %s » qui échoue remonte tel quel', async (step) => {
    const runner = fakeGit({
      'rev-parse --show-toplevel': { exitCode: 128, output: 'fatal' },
      'rev-parse --is-inside-work-tree': { exitCode: 128, output: 'fatal' },
      [step]: { exitCode: 1, output: `erreur ${step}` },
    });
    const failure = await ensureInitialCommit('/p', runner);
    expect(failure?.issues[0]?.code).toBe('GIT_COMMAND_FAILED');
    expect(failure?.issues[0]?.message).toContain(`erreur ${step}`);
  });

  it('git absent', async () => {
    const failure = await ensureInitialCommit('/p', fakeGit({ 'rev-parse': 'absent' }));
    expect(failure?.issues[0]?.code).toBe('GIT_UNAVAILABLE');
  });
});

describe('pushToNewOrigin', () => {
  const ready = {
    'rev-parse --show-toplevel': { exitCode: 0, output: '/p\n' },
    'rev-parse --verify --quiet HEAD': { exitCode: 0, output: 'abc' },
    'remote get-url origin': { exitCode: 2, output: 'error: No such remote' },
  };

  it('déclare origin et pousse, jeton hors des arguments', async () => {
    const runner = fakeGit(ready);
    expect(
      await pushToNewOrigin('/p', remote('octocat/demo'), { runner, token: TOKEN }),
    ).toBeUndefined();
    const push = runner.calls.find((call) => call.args.includes('push'));
    expect(
      runner.calls.some(
        (call) => call.args.join(' ') === 'remote add origin https://github.com/octocat/demo.git',
      ),
    ).toBe(true);
    expect(push?.args.slice(-4)).toEqual(['push', '--set-upstream', 'origin', 'HEAD']);
    expect(JSON.stringify(runner.calls.map((call) => call.args))).not.toContain(TOKEN);
    expect(push?.options?.env?.['PF_GIT_TOKEN']).toBe(TOKEN);
  });

  it('en SSH, aucun jeton', async () => {
    const runner = fakeGit(ready);
    await pushToNewOrigin('/p', remote('git@github.com:octocat/demo.git'), {
      runner,
      token: TOKEN,
    });
    expect(JSON.stringify(runner.calls)).not.toContain(TOKEN);
  });

  it('refuse un projet qui a déjà un origin', async () => {
    const runner = fakeGit({
      ...ready,
      'remote get-url origin': { exitCode: 0, output: 'git@github.com:a/b.git' },
    });
    const failure = await pushToNewOrigin('/p', remote('a/c'), { runner });
    expect(failure?.issues[0]?.code).toBe('GIT_REMOTE_EXISTS');
    expect(runner.calls.some((call) => call.args.includes('push'))).toBe(false);
  });

  it('push refusé : dit que origin est posé et quoi relancer, jeton masqué', async () => {
    const runner = fakeGit({ ...ready, push: { exitCode: 1, output: `rejected ${TOKEN}` } });
    const failure = await pushToNewOrigin('/p', remote('a/b'), { runner, token: TOKEN });
    expect(failure?.issues[0]?.code).toBe('GIT_PUSH_FAILED');
    expect(failure?.issues[0]?.hint).toContain('git push --set-upstream origin HEAD');
    expect(failure?.issues[0]?.message).not.toContain(TOKEN);
  });

  it('remote add qui échoue, git absent, état illisible', async () => {
    expect(
      (
        await pushToNewOrigin('/p', remote('a/b'), {
          runner: fakeGit({
            ...ready,
            'remote add origin https://github.com/a/b.git': { exitCode: 3, output: 'x' },
          }),
        })
      )?.issues[0]?.code,
    ).toBe('GIT_COMMAND_FAILED');
    expect(
      (
        await pushToNewOrigin('/p', remote('a/b'), {
          runner: fakeGit({ ...ready, push: 'absent' }),
        })
      )?.issues[0]?.code,
    ).toBe('GIT_UNAVAILABLE');
    expect(
      (await pushToNewOrigin('/p', remote('a/b'), { runner: fakeGit({ 'rev-parse': 'absent' }) }))
        ?.issues[0]?.code,
    ).toBe('GIT_UNAVAILABLE');
  });
});

import { describe, expect, it } from 'vitest';
import {
  type CommandResult,
  type CommandRunner,
  isTransientFailure,
  nodeCommandRunner,
  runGit,
  runInstall,
  runValidation,
} from './postinstall.js';

/**
 * Post Install et Validation (§22, 5.10) — jamais de vrai shell ici, sauf pour
 * l'exécuteur réel lui-même, testé avec `node`, présent partout.
 */

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
}

/** Exécuteur factice : répond selon la commande, note chaque appel. */
function fakeRunner(
  answers: Record<string, CommandResult | 'unavailable'> = {},
): CommandRunner & { calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    async run(command, args, cwd) {
      calls.push({ command, args, cwd });
      const answer = answers[`${command} ${args.join(' ')}`] ?? answers[command];
      if (answer === 'unavailable') {
        throw Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' });
      }
      return answer ?? { exitCode: 0, output: '' };
    },
  };
}

const FAIL = (output: string): CommandResult => ({ exitCode: 1, output });

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

describe('isTransientFailure — réseau ou panne durable', () => {
  it.each([
    'ERR_PNPM_META_FETCH_FAIL  GET https://registry.npmjs.org/next: request to failed, reason: getaddrinfo ENOTFOUND',
    'npm error code ECONNRESET',
    'request to https://registry.npmjs.org failed, reason: connect ETIMEDOUT',
    'getaddrinfo EAI_AGAIN registry.npmjs.org',
    'ERR_PNPM_FETCH_503  GET https://registry.npmjs.org/react: Service Unavailable - 503',
    'socket hang up',
  ])('transitoire : %s', (output) => {
    expect(isTransientFailure(output)).toBe(true);
  });

  it.each([
    'ERR_PNPM_NO_MATCHING_VERSION  No matching version found for next@99',
    'ERR_PNPM_IGNORED_BUILDS  Ignored build scripts: prisma',
    'error TS2322: Type string is not assignable to type number',
    '',
  ])('durable : %s', (output) => {
    expect(isTransientFailure(output)).toBe(false);
  });
});

describe('runInstall', () => {
  it('lance pnpm install dans la cible', async () => {
    const runner = fakeRunner();
    expect(await runInstall(runner, '/cible')).toBeUndefined();
    expect(runner.calls).toEqual([{ command: 'pnpm', args: ['install'], cwd: '/cible' }]);
  });

  it('un échec réseau est reprenable', async () => {
    const failure = await runInstall(fakeRunner({ pnpm: FAIL('connect ETIMEDOUT') }), '/cible');
    expect(failure?.issue.code).toBe('GEN_INSTALL_FAILED');
    expect(failure?.retryable).toBe(true);
  });

  it('un échec durable ne l’est pas, et le message cite la cause', async () => {
    const failure = await runInstall(
      fakeRunner({ pnpm: FAIL('ERR_PNPM_NO_MATCHING_VERSION next@99') }),
      '/cible',
    );
    expect(failure?.retryable).toBe(false);
    expect(failure?.issue.message).toContain('ERR_PNPM_NO_MATCHING_VERSION');
  });

  it('pnpm absent : le dit et dit quoi faire', async () => {
    const failure = await runInstall(fakeRunner({ pnpm: 'unavailable' }), '/cible');
    expect(failure?.issue.code).toBe('GEN_COMMAND_UNAVAILABLE');
    expect(failure?.issue.message).toContain('pnpm');
    expect(failure?.retryable).toBe(false);
  });

  it('ne recopie que la fin d’une sortie trop longue', async () => {
    const noise = Array.from({ length: 200 }, (_, index) => `ligne ${index}`).join('\n');
    const failure = await runInstall(fakeRunner({ pnpm: FAIL(noise) }), '/cible');
    expect(failure?.issue.message).toContain('ligne 199');
    expect(failure?.issue.message).not.toContain('ligne 10\n');
  });
});

describe('runGit', () => {
  const NOT_A_REPO = FAIL('fatal: not a git repository');

  it('initialise, indexe et committe un dossier hors dépôt', async () => {
    const runner = fakeRunner({ 'git rev-parse --show-prefix': NOT_A_REPO });
    const outcome = await runGit(runner, '/cible');
    expect(outcome.failure).toBeUndefined();
    expect(runner.calls.map((call) => `${call.command} ${call.args.join(' ')}`)).toEqual([
      'git rev-parse --show-prefix',
      'git init --initial-branch=main',
      'git add --all',
      'git commit --message chore: initial commit',
    ]);
  });

  it('ne réinitialise pas un dépôt déjà présent à la racine de la cible', async () => {
    const runner = fakeRunner({ 'git rev-parse --show-prefix': { exitCode: 0, output: '\n' } });
    await runGit(runner, '/cible');
    const commands = runner.calls.map((call) => call.args[0]);
    expect(commands).not.toContain('init');
    expect(commands).toContain('commit');
  });

  it('ne crée pas de dépôt imbriqué dans un autre : avertit et s’abstient', async () => {
    const runner = fakeRunner({
      'git rev-parse --show-prefix': { exitCode: 0, output: 'apps/web/\n' },
    });
    const outcome = await runGit(runner, '/depot/apps/web');
    expect(outcome.failure).toBeUndefined();
    expect(outcome.warning?.code).toBe('GEN_GIT_NESTED');
    expect(runner.calls).toHaveLength(1);
  });

  it('un commit refusé (identité absente) échoue avec la raison de git', async () => {
    const runner = fakeRunner({
      'git rev-parse --show-prefix': NOT_A_REPO,
      'git commit --message chore: initial commit': FAIL('Please tell me who you are.'),
    });
    const outcome = await runGit(runner, '/cible');
    expect(outcome.failure?.issue.code).toBe('GEN_GIT_FAILED');
    expect(outcome.failure?.issue.message).toContain('Please tell me who you are.');
    expect(outcome.failure?.retryable).toBe(false);
  });

  it('git qui disparaît entre deux commandes : le dit aussi', async () => {
    const outcome = await runGit(
      fakeRunner({ 'git rev-parse --show-prefix': NOT_A_REPO, 'git add --all': 'unavailable' }),
      '/cible',
    );
    expect(outcome.failure?.issue.code).toBe('GEN_COMMAND_UNAVAILABLE');
  });

  it('git absent : le dit', async () => {
    const outcome = await runGit(fakeRunner({ git: 'unavailable' }), '/cible');
    expect(outcome.failure?.issue.code).toBe('GEN_COMMAND_UNAVAILABLE');
  });
});

describe('runValidation', () => {
  it('lance les scripts de CI présents, dans l’ordre de la CI', async () => {
    const runner = fakeRunner();
    await runValidation(runner, '/cible', { test: 'x', lint: 'y', dev: 'z', typecheck: 'w' });
    expect(runner.calls.map((call) => call.args.join(' '))).toEqual([
      'run lint',
      'run typecheck',
      'run test',
    ]);
  });

  it('s’arrête au premier script qui échoue et le nomme', async () => {
    const runner = fakeRunner({ 'pnpm run typecheck': FAIL('error TS2322') });
    const failure = await runValidation(runner, '/cible', { lint: 'y', typecheck: 'w', test: 'x' });
    expect(failure?.issue.code).toBe('GEN_VALIDATION_FAILED');
    expect(failure?.issue.message).toContain('typecheck');
    expect(failure?.retryable).toBe(false);
    expect(runner.calls).toHaveLength(2);
  });

  it('pnpm absent à la validation : le dit', async () => {
    const failure = await runValidation(fakeRunner({ pnpm: 'unavailable' }), '/cible', {
      lint: 'y',
    });
    expect(failure?.issue.code).toBe('GEN_COMMAND_UNAVAILABLE');
  });

  it('rien à valider : rien à lancer', async () => {
    const runner = fakeRunner();
    expect(await runValidation(runner, '/cible', {})).toBeUndefined();
    expect(runner.calls).toHaveLength(0);
  });
});

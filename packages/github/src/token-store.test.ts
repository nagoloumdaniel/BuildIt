import type { CommandRunner, RunOptions } from '@project-factory/exec';
import { describe, expect, it } from 'vitest';
import { environmentStore, isTokenShaped, keychainStore } from './token-store.js';

const TOKEN = ['ghp', 'JetonDeTestFactice0000000000000000000'].join('_');

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly options: RunOptions | undefined;
}

/** Un faux trousseau en mémoire, qui ne connaît que ce qu'on lui écrit sur l'entrée. */
function fakeKeychain(
  behaviour: 'ok' | 'absent' | 'refuse' = 'ok',
): CommandRunner & { calls: Call[]; stored?: string } {
  const state: { calls: Call[]; stored?: string } = { calls: [] };
  return Object.assign(state, {
    async run(command: string, args: readonly string[], _cwd: string, options?: RunOptions) {
      state.calls.push({ command, args, options });
      if (behaviour === 'absent') {
        throw new Error('ENOENT');
      }
      if (behaviour === 'refuse') {
        return { exitCode: 1, output: `refus ${options?.input ?? ''}` };
      }
      const input = options?.input ?? '';
      if (args.includes('store') || args.includes('-i') || input.includes('.Add(')) {
        state.stored = /ghp_[A-Za-z0-9_]+/.exec(input)?.[0] ?? input;
        return { exitCode: 0, output: '' };
      }
      if (
        args.includes('clear') ||
        args.includes('delete-generic-password') ||
        input.includes('.Remove(')
      ) {
        delete state.stored;
        return { exitCode: 0, output: '' };
      }
      return state.stored === undefined
        ? { exitCode: 44, output: '' }
        : { exitCode: 0, output: `${state.stored}\n` };
    },
  });
}

describe.each(['linux', 'darwin', 'win32'] as const)('keychainStore — %s', (platform) => {
  it('écrit, relit, efface ; le jeton ne passe jamais en argument', async () => {
    const runner = fakeKeychain();
    const store = keychainStore(runner, platform);
    expect(await store.get()).toBeUndefined();
    expect(await store.set(TOKEN)).toBeUndefined();
    expect(await store.get()).toBe(TOKEN);
    expect(await store.delete()).toBeUndefined();
    expect(await store.get()).toBeUndefined();
    for (const call of runner.calls) {
      expect(call.args.join(' ')).not.toContain(TOKEN);
    }
    expect(runner.calls.some((call) => call.options?.input?.includes(TOKEN))).toBe(true);
  });

  it('trousseau absent : refus nommé, aucun repli en clair', async () => {
    const store = keychainStore(fakeKeychain('absent'), platform);
    const refusal = await store.set(TOKEN);
    expect(refusal?.code).toBe('GITHUB_KEYCHAIN_UNAVAILABLE');
    expect(await store.get()).toBeUndefined();
    expect((await store.delete())?.code).toBe('GITHUB_KEYCHAIN_UNAVAILABLE');
  });

  it('trousseau qui refuse : le code, jamais sa sortie (qui citerait le jeton)', async () => {
    const refusal = await keychainStore(fakeKeychain('refuse'), platform).set(TOKEN);
    expect(refusal?.code).toBe('GITHUB_KEYCHAIN_FAILED');
    expect(refusal?.message).not.toContain(TOKEN);
  });

  it('refuse ce qui n’a pas la forme d’un jeton, sans rien lancer', async () => {
    const runner = fakeKeychain();
    for (const bad of [
      "x'); Remove-Item C:\\ #",
      'court',
      `${TOKEN}\nadd-generic-password -s autre`,
    ]) {
      expect((await keychainStore(runner, platform).set(bad))?.code).toBe('GITHUB_TOKEN_INVALID');
    }
    expect(runner.calls).toEqual([]);
  });
});

describe('keychainStore — arguments', () => {
  it.each(['linux', 'darwin', 'win32'] as const)(
    '%s : arguments en ASCII — une locale C ne lit pas le reste',
    async (platform) => {
      const runner = fakeKeychain();
      const store = keychainStore(runner, platform);
      await store.set(TOKEN);
      await store.get();
      await store.delete();
      for (const call of runner.calls) {
        // biome-ignore lint/suspicious/noControlCharactersInRegex: plage ASCII imprimable
        expect(call.args.join(' ')).toMatch(/^[\x20-\x7e]*$/);
      }
    },
  );
});

describe('keychainStore — plateforme sans trousseau connu', () => {
  it('refuse d’enregistrer et renvoie vers PF_GITHUB_TOKEN', async () => {
    const store = keychainStore(fakeKeychain(), 'aix');
    expect((await store.set(TOKEN))?.hint).toContain('PF_GITHUB_TOKEN');
    expect(await store.get()).toBeUndefined();
    expect(await store.delete()).toBeUndefined();
  });
});

describe('keychainStore — valeur relue invalide', () => {
  it('une valeur qui n’a pas la forme d’un jeton est ignorée', async () => {
    const runner: CommandRunner = { run: async () => ({ exitCode: 0, output: 'pas un jeton !' }) };
    expect(await keychainStore(runner, 'linux').get()).toBeUndefined();
  });
});

describe('environmentStore', () => {
  it('lu, jamais écrit ni effacé', async () => {
    const store = environmentStore(TOKEN);
    expect(await store.get()).toBe(TOKEN);
    expect((await store.set(TOKEN))?.code).toBe('GITHUB_TOKEN_FROM_ENV');
    expect((await store.delete())?.code).toBe('GITHUB_TOKEN_FROM_ENV');
  });
});

describe('isTokenShaped', () => {
  it.each([
    [TOKEN, true],
    [['github', 'pat', '11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz'].join('_'), true],
    ['court', false],
    ['avec espace 0000000000000000000000', false],
  ])('%s ⇒ %s', (token, expected) => {
    expect(isTokenShaped(token)).toBe(expected);
  });
});

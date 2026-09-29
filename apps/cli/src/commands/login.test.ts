import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeFetch, fakeWorld } from '../fake-world.js';

const TOKEN = ['gho', 'JetonDeTestFactice0000000000000000000'].join('_');
const USER = {
  'GET /user': { status: 200, body: { login: 'octocat' }, headers: { 'x-oauth-scopes': 'repo' } },
};

function everywhere(io: ReturnType<typeof fakeIo>, world: ReturnType<typeof fakeWorld>): string {
  return [io.text().out, io.text().err, ...world.calls.map((call) => call.args.join(' '))].join(
    '\n',
  );
}

describe('pf login --with-token', () => {
  it('lit l’entrée standard, vérifie auprès de GitHub, range dans le trousseau', async () => {
    const world = fakeWorld();
    const io = fakeIo({ runner: world, fetch: fakeFetch(USER), stdin: `${TOKEN}\n` });
    expect(await run(['login', '--with-token'], io)).toBe(0);
    expect(world.keychain.value).toBe(TOKEN);
    expect(io.text().out).toContain('✓ Connecté à GitHub : octocat.');
    expect(io.text().out).toContain('Permissions : repo.');
    expect(io.text().out).toContain('Jeton : Secret Service (libsecret).');
    // Gate 7B : le jeton n'apparaît ni à l'écran, ni dans un argument de commande.
    expect(everywhere(io, world)).not.toContain(TOKEN);
  });

  it('dans un terminal, saisie masquée', async () => {
    const world = fakeWorld();
    const io = fakeIo({
      runner: world,
      fetch: fakeFetch(USER),
      interactive: true,
      answers: [TOKEN],
    });
    expect(await run(['login', '--with-token'], io)).toBe(0);
    expect(io.asked).toEqual(['Jeton GitHub :']);
  });

  it('refuse un jeton en argument, sans le répéter', async () => {
    const world = fakeWorld();
    const io = fakeIo({ runner: world });
    expect(await run(['login', TOKEN], io)).toBe(2);
    expect(everywhere(io, world)).not.toContain(TOKEN);
    expect(world.keychain.value).toBeUndefined();
  });

  it('refuse ce qui n’est pas un jeton', async () => {
    const io = fakeIo({ runner: fakeWorld(), stdin: 'pas un jeton' });
    expect(await run(['login', '--with-token'], io)).toBe(2);
  });

  it('jeton refusé par GitHub : rien n’est rangé', async () => {
    const world = fakeWorld();
    const io = fakeIo({
      runner: world,
      fetch: fakeFetch({ 'GET /user': { status: 401 } }),
      stdin: TOKEN,
    });
    expect(await run(['login', '--with-token'], io)).toBe(1);
    expect(world.keychain.value).toBeUndefined();
  });

  it('trousseau indisponible : refus, aucun repli en clair', async () => {
    const world = fakeWorld();
    const broken = {
      ...world,
      run: async (
        command: string,
        ...rest: Parameters<typeof world.run> extends [string, ...infer R] ? R : never
      ) => {
        if (command === 'secret-tool') {
          throw new Error('ENOENT');
        }
        return world.run(command, ...rest);
      },
    };
    const io = fakeIo({ runner: broken, fetch: fakeFetch(USER), stdin: TOKEN });
    expect(await run(['login', '--with-token'], io)).toBe(1);
    expect(io.text().err).toContain('jamais stocké en clair');
  });

  it('déjà connecté : le dit, sans rien changer', async () => {
    const world = fakeWorld({}, { value: TOKEN });
    const io = fakeIo({ runner: world, fetch: fakeFetch(USER) });
    expect(await run(['login'], io)).toBe(0);
    expect(io.text().out).toContain('Déjà connecté à GitHub : octocat');
  });

  it('un jeton rangé mais révoqué ne bloque pas une nouvelle connexion', async () => {
    const world = fakeWorld({}, { value: TOKEN });
    const fetch = fakeFetch({
      'GET /user': [{ status: 401 }, { status: 200, body: { login: 'octocat' } }],
    });
    const io = fakeIo({ runner: world, fetch, stdin: TOKEN });
    expect(await run(['login', '--with-token'], io)).toBe(0);
    expect(io.text().out).toContain('celles du jeton à grain fin');
  });
});

describe('pf login — connexion par code', () => {
  it('sans application OAuth configurée : le dit, et propose --with-token', async () => {
    const io = fakeIo({ runner: fakeWorld() });
    expect(await run(['login'], io)).toBe(1);
    expect(io.text().err).toContain('pf login --with-token');
  });

  it('annonce les permissions, affiche le code, range le jeton obtenu', async () => {
    const world = fakeWorld();
    const fetch = fakeFetch({
      'POST /login/device/code': {
        status: 200,
        body: {
          device_code: 'dc',
          user_code: 'WDJB-MJHT',
          verification_uri: 'https://github.com/login/device',
          interval: 5,
          expires_in: 900,
        },
      },
      'POST /login/oauth/access_token': [
        { status: 200, body: { error: 'authorization_pending' } },
        { status: 200, body: { access_token: TOKEN, scope: 'public_repo' } },
      ],
      ...USER,
    });
    const io = fakeIo({ runner: world, fetch, env: { PF_GITHUB_CLIENT_ID: 'Iv1.test' } });
    expect(await run(['login', '--public-only'], io)).toBe(0);
    const out = io.text().out;
    expect(out.indexOf('public_repo')).toBeLessThan(out.indexOf('WDJB-MJHT'));
    expect(out).toContain(
      'Ouvrez https://github.com/login/device et saisissez le code : WDJB-MJHT',
    );
    expect(world.keychain.value).toBe(TOKEN);
    expect(everywhere(io, world)).not.toContain(TOKEN);
  });

  it('code refusé ou expiré : code 1, rien de rangé', async () => {
    const world = fakeWorld();
    const fetch = fakeFetch({
      'POST /login/device/code': {
        status: 200,
        body: { device_code: 'dc', user_code: 'X', interval: 1, expires_in: 5 },
      },
      'POST /login/oauth/access_token': { status: 200, body: { error: 'access_denied' } },
    });
    const io = fakeIo({ runner: world, fetch, env: { PF_GITHUB_CLIENT_ID: 'Iv1.test' } });
    expect(await run(['login'], io)).toBe(1);
    expect(world.keychain.value).toBeUndefined();
    const disabled = fakeIo({
      runner: fakeWorld(),
      fetch: fakeFetch({
        'POST /login/device/code': { status: 400, body: { error: 'device_flow_disabled' } },
      }),
      env: { PF_GITHUB_CLIENT_ID: 'Iv1.test' },
    });
    expect(await run(['login'], disabled)).toBe(1);
  });

  it('--help', async () => {
    expect(await run(['login', '--help'], fakeIo())).toBe(0);
  });
});

describe('pf logout', () => {
  it('retire le jeton du trousseau et dit comment le révoquer côté GitHub', async () => {
    const world = fakeWorld({}, { value: TOKEN });
    const io = fakeIo({ runner: world });
    expect(await run(['logout'], io)).toBe(0);
    expect(world.keychain.value).toBeUndefined();
    expect(io.text().out).toContain('github.com/settings/applications');
  });

  it('un jeton venu de PF_GITHUB_TOKEN n’est pas touché', async () => {
    const io = fakeIo({ runner: fakeWorld(), env: { PF_GITHUB_TOKEN: TOKEN } });
    expect(await run(['logout'], io)).toBe(1);
    expect(io.text().err).toContain('PF_GITHUB_TOKEN');
  });

  it('--help, argument en trop', async () => {
    expect(await run(['logout', '--help'], fakeIo())).toBe(0);
    expect(await run(['logout', 'x'], fakeIo())).toBe(2);
  });
});

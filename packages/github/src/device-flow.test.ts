import { describe, expect, it } from 'vitest';
import { type DeviceCode, pollAccessToken, requestDeviceCode, SCOPES } from './device-flow.js';
import { fakeFetch } from './test-fetch.js';

const CODE: DeviceCode = {
  deviceCode: 'dc',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 30,
  interval: 5,
};

const TOKEN_ROUTE = 'POST /login/oauth/access_token';
const noSleep = { sleep: async () => undefined };

describe('requestDeviceCode', () => {
  it('demande les permissions annoncées et rend le code à saisir', async () => {
    const fetch = fakeFetch({
      'POST /login/device/code': {
        status: 200,
        body: {
          device_code: 'dc',
          user_code: 'ABCD-1234',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        },
      },
    });
    const result = await requestDeviceCode(fetch, 'client-id', SCOPES.full);
    expect(result).toEqual({
      ok: true,
      value: {
        deviceCode: 'dc',
        userCode: 'ABCD-1234',
        verificationUri: 'https://github.com/login/device',
        expiresIn: 900,
        interval: 5,
      },
    });
    expect(fetch.requests[0]?.body).toBe('client_id=client-id&scope=repo');
  });

  it('valeurs par défaut quand GitHub en omet', async () => {
    const fetch = fakeFetch({
      'POST /login/device/code': { status: 200, body: { device_code: 'd', user_code: 'u' } },
    });
    const result = await requestDeviceCode(fetch, 'c', SCOPES.publicOnly);
    expect(result.ok && result.value).toMatchObject({
      expiresIn: 900,
      interval: 5,
      verificationUri: 'https://github.com/login/device',
    });
  });

  it('application sans device flow : dit quoi faire à la place', async () => {
    const fetch = fakeFetch({
      'POST /login/device/code': { status: 400, body: { error: 'device_flow_disabled' } },
    });
    const result = await requestDeviceCode(fetch, 'c', SCOPES.full);
    expect(!result.ok && result.issues[0]?.hint).toContain('pf login --with-token');
  });

  it('réseau coupé, réponse illisible', async () => {
    expect(
      (await requestDeviceCode(fakeFetch({ 'POST /login/device/code': 'network' }), 'c', [])).ok,
    ).toBe(false);
    const html = fakeFetch({ 'POST /login/device/code': { status: 502, body: '<html>' } });
    const result = await requestDeviceCode(html, 'c', []);
    expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_UNEXPECTED');
  });
});

describe('pollAccessToken', () => {
  it('attend tant que le code n’est pas saisi, ralentit sur demande', async () => {
    const slept: number[] = [];
    const fetch = fakeFetch({
      [TOKEN_ROUTE]: [
        { status: 200, body: { error: 'authorization_pending' } },
        { status: 200, body: { error: 'slow_down', interval: 10 } },
        { status: 200, body: { error: 'slow_down' } },
        { status: 200, body: { access_token: 'gho_x', scope: 'repo,read:org' } },
      ],
    });
    const result = await pollAccessToken(
      fetch,
      'c',
      { ...CODE, expiresIn: 900 },
      { sleep: async (s) => void slept.push(s) },
    );
    expect(result).toEqual({ ok: true, value: { token: 'gho_x', scopes: ['repo', 'read:org'] } });
    expect(slept).toEqual([5, 5, 10, 15]);
    expect(fetch.requests[0]?.body).toContain(
      'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code',
    );
  });

  it('un jeton sans permissions listées', async () => {
    const fetch = fakeFetch({ [TOKEN_ROUTE]: { status: 200, body: { access_token: 'gho_x' } } });
    const result = await pollAccessToken(fetch, 'c', CODE, noSleep);
    expect(result.ok && result.value.scopes).toEqual([]);
  });

  it.each([
    ['expired_token', 'GITHUB_DEVICE_EXPIRED'],
    ['access_denied', 'GITHUB_DEVICE_DENIED'],
    ['device_flow_disabled', 'GITHUB_DEVICE_DISABLED'],
    ['incorrect_client_credentials', 'GITHUB_DEVICE_DISABLED'],
    ['unsupported_grant_type', 'GITHUB_UNEXPECTED'],
    [undefined, 'GITHUB_UNEXPECTED'],
  ])('%s ⇒ %s', async (error, code) => {
    const fetch = fakeFetch({
      [TOKEN_ROUTE]: { status: 200, body: error === undefined ? {} : { error } },
    });
    const result = await pollAccessToken(fetch, 'c', CODE, noSleep);
    expect(!result.ok && result.issues[0]?.code).toBe(code);
  });

  it('s’arrête à l’expiration du code, sans boucler', async () => {
    const fetch = fakeFetch({
      [TOKEN_ROUTE]: Array.from({ length: 20 }, () => ({
        status: 200,
        body: { error: 'authorization_pending' },
      })),
    });
    const result = await pollAccessToken(fetch, 'c', CODE, noSleep);
    expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_DEVICE_EXPIRED');
    expect(fetch.requests.length).toBeLessThanOrEqual(7);
  });

  it('réseau coupé pendant l’attente', async () => {
    const result = await pollAccessToken(
      fakeFetch({ [TOKEN_ROUTE]: 'network' }),
      'c',
      CODE,
      noSleep,
    );
    expect(!result.ok && result.issues[0]?.code).toBe('GITHUB_NETWORK');
  });

  it('attend vraiment par défaut', async () => {
    const fetch = fakeFetch({ [TOKEN_ROUTE]: { status: 200, body: { access_token: 'gho_x' } } });
    const started = Date.now();
    await pollAccessToken(fetch, 'c', { ...CODE, interval: 0.01 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(5);
  });
});

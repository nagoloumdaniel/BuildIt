import { describe, expect, it } from 'vitest';
import { exchangeAuthorizationCode } from './oauth-code.js';
import { fakeFetch } from './test-fetch.js';

const REDIRECT = 'https://trybuildit.vercel.app/github/callback';

describe('exchangeAuthorizationCode — le flux de redirection (web application flow)', () => {
  it('échange un code contre un jeton et ses permissions', async () => {
    const fetch = fakeFetch({
      'POST /login/oauth/access_token': {
        status: 200,
        body: { access_token: 'ghu_abcdef', scope: 'repo' },
      },
    });

    const result = await exchangeAuthorizationCode(
      fetch,
      'client-id',
      'client-secret',
      'code-recu',
      REDIRECT,
    );

    expect(result).toEqual({ ok: true, value: { token: 'ghu_abcdef', scopes: ['repo'] } });
  });

  it('envoie le client_secret, le code et le redirect_uri exacts — GitHub les exige tous les trois', async () => {
    const fetch = fakeFetch({
      'POST /login/oauth/access_token': { status: 200, body: { access_token: 'ghu_x' } },
    });

    await exchangeAuthorizationCode(fetch, 'client-id', 'le-secret', 'le-code', REDIRECT);

    const body = new URLSearchParams(fetch.requests[0]?.body);
    expect(body.get('client_id')).toBe('client-id');
    expect(body.get('client_secret')).toBe('le-secret');
    expect(body.get('code')).toBe('le-code');
    expect(body.get('redirect_uri')).toBe(REDIRECT);
  });

  it('un code invalide ou déjà utilisé est refusé, nommément', async () => {
    const fetch = fakeFetch({
      'POST /login/oauth/access_token': {
        status: 200,
        body: { error: 'bad_verification_code' },
      },
    });

    const result = await exchangeAuthorizationCode(fetch, 'a', 'b', 'code-perime', REDIRECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('GITHUB_OAUTH_CODE_INVALID');
  });

  it('un secret incorrect reçoit le même refus nommé — rien ne distingue les deux à l’utilisateur', async () => {
    const fetch = fakeFetch({
      'POST /login/oauth/access_token': {
        status: 200,
        body: { error: 'incorrect_client_credentials' },
      },
    });

    const result = await exchangeAuthorizationCode(fetch, 'a', 'mauvais-secret', 'code', REDIRECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('GITHUB_OAUTH_CODE_INVALID');
  });

  it('une panne réseau devient un problème nommé, jamais une exception', async () => {
    const fetch = fakeFetch({ 'POST /login/oauth/access_token': 'network' });
    const result = await exchangeAuthorizationCode(fetch, 'a', 'b', 'code', REDIRECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('GITHUB_NETWORK');
  });

  it('une réponse sans jeton ni erreur connue est un problème nommé, pas un jeton inventé', async () => {
    const fetch = fakeFetch({
      'POST /login/oauth/access_token': { status: 200, body: { error: 'quelque_chose' } },
    });
    const result = await exchangeAuthorizationCode(fetch, 'a', 'b', 'code', REDIRECT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe('GITHUB_UNEXPECTED');
  });
});

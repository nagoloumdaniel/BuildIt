import { exchangeAuthorizationCode } from '@buildit/github';
import { NextResponse } from 'next/server';
import { defaultCookieJar, unsealJson } from '../../../lib/session-cookie';
import { STATE_COOKIE_NAME } from '../authorize/route';
import { clientSecret, sessionDeps } from '../server-deps';

interface SealedState {
  readonly state: string;
}

/**
 * Retour de github.com (§20bis, mode hébergé) : échange le `code` contre un
 * jeton, le range dans le même trousseau que le device flow, puis redirige
 * vers l'écran de connexion — jamais vers une page qui afficherait le jeton.
 *
 * Tout refus (état absent ou différent, code manquant ou invalide, accès
 * refusé sur github.com) redirige vers `/github?error=...` plutôt que
 * d'afficher une erreur brute : l'écran, lui, sait traduire ce code.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const secret = process.env['SESSION_SECRET'] ?? '';
  const jar = defaultCookieJar();
  const sealedState = jar.get(STATE_COOKIE_NAME);
  jar.delete(STATE_COOKIE_NAME);

  function failure(error: string): NextResponse {
    const target = new URL('/github', request.url);
    target.searchParams.set('error', error);
    return NextResponse.redirect(target);
  }

  if (url.searchParams.get('error') !== null) {
    return failure('denied');
  }

  const code = url.searchParams.get('code');
  const receivedState = url.searchParams.get('state');
  if (code === null || receivedState === null) {
    return failure('state');
  }

  const storedState =
    secret === '' || sealedState === undefined
      ? undefined
      : unsealJson<SealedState>(sealedState.value, secret);
  if (storedState === undefined || storedState.state !== receivedState) {
    return failure('state');
  }

  const deps = sessionDeps();
  const redirectUri = new URL('/github/callback', request.url).toString();
  const result = await exchangeAuthorizationCode(
    deps.fetch,
    deps.clientId,
    clientSecret(),
    code,
    redirectUri,
  );
  if (!result.ok) {
    return failure('exchange');
  }

  const refusal = await deps.store.set(result.value.token);
  if (refusal !== undefined) {
    return failure('store');
  }

  return NextResponse.redirect(new URL('/github?connected=1', request.url));
}

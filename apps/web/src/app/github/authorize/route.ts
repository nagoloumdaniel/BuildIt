import { randomUUID } from 'node:crypto';
import { SCOPES } from '@buildit/github';
import { NextResponse } from 'next/server';
import { defaultCookieJar, sealJson } from '../../../lib/session-cookie';
import { STATE_COOKIE_NAME } from '../oauth-state';
import { clientSecret, sessionDeps } from '../server-deps';

/**
 * Démarre le flux de redirection OAuth (§20bis, mode hébergé) : un clic sur
 * « Se connecter à GitHub » arrive ici, repart aussitôt vers github.com.
 *
 * `state` protège contre un vol de code (CSRF) : un identifiant à usage
 * unique, scellé dans un cookie éphémère, revérifié au retour
 * (`github/callback`). Sans lui, un lien d'autorisation forgé par un tiers
 * pourrait faire accepter une connexion que le visiteur n'a pas demandée. Son
 * nom de cookie vit dans `../oauth-state.ts` : un fichier de route ne peut
 * pas exporter autre chose que ses verbes HTTP.
 */
export function GET(request: Request): NextResponse {
  const deps = sessionDeps();
  const secret = process.env['SESSION_SECRET'] ?? '';

  if (deps.clientId === '' || clientSecret() === '' || secret === '') {
    const url = new URL('/github', request.url);
    url.searchParams.set('error', 'not_configured');
    return NextResponse.redirect(url);
  }

  const state = randomUUID();
  const redirectUri = new URL('/github/callback', request.url).toString();
  const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
  authorizeUrl.searchParams.set('client_id', deps.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', SCOPES.full.join(' '));
  authorizeUrl.searchParams.set('state', state);

  defaultCookieJar().set(STATE_COOKIE_NAME, sealJson({ state }, secret), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl);
}

import { fail, ok } from '@buildit/validation';
import type { Fetch, Result } from './client.js';
import type { AccessToken } from './device-flow.js';
import { githubIssue } from './errors.js';

/**
 * Connexion par redirection (OAuth « web application flow ») : l'utilisateur
 * clique, choisit son compte sur github.com, accepte les permissions, puis
 * revient sur le site — jamais de code à recopier à la main.
 *
 * Contrairement au device flow (`device-flow.ts`), cet échange exige le
 * **Client Secret** de l'application OAuth : GitHub ne permet pas d'échanger
 * un `code` d'autorisation sans lui. C'est le compromis assumé de ce flux —
 * un secret de plus à protéger, en retour d'une connexion en un clic.
 */

const TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Échange le `code` reçu sur l'URL de retour contre un jeton d'accès.
 *
 * `redirectUri` doit être **exactement** celle enregistrée sur l'application
 * OAuth : GitHub refuse l'échange sinon (protection contre un vol de code).
 */
export async function exchangeAuthorizationCode(
  fetcher: Fetch,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<Result<AccessToken>> {
  let response: Response;
  try {
    response = await fetcher(TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'buildit',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });
  } catch (error) {
    return fail([
      githubIssue('GITHUB_NETWORK', error instanceof Error ? error.message : String(error)),
    ]);
  }
  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    return fail([githubIssue('GITHUB_UNEXPECTED', `HTTP ${response.status}`)]);
  }
  if (typeof body['access_token'] === 'string') {
    const scopes =
      typeof body['scope'] === 'string' ? body['scope'].split(/[ ,]+/).filter((s) => s !== '') : [];
    return ok({ token: body['access_token'], scopes });
  }
  if (
    body['error'] === 'bad_verification_code' ||
    body['error'] === 'incorrect_client_credentials'
  ) {
    return fail([githubIssue('GITHUB_OAUTH_CODE_INVALID')]);
  }
  return fail([githubIssue('GITHUB_UNEXPECTED', String(body['error'] ?? 'réponse vide'))]);
}

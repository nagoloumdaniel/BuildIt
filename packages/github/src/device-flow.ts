import { fail, ok } from '@project-factory/validation';
import type { Fetch, Result } from './client.js';
import { githubIssue } from './errors.js';

/**
 * Connexion par code (OAuth device flow) : l'utilisateur saisit un code court
 * sur github.com ; aucun mot de passe ne transite par Project Factory.
 */

/** Permissions demandées, annoncées avant la connexion (§20bis). */
export const SCOPES = {
  /** Cloner un dépôt privé, créer un dépôt, gérer les collaborateurs. */
  full: ['repo'],
  /** Dépôts publics seulement. */
  publicOnly: ['public_repo'],
} as const;

export interface DeviceCode {
  readonly deviceCode: string;
  /** Le code à saisir sur github.com. */
  readonly userCode: string;
  readonly verificationUri: string;
  /** Secondes. */
  readonly expiresIn: number;
  readonly interval: number;
}

export interface AccessToken {
  readonly token: string;
  readonly scopes: readonly string[];
}

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

async function post(
  fetcher: Fetch,
  url: string,
  form: Record<string, string>,
): Promise<Result<Record<string, unknown>>> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'project-factory',
      },
      body: new URLSearchParams(form).toString(),
    });
  } catch (error) {
    return fail([
      githubIssue('GITHUB_NETWORK', error instanceof Error ? error.message : String(error)),
    ]);
  }
  try {
    return ok((await response.json()) as Record<string, unknown>);
  } catch {
    return fail([githubIssue('GITHUB_UNEXPECTED', `HTTP ${response.status}`)]);
  }
}

const DISABLED_HINT =
  'L’application OAuth de Project Factory doit avoir le device flow activé. En attendant : pf login --with-token.';

export async function requestDeviceCode(
  fetcher: Fetch,
  clientId: string,
  scopes: readonly string[],
): Promise<Result<DeviceCode>> {
  const result = await post(fetcher, DEVICE_CODE_URL, {
    client_id: clientId,
    scope: scopes.join(' '),
  });
  if (!result.ok) {
    return result;
  }
  const body = result.value;
  if (typeof body['device_code'] !== 'string' || typeof body['user_code'] !== 'string') {
    return fail([githubIssue('GITHUB_DEVICE_DISABLED', '', DISABLED_HINT)]);
  }
  return ok({
    deviceCode: body['device_code'],
    userCode: body['user_code'],
    verificationUri:
      typeof body['verification_uri'] === 'string'
        ? body['verification_uri']
        : 'https://github.com/login/device',
    expiresIn: Number(body['expires_in'] ?? 900),
    interval: Number(body['interval'] ?? 5),
  });
}

export interface PollOptions {
  /** Attente injectable : les tests ne dorment pas. */
  readonly sleep?: (seconds: number) => Promise<void>;
}

const realSleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** Attend que l'utilisateur ait saisi le code, en respectant le rythme imposé par GitHub. */
export async function pollAccessToken(
  fetcher: Fetch,
  clientId: string,
  code: DeviceCode,
  options: PollOptions = {},
): Promise<Result<AccessToken>> {
  const sleep = options.sleep ?? realSleep;
  let interval = code.interval;
  let waited = 0;
  while (waited <= code.expiresIn) {
    await sleep(interval);
    waited += interval;
    const result = await post(fetcher, TOKEN_URL, {
      client_id: clientId,
      device_code: code.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (!result.ok) {
      return result;
    }
    const body = result.value;
    if (typeof body['access_token'] === 'string') {
      const scopes =
        typeof body['scope'] === 'string'
          ? body['scope'].split(/[ ,]+/).filter((s) => s !== '')
          : [];
      return ok({ token: body['access_token'], scopes });
    }
    switch (body['error']) {
      case 'authorization_pending':
        continue;
      case 'slow_down':
        interval = typeof body['interval'] === 'number' ? body['interval'] : interval + 5;
        continue;
      case 'expired_token':
        return fail([githubIssue('GITHUB_DEVICE_EXPIRED', '', 'Relancez pf login.')]);
      case 'access_denied':
        return fail([githubIssue('GITHUB_DEVICE_DENIED')]);
      case 'device_flow_disabled':
      case 'incorrect_client_credentials':
        return fail([githubIssue('GITHUB_DEVICE_DISABLED', '', DISABLED_HINT)]);
      default:
        return fail([githubIssue('GITHUB_UNEXPECTED', String(body['error'] ?? 'réponse vide'))]);
    }
  }
  return fail([githubIssue('GITHUB_DEVICE_EXPIRED', '', 'Relancez pf login.')]);
}

import { randomUUID } from 'node:crypto';
import {
  type DeviceCode,
  type Fetch,
  pollAccessToken,
  requestDeviceCode,
  SCOPES,
} from '@buildit/github';
import {
  describeIssues,
  disconnectedStatus,
  type GithubStatusView,
  githubStatus,
  type SessionDeps,
} from './session';

/**
 * La connexion par code (OAuth device flow, §20bis).
 *
 * Le `device_code` — ce qui s'échange contre un jeton — ne quitte **jamais** le
 * serveur : le navigateur ne reçoit qu'un identifiant opaque, le code court à
 * saisir sur github.com et l'adresse de vérification. Le jeton obtenu est rangé
 * dans le trousseau avant que quoi que ce soit d'autre ne soit rendu.
 */

export interface PermissionView {
  readonly scope: string;
  readonly reason: string;
}

const REASONS: Readonly<Record<string, string>> = {
  repo: 'cloner vos dépôts privés, créer un dépôt, gérer ses collaborateurs',
  public_repo: 'dépôts publics seulement : créer un dépôt public, gérer ses collaborateurs',
};

/** Les permissions demandées, chacune avec sa raison — affichées avant la connexion. */
export const PERMISSIONS: readonly PermissionView[] = SCOPES.full.map((scope) => ({
  scope,
  reason: REASONS[scope] ?? scope,
}));

/** Les permissions réellement demandées au device flow. */
export const REQUESTED_SCOPES: readonly string[] = SCOPES.full;

interface Pending {
  readonly code: DeviceCode;
  readonly expiresAt: number;
}

/**
 * Les codes en attente de saisie, côté serveur : la clé est un identifiant
 * opaque, jamais le `device_code`. Le serveur est un processus unique (§0,
 * local-first) et cette carte ne contient aucun jeton — seulement un secret
 * temporaire qui expire avec le code.
 */
const pending = new Map<string, Pending>();

/** Oublie les codes en attente — appelé par les tests, et utile après un redémarrage. */
export function forgetPendingDevices(): void {
  pending.clear();
}

function prune(now: number): void {
  for (const [id, entry] of pending) {
    if (entry.expiresAt <= now) {
      pending.delete(id);
    }
  }
}

export interface DeviceStartView {
  /** Identifiant opaque de l'attente — le `device_code` reste sur le serveur. */
  readonly id: string;
  /** Le code court à saisir sur github.com : fait pour être affiché. */
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresIn: number;
  readonly interval: number;
}

export type DeviceStartResult =
  | { readonly ok: true; readonly value: DeviceStartView }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Demande un code à GitHub. Sans identifiant d'application, on s'arrête **avant**
 * le réseau et on dit quoi faire : c'est une installation à configurer, pas une
 * saisie à corriger.
 */
export async function startDevice(
  fetcher: Fetch,
  clientId: string,
  scopes: readonly string[],
  now: number = Date.now(),
): Promise<DeviceStartResult> {
  if (clientId === '') {
    return {
      ok: false,
      issues: [
        'La connexion par code n’est pas configurée : l’application OAuth de BuildIt n’est pas enregistrée sur cette machine.',
        'Définissez PF_GITHUB_CLIENT_ID avec l’identifiant de l’application, puis relancez le serveur.',
      ],
    };
  }
  prune(now);
  const result = await requestDeviceCode(fetcher, clientId, scopes);
  if (!result.ok) {
    return { ok: false, issues: describeIssues(result.issues) };
  }
  const id = randomUUID();
  pending.set(id, { code: result.value, expiresAt: now + result.value.expiresIn * 1000 });
  return {
    ok: true,
    value: {
      id,
      userCode: result.value.userCode,
      verificationUri: result.value.verificationUri,
      expiresIn: result.value.expiresIn,
      interval: result.value.interval,
    },
  };
}

/** Le jeton, **pour le serveur seul**. L'appelant doit le ranger, jamais le rendre. */
export type DeviceWaitResult =
  | { readonly ok: true; readonly token: string; readonly scopes: readonly string[] }
  | { readonly ok: false; readonly issues: readonly string[] };

export interface DeviceWaitOptions {
  /** Horloge injectable : les tests ne manipulent pas `Date.now`. */
  readonly now?: () => number;
  /** Attente injectable : les tests ne dorment pas. */
  readonly sleep?: (seconds: number) => Promise<void>;
}

const NO_PENDING = ['Aucune connexion en cours : relancez la connexion par code.'];

/**
 * Attend que le code soit saisi. La boucle, le rythme et l'expiration sont ceux
 * de `pollAccessToken` : cette fonction ne réimplémente rien.
 */
export async function waitDevice(
  fetcher: Fetch,
  clientId: string,
  id: unknown,
  options: DeviceWaitOptions = {},
): Promise<DeviceWaitResult> {
  if (typeof id !== 'string') {
    return { ok: false, issues: NO_PENDING };
  }
  const entry = pending.get(id);
  if (entry === undefined) {
    return { ok: false, issues: NO_PENDING };
  }
  const now = options.now ?? Date.now;
  if (now() >= entry.expiresAt) {
    pending.delete(id);
    return { ok: false, issues: ['Le code a expiré avant d’être saisi : relancez la connexion.'] };
  }
  const result = await pollAccessToken(
    fetcher,
    clientId,
    entry.code,
    options.sleep === undefined ? {} : { sleep: options.sleep },
  );
  pending.delete(id);
  if (!result.ok) {
    return { ok: false, issues: describeIssues(result.issues) };
  }
  return { ok: true, token: result.value.token, scopes: result.value.scopes };
}

/**
 * Le chemin complet : attendre, ranger le jeton dans le trousseau, rendre l'état.
 *
 * Si le trousseau refuse, le jeton est **abandonné** : BuildIt n'a aucun
 * repli en clair, et l'écran affiche le refus du trousseau.
 */
export async function completeDeviceConnection(
  deps: SessionDeps,
  id: unknown,
  options: DeviceWaitOptions = {},
): Promise<GithubStatusView> {
  const result = await waitDevice(deps.fetch, deps.clientId, id, options);
  if (!result.ok) {
    return disconnectedStatus(deps, result.issues);
  }
  const refusal = await deps.store.set(result.token);
  if (refusal !== undefined) {
    return disconnectedStatus(deps, describeIssues([refusal]));
  }
  return githubStatus(deps);
}

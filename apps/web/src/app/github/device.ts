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
 * Le `device_code` ce qui s'échange contre un jeton ne quitte **jamais** le
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

/** Les permissions demandées, chacune avec sa raison affichées avant la connexion. */
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
 * Où vivent les codes en attente de saisie entre le démarrage de la connexion
 * (`startDevice`) et son attente (`waitDevice`) deux Server Actions, donc
 * deux requêtes séparées.
 *
 * En local (§0), c'est un processus unique : une `Map` en mémoire suffit,
 * `memoryDevicePendingStore` ci-dessous. En hébergé (Phase 12), rien ne
 * garantit que les deux requêtes atteignent la même instance serverless une
 * `Map` de module y est invisible d'une requête à l'autre, et la connexion
 * échouait en silence (« Aucune connexion en cours ») alors que l'utilisateur
 * venait de saisir le code. Un visiteur hébergé a donc besoin d'un magasin qui
 * ne dépend d'aucune mémoire de processus un cookie scellé, comme le jeton
 * lui-même (`lib/session-cookie.ts`).
 */
export interface DevicePendingStore {
  save(id: string, entry: Pending): void | Promise<void>;
  load(id: string): (Pending | undefined) | Promise<Pending | undefined>;
  clear(id: string): void | Promise<void>;
}

/**
 * Les codes en attente de saisie, en mémoire : la clé est un identifiant
 * opaque, jamais le `device_code`. Valable tant qu'une seule instance de
 * processus répond aux deux requêtes du flux vrai en local (§0), faux en
 * hébergé (voir `DevicePendingStore`).
 */
const pending = new Map<string, Pending>();

export const memoryDevicePendingStore: DevicePendingStore = {
  save(id, entry) {
    pending.set(id, entry);
  },
  load(id) {
    return pending.get(id);
  },
  clear(id) {
    pending.delete(id);
  },
};

/** Oublie les codes en attente appelé par les tests, et utile après un redémarrage. */
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
  /** Identifiant opaque de l'attente le `device_code` reste sur le serveur. */
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
  store: DevicePendingStore = memoryDevicePendingStore,
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
  await store.save(id, { code: result.value, expiresAt: now + result.value.expiresIn * 1000 });
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
  store: DevicePendingStore = memoryDevicePendingStore,
): Promise<DeviceWaitResult> {
  if (typeof id !== 'string') {
    return { ok: false, issues: NO_PENDING };
  }
  const entry = await store.load(id);
  if (entry === undefined) {
    return { ok: false, issues: NO_PENDING };
  }
  const now = options.now ?? Date.now;
  if (now() >= entry.expiresAt) {
    await store.clear(id);
    return { ok: false, issues: ['Le code a expiré avant d’être saisi : relancez la connexion.'] };
  }
  const result = await pollAccessToken(
    fetcher,
    clientId,
    entry.code,
    options.sleep === undefined ? {} : { sleep: options.sleep },
  );
  await store.clear(id);
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
  store: DevicePendingStore = memoryDevicePendingStore,
): Promise<GithubStatusView> {
  const result = await waitDevice(deps.fetch, deps.clientId, id, options, store);
  if (!result.ok) {
    return disconnectedStatus(deps, result.issues);
  }
  const refusal = await deps.store.set(result.token);
  if (refusal !== undefined) {
    return disconnectedStatus(deps, describeIssues([refusal]));
  }
  return githubStatus(deps);
}

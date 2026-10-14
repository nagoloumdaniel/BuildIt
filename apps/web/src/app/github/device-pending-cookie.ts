import type { DeviceCode } from '@buildit/github';
import { type CookieJar, defaultCookieJar, sealJson, unsealJson } from '../../lib/session-cookie';
import type { DevicePendingStore } from './device';

/**
 * Le magasin hébergé du device flow (Phase 12 bis) : le code en attente vit
 * dans un cookie scellé, pas dans la mémoire du processus qui a répondu à
 * `startDevice` rien ne garantit que `waitDevice` retombe sur la même
 * instance serverless (c'est le bug corrigé ici : la connexion GitHub
 * échouait en hébergé, « Aucune connexion en cours », alors que le code
 * venait d'être saisi).
 *
 * Même scellé que le jeton lui-même (`lib/session-cookie.ts`), un cookie
 * différent : celui-ci ne porte jamais de jeton, seulement un `device_code`
 * en transit, et sa durée de vie est celle du flux (quelques minutes), pas de
 * la session.
 *
 * `id` n'est pas utilisé comme clé un seul visiteur ne mène qu'une seule
 * connexion à la fois, un seul cookie suffit. Il est tout de même comparé : un
 * identifiant différent de celui scellé (onglet concurrent, rechargement sur
 * un ancien lien) est traité comme une absence, jamais comme une connexion
 * d'un autre flux.
 */
export const DEVICE_PENDING_COOKIE_NAME = 'pf_github_device_pending';

interface SealedPending {
  readonly id: string;
  readonly code: DeviceCode;
  readonly expiresAt: number;
}

export function cookieDevicePendingStore(
  secret: string,
  jar: () => CookieJar = defaultCookieJar,
): DevicePendingStore {
  return {
    save(id, entry) {
      if (secret === '') {
        return;
      }
      const sealed = sealJson<SealedPending>({ id, ...entry }, secret);
      jar().set(DEVICE_PENDING_COOKIE_NAME, sealed, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    },
    load(id) {
      if (secret === '') {
        return undefined;
      }
      const cookie = jar().get(DEVICE_PENDING_COOKIE_NAME);
      if (cookie === undefined) {
        return undefined;
      }
      const stored = unsealJson<SealedPending>(cookie.value, secret);
      if (stored === undefined || stored.id !== id) {
        return undefined;
      }
      return { code: stored.code, expiresAt: stored.expiresAt };
    },
    clear() {
      jar().delete(DEVICE_PENDING_COOKIE_NAME);
    },
  };
}

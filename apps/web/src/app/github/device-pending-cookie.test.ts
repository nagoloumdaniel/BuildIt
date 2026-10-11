import type { DeviceCode } from '@buildit/github';
import { describe, expect, it } from 'vitest';
import { cookieDevicePendingStore, DEVICE_PENDING_COOKIE_NAME } from './device-pending-cookie';

/**
 * Bug rapporté : « la connexion GitHub ne marche pas en ligne ». Reproduit ici
 * sans Vercel — `startDevice` et `waitDevice` sont deux Server Actions, donc
 * deux requêtes ; en hébergé, rien ne garantit qu'elles atteignent la même
 * instance serverless. L'ancien magasin (une `Map` de module) était invisible
 * d'une requête à l'autre dans ce cas : `waitDevice` recevait toujours
 * `undefined`, et l'écran affichait « Aucune connexion en cours » juste après
 * que l'utilisateur ait saisi le code.
 *
 * La preuve qui compte n'est donc pas « ça marche avec le même magasin » —
 * une `Map` passait déjà ce test-là — mais « ça marche avec deux magasins qui
 * ne partagent **que** le texte du cookie », exactement ce qu'un navigateur
 * fait circuler entre deux requêtes vers deux instances différentes.
 */

const SECRET = 'un-secret-de-test-assez-long-pour-etre-credible';
const CODE: DeviceCode = {
  deviceCode: 'device-secret-cote-serveur',
  userCode: 'ABCD-1234',
  verificationUri: 'https://github.com/login/device',
  expiresIn: 900,
  interval: 5,
};

/** Un cookie qui ne vit que dans une chaîne — le seul canal entre deux requêtes. */
function wireBetweenRequests() {
  let sealedValue: string | undefined;
  return {
    /** Le magasin d'une requête : écrit dans le fil, ne lit que ce qu'il y a posé. */
    requestJar() {
      let local: string | undefined;
      return {
        get(name: string) {
          return local === undefined ? undefined : { name, value: local };
        },
        set(name: string, value: string) {
          local = value;
          sealedValue = value;
        },
        delete() {
          local = undefined;
          sealedValue = undefined;
        },
      };
    },
    /** Une requête qui ne connaît que ce que la précédente a mis sur le fil. */
    nextRequestJar() {
      let local = sealedValue;
      return {
        get(name: string) {
          return local === undefined ? undefined : { name, value: local };
        },
        set(name: string, value: string) {
          local = value;
          sealedValue = value;
        },
        delete() {
          local = undefined;
          sealedValue = undefined;
        },
      };
    },
  };
}

describe('cookieDevicePendingStore — survit à deux instances serverless différentes', () => {
  it('le code posé par une requête se retrouve dans une autre, par le seul cookie', async () => {
    const wire = wireBetweenRequests();
    const request1 = cookieDevicePendingStore(SECRET, wire.requestJar);
    await request1.save('id-1', { code: CODE, expiresAt: Date.now() + 900_000 });

    // Aucune mémoire partagée : un second magasin, construit à part, qui ne
    // reçoit que le texte du cookie — le bug exact que cette tâche corrige.
    const request2 = cookieDevicePendingStore(SECRET, wire.nextRequestJar);
    const loaded = await request2.load('id-1');

    expect(loaded?.code).toEqual(CODE);
  });

  it('un identifiant différent de celui scellé est traité comme une absence', async () => {
    const wire = wireBetweenRequests();
    const request1 = cookieDevicePendingStore(SECRET, wire.requestJar);
    await request1.save('id-1', { code: CODE, expiresAt: Date.now() + 900_000 });

    const request2 = cookieDevicePendingStore(SECRET, wire.nextRequestJar);
    expect(await request2.load('id-autre-flux')).toBeUndefined();
  });

  it('sans cookie posé, rend undefined plutôt que de lever', async () => {
    const wire = wireBetweenRequests();
    const request = cookieDevicePendingStore(SECRET, wire.nextRequestJar);
    expect(await request.load('id-1')).toBeUndefined();
  });

  it('clear() efface le cookie — relu par une requête suivante, absent', async () => {
    const wire = wireBetweenRequests();
    const request1 = cookieDevicePendingStore(SECRET, wire.requestJar);
    await request1.save('id-1', { code: CODE, expiresAt: Date.now() + 900_000 });
    await request1.clear('id-1');

    const request2 = cookieDevicePendingStore(SECRET, wire.nextRequestJar);
    expect(await request2.load('id-1')).toBeUndefined();
  });

  it('sans SESSION_SECRET, ne range rien — jamais de repli en clair', async () => {
    const wire = wireBetweenRequests();
    const request1 = cookieDevicePendingStore('', wire.requestJar);
    await request1.save('id-1', { code: CODE, expiresAt: Date.now() + 900_000 });

    const request2 = cookieDevicePendingStore('', wire.nextRequestJar);
    expect(await request2.load('id-1')).toBeUndefined();
  });

  it('le cookie ne contient jamais le device_code en clair', async () => {
    const wire = wireBetweenRequests();
    const request = cookieDevicePendingStore(SECRET, wire.requestJar);
    await request.save('id-1', { code: CODE, expiresAt: Date.now() + 900_000 });

    // Une requête suivante ne voit que ce qui a transité sur le fil — le même
    // texte qu'un navigateur aurait renvoyé dans l'en-tête `Cookie`.
    const written = wire.nextRequestJar().get(DEVICE_PENDING_COOKIE_NAME);
    expect(JSON.stringify(written)).not.toContain(CODE.deviceCode);
  });
});

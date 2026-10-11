import { describe, expect, it } from 'vitest';
import { cookieTokenStore, sealToken, unsealToken } from './session-cookie';

/**
 * Jeton GitHub par visiteur, en mode hébergé (Phase 12).
 *
 * Décision 8B.6 gardait un seul jeton, dans le trousseau du serveur — valable
 * tant qu'il n'y a qu'un visiteur. En hébergé, deux visiteurs anonymes
 * partageraient sinon le même compte GitHub : un vrai problème de sécurité,
 * pas un détail (cf. le prompt de cette tâche). La correction : le jeton vit
 * **scellé** (AES-256-GCM, `node:crypto`) dans un cookie httpOnly/secure,
 * unique par session de visiteur, jamais dans une variable serveur globale.
 */

const TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz012345';
const SECRET = 'un-secret-de-test-assez-long-pour-etre-credible';

describe('sealToken / unsealToken', () => {
  it('scelle puis descelle le même jeton', () => {
    const sealed = sealToken(TOKEN, SECRET);
    expect(unsealToken(sealed, SECRET)).toBe(TOKEN);
  });

  it('le scellé ne contient pas le jeton en clair', () => {
    const sealed = sealToken(TOKEN, SECRET);
    expect(sealed).not.toContain(TOKEN);
  });

  it('deux scellés du même jeton diffèrent (IV aléatoire)', () => {
    expect(sealToken(TOKEN, SECRET)).not.toBe(sealToken(TOKEN, SECRET));
  });

  it('refuse de desceller avec le mauvais secret — c’est la preuve que le jeton d’un visiteur n’est pas lisible par un autre', () => {
    const sealed = sealToken(TOKEN, SECRET);
    expect(unsealToken(sealed, 'un-autre-secret-tout-aussi-long-mais-different')).toBeUndefined();
  });

  it('refuse une valeur altérée (authentification GCM)', () => {
    const sealed = sealToken(TOKEN, SECRET);
    const tampered = `${sealed.slice(0, -2)}${sealed.slice(-2) === 'AA' ? 'BB' : 'AA'}`;
    expect(unsealToken(tampered, SECRET)).toBeUndefined();
  });

  it('refuse une valeur qui n’a pas la forme attendue', () => {
    expect(unsealToken('pas-du-tout-un-scelle', SECRET)).toBeUndefined();
  });

  it('refuse un jeton qui, une fois descellé, n’a pas la forme d’un jeton GitHub', () => {
    const sealed = sealToken('pas un jeton', SECRET);
    expect(unsealToken(sealed, SECRET)).toBeUndefined();
  });
});

/** Un faux magasin de cookies : assez pour prouver l'isolement par visiteur. */
function fakeCookieJar() {
  const jars = new Map<string, string>();
  return {
    jars,
    forVisitor(id: string) {
      return {
        get(name: string) {
          const value = jars.get(`${id}:${name}`);
          return value === undefined ? undefined : { name, value };
        },
        set(name: string, value: string, _options?: unknown) {
          jars.set(`${id}:${name}`, value);
        },
        delete(name: string) {
          jars.delete(`${id}:${name}`);
        },
      };
    },
  };
}

describe('cookieTokenStore', () => {
  it('range puis relit le jeton via le cookie fourni', async () => {
    const jar = fakeCookieJar();
    const cookies = jar.forVisitor('a');
    const store = cookieTokenStore(SECRET, () => cookies);
    expect(await store.set(TOKEN)).toBeUndefined();
    expect(await store.get()).toBe(TOKEN);
  });

  it('un visiteur ne lit jamais le jeton scellé pour un autre — c’est le cœur de la garantie (§2 du prompt)', async () => {
    const jar = fakeCookieJar();
    const storeA = cookieTokenStore(SECRET, () => jar.forVisitor('visiteur-A'));
    const storeB = cookieTokenStore(SECRET, () => jar.forVisitor('visiteur-B'));

    await storeA.set(TOKEN);

    expect(await storeB.get()).toBeUndefined();
    expect(await storeA.get()).toBe(TOKEN);
  });

  it('delete retire le cookie', async () => {
    const jar = fakeCookieJar();
    const cookies = jar.forVisitor('a');
    const store = cookieTokenStore(SECRET, () => cookies);
    await store.set(TOKEN);
    expect(await store.delete()).toBeUndefined();
    expect(await store.get()).toBeUndefined();
  });

  it('refuse de ranger un jeton qui n’a pas la forme attendue', async () => {
    const jar = fakeCookieJar();
    const store = cookieTokenStore(SECRET, () => jar.forVisitor('a'));
    const refusal = await store.set('pas un jeton');
    expect(refusal?.code).toBe('GITHUB_TOKEN_INVALID');
  });

  it('sans SESSION_SECRET, refuse d’enregistrer — jamais de repli en clair', async () => {
    const jar = fakeCookieJar();
    const store = cookieTokenStore('', () => jar.forVisitor('a'));
    const refusal = await store.set(TOKEN);
    expect(refusal?.code).toBe('GITHUB_SESSION_SECRET_MISSING');
    expect(await store.get()).toBeUndefined();
  });
});

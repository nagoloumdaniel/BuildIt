import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { type GitHubIssue, githubIssue, isTokenShaped, type TokenStore } from '@buildit/github';
import { cookies } from 'next/headers';

/**
 * Le jeton GitHub par visiteur, en mode hébergé (Phase 12).
 *
 * Le trousseau du système (`packages/github/src/token-store.ts`) suppose un
 * seul visiteur par machine — vrai en local (décision 8B.6), faux dès que
 * deux personnes ouvrent le même déploiement public : elles partageraient
 * sinon le même compte GitHub via les Server Actions. La correction retenue
 * ici est un cookie **scellé** (chiffré et authentifié, jamais en clair),
 * httpOnly et secure, posé par le serveur et relu à chaque requête — un jeton
 * par session de navigateur, jamais une variable serveur globale.
 *
 * Chiffrement : AES-256-GCM avec `node:crypto`, sans dépendance ajoutée (le
 * monorepo n'a ni `jose` ni `iron-session` ; en ajouter une pour un scellé de
 * 30 lignes serait disproportionné — cf. consigne de la tâche). La clé est
 * dérivée de `SESSION_SECRET` par SHA-256 (qui produit exactement les 32
 * octets qu'AES-256 exige, quelle que soit la longueur du secret fourni).
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const SESSION_COOKIE_NAME = 'pf_github_session';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** Chiffre et authentifie le jeton. Le résultat est sûr à poser dans un cookie. */
export function sealToken(token: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Descelle un cookie. Rend `undefined` pour toute entrée qui n'est pas un
 * scellé valide pour ce secret — forme invalide, authentification GCM
 * échouée (valeur altérée ou secret différent), ou jeton qui, une fois
 * déchiffré, n'a pas la forme d'un jeton GitHub. Jamais d'exception : un
 * cookie de visiteur est une entrée non fiable comme une autre.
 */
export function unsealToken(sealed: string, secret: string): string | undefined {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    if (raw.length <= IV_LENGTH + TAG_LENGTH) {
      return undefined;
    }
    const key = deriveKey(secret);
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = raw.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
    return isTokenShaped(decrypted) ? decrypted : undefined;
  } catch {
    return undefined;
  }
}

/** La forme minimale d'un magasin de cookies dont ce module a besoin — celle de `next/headers`. */
export interface CookieJar {
  get(name: string): { readonly value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

function defaultCookieJar(): CookieJar {
  // `cookies()` n'est valide que dans une portée de requête (Server Action,
  // Route Handler, composant serveur) : importé ici, appelé seulement au
  // moment de `get`/`set`/`delete`, jamais à la construction du magasin.
  return cookies() as unknown as CookieJar;
}

const MISSING_SECRET: GitHubIssue = githubIssue(
  'GITHUB_SESSION_SECRET_MISSING',
  '',
  'Configurez SESSION_SECRET dans les variables d’environnement du déploiement, puis redéployez.',
);

/**
 * Le jeton d'un visiteur, scellé dans un cookie — l'équivalent du trousseau
 * du système pour le mode hébergé.
 *
 * Sans `SESSION_SECRET`, ce magasin refuse systématiquement d'enregistrer :
 * il n'existe aucun repli en clair, à l'image du trousseau qui refuse quand
 * il est indisponible (même motif que `keychainStore`).
 */
export function cookieTokenStore(
  secret: string,
  jar: () => CookieJar = defaultCookieJar,
): TokenStore {
  return {
    location: 'cookie de session (scellé, par visiteur)',
    async get() {
      if (secret === '') {
        return undefined;
      }
      const cookie = jar().get(SESSION_COOKIE_NAME);
      if (cookie === undefined) {
        return undefined;
      }
      return unsealToken(cookie.value, secret);
    },
    async set(token) {
      if (!isTokenShaped(token)) {
        return githubIssue('GITHUB_TOKEN_INVALID');
      }
      if (secret === '') {
        return MISSING_SECRET;
      }
      jar().set(SESSION_COOKIE_NAME, sealToken(token, secret), {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        // Pas de `maxAge` : cookie de session, effacé à la fermeture du
        // navigateur. Une durée de vie plus longue est une décision produit
        // (voir « ce qui reste à faire manuellement » de la spec Phase 12).
      });
      return undefined;
    },
    async delete() {
      jar().delete(SESSION_COOKIE_NAME);
      return undefined;
    },
  };
}

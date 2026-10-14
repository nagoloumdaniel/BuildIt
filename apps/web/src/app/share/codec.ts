import { type Manifest, parseManifest, serializeManifest } from '@buildit/manifest';
import { isLoopbackOrigin } from './origin';

/**
 * Le codec du partage en lecture seule (§20, décision 9.1).
 *
 * Le manifest est encodé dans le **fragment** de l'URL : `/share#<base64url>`.
 * Un fragment n'est jamais envoyé au serveur c'est le navigateur qui le garde
 * —, donc il ne peut fuiter ni dans un journal, ni dans un cookie, ni dans un
 * en-tête `Referer`. Il n'y a pas d'identifiant à énumérer : le lien **est** la
 * donnée, et il fonctionne partout où `pf web` tourne.
 *
 * Fonctions pures, sans React et sans accès réseau : les seules dépendances
 * sont `serializeManifest` (la forme canonique du manifest) et `parseManifest`
 * (qui revalide tout ce qui revient d'un lien un lien reçu n'est pas de
 * confiance). `btoa`/`atob` sont fournis par le navigateur comme par Node.
 */

/** L'emplacement de la page, sans origine : l'origine est celle du serveur qui sert l'UI. */
export const SHARE_PATH = '/share';

/** Ce que produit du base64url : aucun caractère à échapper dans un fragment. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

/** `undefined` quand la charge n'est pas du base64url exploitable jamais une exception. */
function base64UrlToBytes(payload: string): Uint8Array | undefined {
  if (payload === '' || !BASE64URL.test(payload)) {
    return undefined;
  }
  const padded = payload.replaceAll('-', '+').replaceAll('_', '/');
  const remainder = padded.length % 4;
  let binary: string;
  try {
    binary = atob(remainder === 0 ? padded : padded + '='.repeat(4 - remainder));
  } catch {
    return undefined;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** La charge utile d'un manifest : sa forme canonique, puis du base64url. */
export function encodeSharePayload(manifest: Manifest): string {
  return bytesToBase64Url(new TextEncoder().encode(serializeManifest(manifest)));
}

/** `/share#<charge>` le chemin seul, sans origine. */
export function sharePath(payload: string): string {
  return `${SHARE_PATH}#${payload}`;
}

function trimBase(base: string): string {
  return base.trim().replace(/\/+$/, '');
}

/**
 * Le lien complet. Sans `base`, le lien est relatif (`/share#…`) : l'appelant
 * qui a une origine doit la fournir, un lien relatif ne s'ouvre pas ailleurs.
 */
export function encodeShareLink(manifest: Manifest, base = ''): string {
  return `${trimBase(base)}${sharePath(encodeSharePayload(manifest))}`;
}

/**
 * L'origine à retenir : celle que le serveur propose si elle existe, celle du
 * navigateur sinon. Une base proposée sert quand l'UI est atteinte par un autre
 * nom que `127.0.0.1` (tunnel, nom d'hôte, site hébergé) Phase 12.
 *
 * Dernier garde-fou : une base en boucle locale ne l'emporte jamais sur une
 * page ouverte depuis un vrai domaine. Le navigateur sait sous quel nom il a
 * atteint le site ; un lien `127.0.0.1` envoyé depuis le site public ne
 * s'ouvrirait chez personne.
 */
export function shareOrigin(configured: string, current: string): string {
  const trimmed = trimBase(configured);
  if (trimmed === '') {
    return current;
  }
  return isLoopbackOrigin(trimmed) && !isLoopbackOrigin(current) ? current : trimmed;
}

/**
 * Le fragment, réduit à sa charge utile.
 *
 * `location.hash` rend le fragment brut. Les caractères de base64url n'ont pas
 * besoin d'être échappés, mais un lien recopié à la main peut l'être : on
 * décode **quand c'est possible**, sans jamais lever (un `%` orphelin fait
 * échouer `decodeURIComponent`).
 */
export function payloadFromHash(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export type ShareDecodeResult =
  | { readonly ok: true; readonly value: Manifest }
  | { readonly ok: false; readonly issues: readonly string[] };

const EMPTY = 'Ce lien ne porte aucune configuration : son fragment est vide.';
const BROKEN = 'Ce lien est incomplet ou altéré : sa configuration n’a pas pu être lue.';
const NOT_UTF8 = 'Ce lien ne contient pas du texte lisible.';
const NOT_JSON = 'Ce lien ne contient pas une configuration exploitable.';

/**
 * Décode un fragment et revalide le manifest.
 *
 * Chaque échec charge tronquée, base64 invalide, UTF-8 invalide, JSON
 * corrompu, manifest refusé rend une phrase, jamais une pile : cette page est
 * publique, elle ne montre pas de trace technique.
 */
export function decodeSharePayload(payload: string): ShareDecodeResult {
  if (payload === '') {
    return { ok: false, issues: [EMPTY] };
  }
  const bytes = base64UrlToBytes(payload);
  if (bytes === undefined) {
    return { ok: false, issues: [BROKEN] };
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, issues: [NOT_UTF8] };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, issues: [NOT_JSON] };
  }
  const manifest = parseManifest(json);
  if (!manifest.ok) {
    return {
      ok: false,
      issues: manifest.issues.map((issue) =>
        issue.hint === undefined ? issue.message : `${issue.message} ${issue.hint}`,
      ),
    };
  }
  return { ok: true, value: manifest.value };
}

/** Le chemin complet : du fragment brut au manifest, ou aux raisons du refus. */
export function decodeShareHash(hash: string): ShareDecodeResult {
  return decodeSharePayload(payloadFromHash(hash));
}

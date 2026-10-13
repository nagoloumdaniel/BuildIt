import { type EnvLike, isHostedEnvironment } from '../../lib/hosting';

/**
 * L'origine publique d'un lien de partage (§20), fonctions pures.
 *
 * Pourquoi un module à part : `actions-share.ts` est un fichier `'use server'`,
 * qui ne peut exporter que des fonctions asynchrones. La décision vit donc ici,
 * testable sans requête ni serveur, et l'action ne fait que lui passer
 * l'environnement et les en-têtes de la requête.
 *
 * La règle tient en une phrase : **un lien partagé depuis le site hébergé ne
 * pointe jamais vers une boucle locale**. Un `127.0.0.1` dans un lien envoyé à
 * quelqu'un d'autre ne s'ouvre que chez lui, c'est-à-dire nulle part.
 */

/** Les en-têtes de la requête qui disent sous quel nom le site a été atteint. */
export interface RequestOrigin {
  readonly proto: string | null;
  readonly host: string | null;
}

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** Vrai si l'origine désigne la machine elle-même : inutilisable chez un autre. */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Une origine exploitable, ou `''`.
 *
 * Refusés : absence de schéma, schéma autre que `http`/`https`, chemin, requête
 * ou fragment. Mieux vaut retomber sur l'origine du navigateur que produire un
 * lien qui ne s'ouvre nulle part.
 */
export function cleanOrigin(value: string | undefined | null): string {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') {
    return '';
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return '';
  }
  if ((url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    return '';
  }
  return url.origin;
}

/**
 * L'origine sous laquelle la requête est arrivée, d'après le proxy.
 *
 * Vercel pose `x-forwarded-proto` et `host` (ou `x-forwarded-host`) : c'est le
 * nom que le visiteur a réellement tapé, `trybuildit.vercel.app` compris. Un
 * en-tête à plusieurs valeurs (`https, http`) garde la première, celle du
 * client.
 */
export function originFromRequest(request: RequestOrigin | null): string {
  if (request === null) {
    return '';
  }
  const host = (request.host ?? '').split(',')[0]?.trim() ?? '';
  if (host === '' || /[\s/?#@]/.test(host)) {
    return '';
  }
  const proto = (request.proto ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  const scheme = proto === 'http' || proto === 'https' ? proto : 'https';
  return cleanOrigin(`${scheme}://${host}`);
}

/** Un nom d'hôte Vercel (sans schéma) devenu origine `https`, ou `''`. */
function vercelOrigin(value: string | undefined): string {
  const host = (value ?? '').trim();
  return host === '' ? '' : cleanOrigin(`https://${host}`);
}

/**
 * L'origine publique à proposer au navigateur, ou `''` : il emploiera alors la
 * sienne (`window.location.origin`), qui est toujours juste pour le visiteur.
 *
 * - **En local** (`pf web`), seule `PF_SHARE_BASE_URL` peut la changer (tunnel,
 *   nom d'hôte) ; sinon le navigateur garde l'origine locale, ce qui est le
 *   comportement attendu sur la machine.
 * - **En hébergé**, chaque source est tentée dans l'ordre, et toute boucle
 *   locale est écartée : `PF_SHARE_BASE_URL`, puis le nom sous lequel la
 *   requête est arrivée, puis `PF_SITE_URL`, puis les domaines que Vercel pose
 *   lui-même (`VERCEL_PROJECT_PRODUCTION_URL`, puis `VERCEL_URL`).
 */
export function publicShareBase(env: EnvLike, request: RequestOrigin | null): string {
  const configured = cleanOrigin(env['PF_SHARE_BASE_URL']);
  if (!isHostedEnvironment(env)) {
    return configured;
  }
  const candidates = [
    configured,
    originFromRequest(request),
    cleanOrigin(env['PF_SITE_URL']),
    vercelOrigin(env['VERCEL_PROJECT_PRODUCTION_URL']),
    vercelOrigin(env['VERCEL_URL']),
  ];
  return candidates.find((origin) => origin !== '' && !isLoopbackOrigin(origin)) ?? '';
}

import { cleanOrigin, isLoopbackOrigin } from '../app/share/origin';
import { type EnvLike, isHostedEnvironment } from './hosting';

/** Ce que `pf web` sert : le repli quand aucune origine publique n'est connue. */
export const LOCAL_SITE_ORIGIN = 'http://127.0.0.1:4173';

/**
 * L'origine absolue du site (canonique, Open Graph, robots, sitemap).
 *
 * Ordre : `PF_SITE_URL`, puis, en hébergé seulement, le domaine de production
 * que Vercel pose lui-même (`VERCEL_PROJECT_PRODUCTION_URL`), puis la boucle
 * locale. Aucun domaine n'est écrit en dur.
 */
export function siteOrigin(env: EnvLike = process.env): string {
  const configured = cleanOrigin(env['PF_SITE_URL']);
  if (configured !== '') {
    return configured;
  }
  if (isHostedEnvironment(env)) {
    const vercel = cleanOrigin(`https://${(env['VERCEL_PROJECT_PRODUCTION_URL'] ?? '').trim()}`);
    if (vercel !== '' && !isLoopbackOrigin(vercel)) {
      return vercel;
    }
  }
  return LOCAL_SITE_ORIGIN;
}

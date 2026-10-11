import type { MetadataRoute } from 'next';

/**
 * `/sitemap.xml`, engendré à la construction de l'application.
 *
 * Une seule URL aujourd'hui : la racine. C'est la seule page dont le contenu
 * soit destiné à être trouvé — les écrans du parcours (`/create/**`) sont
 * l'application elle-même, pas du contenu, et `/share` est en `noindex` (un lien
 * de partage décrit le projet de quelqu'un).
 *
 * La landing page publique (Phase 11.7) et les pages de documentation (11.2)
 * viendront s'ajouter ici quand elles existeront. Tant qu'il n'y a pas
 * d'hébergement, ce fichier n'est pas servi : il part avec le reste en Phase 12.
 *
 * Même origine que `robots.ts` : `PF_SITE_URL`, repli sur ce que sert `pf web`.
 */
const ORIGIN: string = (process.env['PF_SITE_URL'] ?? 'http://127.0.0.1:4173').replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${ORIGIN}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ];
}

import type { MetadataRoute } from 'next';
import { siteOrigin } from '../lib/site-origin';

/**
 * `/robots.txt`, engendré à la construction de l'application.
 *
 * L'origine vient de `PF_SITE_URL`, puis du domaine de production Vercel (`lib/site-origin.ts`), et le repli est
 * exactement ce que `pf web` sert : `http://127.0.0.1:4173`. Aucun domaine n'est
 * écrit en dur, parce qu'aucun n'existe encore : l'hébergement est la Phase 12.
 * Au déploiement, une variable d'environnement suffit, rien à éditer ici.
 *
 * Le fichier est engendré plutôt qu'écrit dans `public/` à dessein : un
 * `robots.txt` statique et cette route visent la même URL, et un
 * `Sitemap:` en dur demanderait de connaître le domaine **avant** de l'avoir.
 */
const ORIGIN: string = siteOrigin();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${ORIGIN}/sitemap.xml`,
  };
}

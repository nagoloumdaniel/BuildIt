/**
 * Détection d'environnement local / hébergé (Phase 12, §12-hebergement).
 *
 * Décision 8B.6 : le configurateur est conçu pour tourner en local, un seul
 * visiteur, lié à `127.0.0.1`. Le déployer sur Vercel (hébergement public,
 * multi-visiteurs) sans y toucher serait soit un 403 permanent (le `Host` du
 * domaine public n'est jamais `127.0.0.1`), soit, si on l'enlevait, une
 * régression de sécurité. La solution retenue : une détection d'environnement
 * qui bascule le comportement, jamais le supprime `pf web` reste identique.
 *
 * `VERCEL=1` est la variable que Vercel définit lui-même sur tout déploiement
 * (build et runtime) : la détecter ne demande aucune configuration. `PF_HOSTED`
 * est le même interrupteur pour un autre hébergeur ou pour les tests.
 *
 * `VERCEL=1` seul ne suffit pas : la CLI Vercel pose aussi `VERCEL=1` quand on
 * lance `vercel dev` **sur sa propre machine**, et le serveur y voit bien le
 * disque de l'utilisateur. Le classer « hébergé » supprimait le sélecteur natif
 * et l'installation, c'est-à-dire le seul chemin qui marche dans tous les
 * navigateurs. `VERCEL_ENV=development` est exactement cette signature : un
 * vrai déploiement vaut `production` ou `preview`.
 */

export type EnvLike = Readonly<Record<string, string | undefined>>;

export function isHostedEnvironment(env: EnvLike = process.env): boolean {
  if (env['PF_HOSTED'] === '1') {
    return true;
  }
  if (env['VERCEL'] !== '1') {
    return false;
  }
  return env['VERCEL_ENV'] !== 'development';
}

/** Les hôtes de boucle locale seuls autorisés tant que le mode n'est pas hébergé. */
const LOCAL_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '::1', '[::1]'];

/** Le nom d'hôte sans son port, en minuscules. */
export function hostName(raw: string | null): string {
  return (raw ?? '').replace(/:\d+$/, '').toLowerCase();
}

function hostnameOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/**
 * Les hôtes autorisés selon l'environnement.
 *
 * En local (par défaut), c'est exactement l'ensemble figé d'avant Phase 12 —
 * aucune variable ne peut l'élargir, `PF_SITE_URL` comprise : c'est la garantie
 * que `pf web` ne change pas de comportement. En hébergé, on y ajoute le ou
 * les domaines publics réels : `PF_SITE_URL` (déjà utilisée par `robots.ts` et
 * `sitemap.ts`) et `VERCEL_URL` (le domaine du déploiement courant, posé par
 * Vercel lui-même utile pour les URLs de prévisualisation).
 */
export function allowedHosts(env: EnvLike = process.env): Set<string> {
  const hosts = new Set(LOCAL_HOSTS);
  if (!isHostedEnvironment(env)) {
    return hosts;
  }
  const siteUrl = env['PF_SITE_URL'];
  if (siteUrl !== undefined && siteUrl !== '') {
    const hostname = hostnameOf(siteUrl);
    if (hostname !== undefined) {
      hosts.add(hostname);
    }
  }
  const vercelUrl = env['VERCEL_URL'];
  if (vercelUrl !== undefined && vercelUrl !== '') {
    hosts.add(vercelUrl.toLowerCase());
  }
  return hosts;
}

export function isAllowedHost(raw: string | null, env: EnvLike = process.env): boolean {
  return allowedHosts(env).has(hostName(raw));
}

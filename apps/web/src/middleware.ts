import { type NextRequest, NextResponse } from 'next/server';
import { isAllowedHost } from './lib/hosting';

/**
 * Le configurateur ne répond qu'à ses propres adresses.
 *
 * Décision 8B.6 : l'UI vit dans le même processus Node que le moteur, avec le
 * trousseau GitHub et le droit d'écrire des fichiers. Un serveur local n'est
 * pas pour autant privé : un navigateur qui ouvre une page hostile peut faire
 * résoudre un nom de domaine vers `127.0.0.1` (DNS rebinding) et atteindre ce
 * serveur **avec l' origine et les cookies de l'attaquant**, en contournant la
 * protection d'origine de Next par une simple requête `fetch` sans préflight.
 *
 * Refuser tout `Host` qui n'est pas une adresse de boucle locale ferme cette
 * porte : le nom de domaine de l'attaquant ne sera jamais celui sous lequel le
 * serveur accepte de répondre.
 *
 * Phase 12 — hébergement multi-visiteurs : sur Vercel (`VERCEL=1`), le `Host`
 * n'est jamais `127.0.0.1` pour un visiteur légitime non plus. `lib/hosting.ts`
 * porte la liste des hôtes autorisés et bascule selon l'environnement ; ce
 * fichier ne fait plus que l'interroger, pour que le comportement local
 * (§8B.6) reste figé et testé indépendamment de l'hébergement.
 */
export function middleware(request: NextRequest): NextResponse {
  if (isAllowedHost(request.headers.get('host'))) {
    return NextResponse.next();
  }
  return new NextResponse(
    'Hôte non autorisé : le configurateur de BuildIt ne répond pas à cette adresse.',
    { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
}

export const config = {
  // Toutes les routes, y compris les Server Actions et les fichiers statiques :
  // une seule porte, vérifiée au même endroit.
  matcher: '/:path*',
};

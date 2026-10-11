import { type NextRequest, NextResponse } from 'next/server';

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
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** Le nom d'hôte sans son port, en minuscules. */
function hostName(raw: string | null): string {
  return (raw ?? '').replace(/:\d+$/, '').toLowerCase();
}

export function middleware(request: NextRequest): NextResponse {
  if (LOCAL_HOSTS.has(hostName(request.headers.get('host')))) {
    return NextResponse.next();
  }
  return new NextResponse(
    'Hôte non autorisé : le configurateur de Project Factory ne répond qu’en local (127.0.0.1).',
    { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
}

export const config = {
  // Toutes les routes, y compris les Server Actions et les fichiers statiques :
  // une seule porte, vérifiée au même endroit.
  matcher: '/:path*',
};

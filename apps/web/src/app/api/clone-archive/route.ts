import type { NextRequest } from 'next/server';
import { hostedResponse } from '../../clone/hosted';
import { sessionDeps } from '../../github/server-deps';

/**
 * La copie d'un dépôt GitHub **sans `git`** (mode hébergé, écran 22).
 *
 * `/api/clone` lance `git clone` sur la machine du serveur : juste en local,
 * où le serveur est la machine de l'utilisateur. En hébergé, ce serveur est une
 * fonction Vercel, sans `git` et sans le disque de l'utilisateur. Cette route
 * télécharge l'archive du dépôt depuis l'API GitHub et la rend au navigateur,
 * qui écrit les fichiers dans le dossier choisi (ou télécharge le `.zip`).
 *
 * Toute la logique est dans `clone/hosted.ts` (testée sans réseau) ; ici, on
 * ne fait que lire le corps et le jeton du visiteur. Le jeton part vers
 * `api.github.com`, jamais dans la réponse.
 *
 * Le `middleware` filtre l'hôte avant cette route comme pour toute autre. La
 * route n'appelle qu'`api.github.com`, avec un propriétaire et un dépôt
 * validés par `parseRemote` : aucune adresse arbitraire ne peut être visée.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Une archive de 50 Mo met quelques secondes ; une minute laisse de la marge. */
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  let token: string | undefined;
  try {
    token = await sessionDeps().store.get();
  } catch {
    // Pas de session lisible : un dépôt public se copie quand même.
    token = undefined;
  }
  return hostedResponse(body, {
    ...(token === undefined ? {} : { token }),
    signal: request.signal,
  });
}

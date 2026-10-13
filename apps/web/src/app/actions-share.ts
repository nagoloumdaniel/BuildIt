'use server';

import { headers } from 'next/headers';
import { publicShareBase, type RequestOrigin } from './share/origin';

/**
 * Ce que le serveur apporte au partage (§20, décision 9.1).
 *
 * **Pas l'encodage** : le manifest voyage dans le fragment de l'URL, donc
 * l'envoyer au serveur pour qu'il rende un lien contredirait la décision — le
 * manifest doit ne jamais quitter le navigateur. Le seul élément que le
 * serveur peut apporter, c'est l'origine **publique** sous laquelle l'UI est
 * atteinte : la décision vit dans `share/origin.ts` (pure, testée), cette
 * action ne fait que lui passer l'environnement et les en-têtes de la requête.
 *
 * En local, sans `PF_SHARE_BASE_URL`, elle rend `''` : le client emploie
 * `window.location.origin`, le cas normal. En hébergé, elle ne rend jamais une
 * boucle locale.
 */
export async function shareLinkBaseAction(): Promise<string> {
  return publicShareBase(process.env, await currentRequest());
}

/**
 * Le nom sous lequel la requête est arrivée, ou `null` hors requête (tests,
 * rendu statique) : `headers()` lève alors, et l'origine se décide sans lui.
 */
async function currentRequest(): Promise<RequestOrigin | null> {
  try {
    const list = await headers();
    return {
      proto: list.get('x-forwarded-proto'),
      host: list.get('x-forwarded-host') ?? list.get('host'),
    };
  } catch {
    return null;
  }
}

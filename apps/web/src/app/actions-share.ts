'use server';

/**
 * Ce que le serveur apporte au partage (§20, décision 9.1).
 *
 * **Pas l'encodage** : le manifest voyage dans le fragment de l'URL, donc
 * l'envoyer au serveur pour qu'il rende un lien contredirait la décision — le
 * manifest doit ne jamais quitter le navigateur. Le seul élément que le
 * navigateur ne peut pas connaître, c'est l'origine **publique** sous laquelle
 * l'UI est atteinte quand ce n'est pas `127.0.0.1` (tunnel, nom d'hôte, Phase 12).
 *
 * `PF_SHARE_BASE_URL` la porte. Tant qu'elle est vide, le client emploie
 * `window.location.origin` — le cas normal, local.
 */

/**
 * Une origine exploitable, ou `''`.
 *
 * Refusés : absence de schéma, schéma autre que `http`/`https`, chemin, requête
 * ou fragment. Mieux vaut retomber sur l'origine du navigateur que produire un
 * lien qui ne s'ouvre nulle part.
 */
function configuredBase(value: string | undefined): string {
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

/** L'origine publique configurée, ou `''` : le client emploiera la sienne. */
export async function shareLinkBaseAction(): Promise<string> {
  return configuredBase(process.env['PF_SHARE_BASE_URL']);
}

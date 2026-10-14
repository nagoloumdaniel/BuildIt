/**
 * Les adresses extérieures du produit.
 *
 * Elles vivent ici plutôt qu'en dur dans un composant, pour la même raison que
 * les couleurs : une adresse recopiée dans trois écrans finit par en avoir
 * trois versions. `PF_REPO_URL` permet à un fork de pointer son propre dépôt
 * sans toucher au balisage.
 *
 * `NEXT_PUBLIC_` est volontaire : le lien est rendu dans l'en-tête, donc côté
 * navigateur une variable serveur y arriverait vide.
 */

const CONFIGURED = process.env['NEXT_PUBLIC_PF_REPO_URL'];

/** Le dépôt de BuildIt la cible du bouton GitHub de l'en-tête. */
export const REPO_URL: string =
  CONFIGURED === undefined || CONFIGURED === ''
    ? 'https://github.com/nagoloumdaniel/BuildIt'
    : CONFIGURED;

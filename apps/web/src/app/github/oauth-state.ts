/**
 * Le nom du cookie qui porte l'état anti-CSRF du flux OAuth (§20bis).
 *
 * Il vit dans son propre fichier et non dans `authorize/route.ts` : Next
 * n'autorise, dans un fichier de route, que les exports qu'il connaît
 * (`GET`, `POST`, `dynamic`…). Une constante exportée depuis là fait échouer
 * la validation de types du build. Les deux routes du flux la partagent, donc
 * elle est ici.
 */
export const STATE_COOKIE_NAME = 'pf_github_oauth_state';

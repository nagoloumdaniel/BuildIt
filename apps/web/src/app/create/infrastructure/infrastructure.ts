import type { DraftState } from '../../../lib/draft';
import { CI_ID, DOCKER_ID, draftInfraIds } from '../../../lib/infrastructure-ids';

/**
 * L'écran 9 Infrastructure (§6.9) : Docker, CI/CD, cloud cible.
 *
 * Le brouillon ne connaît **pas** de champ cloud : il porte deux booléens
 * (`infra.docker`, `infra.ci`) et une liste de technologies. L'hébergeur est
 * donc un choix de la catégorie `hosting` du catalogue, rangé dans
 * `draft.technologies` — c'est ce que `lib/draft-to-manifest.ts` attend.
 *
 * `hosting` est **cumulatif** dans le moteur (une API sur Fly.io et un web sur
 * Vercel) : l'écran n'a donc pas de règle d'unicité à lui, il applique la même
 * bascule que pour les six autres catégories d'infrastructure.
 *
 * Les deux identifiants sont ceux de `lib/infrastructure-ids.ts`, le seul
 * endroit qui les nomme : l'écran doit **dire** ce qu'il écrit, pas le
 * redéclarer. Il les ré-exporte pour ses lecteurs historiques.
 */

export { CI_ID, DOCKER_ID };

/** Les identifiants que les booléens ajoutent à la sélection, dans l'ordre. */
export function infrastructureIds(draft: DraftState): string[] {
  return [...draftInfraIds(draft)];
}

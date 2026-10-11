import type { DraftState } from '../../../lib/draft';

/**
 * L'écran 9 — Infrastructure (§6.9) : Docker, CI/CD, cloud cible.
 *
 * Le brouillon ne connaît **pas** de champ cloud : il porte deux booléens
 * (`infra.docker`, `infra.ci`) et une liste de technologies. Le cloud cible est
 * donc un choix de la catégorie `hosting` du catalogue, rangé dans
 * `draft.technologies` — c'est ce que `lib/draft-to-manifest.ts` attend, et il
 * n'y a rien à réinventer ici.
 *
 * Les deux identifiants ci-dessous sont exactement ceux que `draftToManifest`
 * ajoute à partir des booléens (`containers/docker`, `ci-cd/github-actions`).
 * Ils sont nommés ici parce que l'écran doit **dire** ce qu'il écrit ; un test
 * les confronte au mapping canonique.
 */

export const DOCKER_ID = 'docker';
export const CI_ID = 'github-actions';

/** Les identifiants que les booléens ajoutent à la sélection, dans l'ordre. */
export function infrastructureIds(draft: DraftState): string[] {
  const ids: string[] = [];
  if (draft.infra.docker) {
    ids.push(DOCKER_ID);
  }
  if (draft.infra.ci) {
    ids.push(CI_ID);
  }
  return ids;
}

/**
 * L'hébergeur déjà choisi, s'il y en a un.
 *
 * On le cherche parmi les identifiants de la catégorie `hosting` — la liste
 * vient du moteur, jamais d'une liste écrite ici (§11).
 */
export function selectedHosting(
  technologies: readonly string[],
  hostingIds: readonly string[],
): string | undefined {
  return hostingIds.find((id) => technologies.includes(id));
}

/**
 * Choisit le cloud cible, ou le retire (`id === null`).
 *
 * Un cloud cible est unique : choisir un hébergeur retire le précédent. Les
 * autres technologies ne sont pas touchées — un `hosting` ajouté à la main à
 * l'écran Stack Builder reste un choix légitime, il devient simplement le cloud
 * cible.
 */
export function chooseHosting(
  draft: DraftState,
  hostingIds: readonly string[],
  id: string | null,
): DraftState {
  const others = draft.technologies.filter((technology) => !hostingIds.includes(technology));
  return {
    ...draft,
    technologies: id === null ? others : [...others, id],
  };
}

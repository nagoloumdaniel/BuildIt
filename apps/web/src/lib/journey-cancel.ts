import { type DraftState, freshDraft } from './draft';

/**
 * Le brouillon porte-t-il un choix que l'annulation effacerait ?
 *
 * C'est ce qui décide entre annuler tout de suite et demander confirmation :
 * redemander sur un brouillon vierge serait une question pour rien, ne pas
 * demander sur un brouillon rempli ferait perdre un travail d'un seul clic.
 *
 * Ne comptent pas : l'étape (c'est la position, pas un choix), le mode guidé
 * ou expert (un réglage d'affichage, rien à perdre) et la résolution (un
 * calcul du moteur, refait à la demande).
 */
export function hasChoices(draft: DraftState): boolean {
  const fresh = freshDraft();
  return (
    draft.name !== fresh.name ||
    draft.targets.length > 0 ||
    draft.type !== undefined ||
    draft.architecture !== undefined ||
    draft.technologies.length > 0 ||
    draft.capabilities.length > 0 ||
    draft.envVarNames.length > 0 ||
    draft.infra.docker !== fresh.infra.docker ||
    draft.infra.ci !== fresh.infra.ci
  );
}

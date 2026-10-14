import type { DraftState } from './draft';

/**
 * Les deux seuls identifiants que le brouillon nomme lui-même.
 *
 * L'écran Infrastructure pose deux booléens (`infra.docker`, `infra.ci`) ; le
 * manifest, lui, ne connaît que des identifiants du catalogue
 * (`containers/docker`, `ci-cd/github-actions`). La traduction vit ici **une
 * seule fois** : `lib/draft-to-manifest.ts` les place dans le manifest,
 * `lib/selection.ts` les ajoute à la sélection envoyée au moteur, et l'écran
 * les affiche. Trois copies de ces chaînes divergeraient au premier renommage.
 *
 * `github-actions` est le seul fournisseur de CI du produit : les quatre presets
 * le posent, et le fichier engendré est un workflow GitHub.
 */

export const DOCKER_ID = 'docker';
export const CI_ID = 'github-actions';

/** Ce que l'écran Infrastructure pose : deux booléens, pas des technologies. */
export interface InfraBooleans {
  readonly docker: boolean;
  readonly ci: boolean;
}

/** Les identifiants que les booléens ajoutent à une sélection, dans l'ordre. */
export function infraIds(infra: InfraBooleans): readonly string[] {
  const ids: string[] = [];
  if (infra.docker) {
    ids.push(DOCKER_ID);
  }
  if (infra.ci) {
    ids.push(CI_ID);
  }
  return ids;
}

/** Le raccourci pour un brouillon entier : `infraIds(draft.infra)`. */
export function draftInfraIds(draft: DraftState): readonly string[] {
  return infraIds(draft.infra);
}

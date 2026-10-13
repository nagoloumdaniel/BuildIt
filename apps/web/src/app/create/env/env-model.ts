import { ENV_NAME_PATTERN } from '@buildit/manifest';
import type { DraftState } from '../../../lib/draft';
import type { EnvVarView } from '../../../lib/engine';
import { infrastructureIds } from '../infrastructure/infrastructure';

/**
 * L'écran 8 — Environment & Secrets (§6.8, §24).
 *
 * Rien ici ne connaît de **valeur** : le type du brouillon n'a pas de champ pour
 * elle (`envVarNames`), la vue du moteur n'en porte pas (`EnvVarView`), et la
 * grammaire du registry interdit le signe `=` dans un nom. La confidentialité
 * est donc une propriété du type, pas une consigne d'affichage.
 */

/** Ce que le moteur attend pour calculer les variables requises. */
export interface EnvSelection {
  readonly targets: readonly string[];
  readonly technologies: readonly string[];
}

/**
 * La sélection complète, **infra comprise**.
 *
 * `requiredEnvVars` part de la résolution du moteur : une technologie ajoutée
 * pour tenir une exigence apporte ses variables, et les booléens de l'écran 9
 * appartiennent à la même sélection (`docker`, `github-actions` — la règle de
 * `chosenIds` dans `lib/draft-to-manifest.ts`).
 */
export function envSelection(draft: DraftState): EnvSelection {
  return {
    targets: [...draft.targets],
    technologies: [
      ...new Set([...draft.technologies, ...draft.capabilities, ...infrastructureIds(draft)]),
    ].sort(),
  };
}

/** Les noms seuls — c'est tout ce que le brouillon a le droit de retenir. */
export function namesOf(variables: readonly EnvVarView[]): string[] {
  return variables.map((variable) => variable.name);
}

/**
 * Les deux listes portent-elles les mêmes noms ?
 *
 * Sert à ne pas réécrire le brouillon à chaque chargement : `session.update`
 * persiste, et une écriture inutile déclencherait un cycle de rendu.
 */
export function sameNames(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) {
    return false;
  }
  const sorted = [...current].sort();
  const wanted = [...next].sort();
  return sorted.every((name, index) => name === wanted[index]);
}

/**
 * Cette variable vient-elle du moteur plutôt que d'un clic ?
 *
 * Vrai quand **aucune** des technologies qui la réclament n'a été choisie par
 * l'utilisateur : c'est le signe qu'une exigence a tiré une technologie
 * supplémentaire (`additions` de la résolution). L'écran le dit, pour que
 * l'utilisateur ne cherche pas d'où sort la variable.
 */
export function isEngineAdded(variable: EnvVarView, chosenIds: ReadonlySet<string>): boolean {
  if (variable.technologies.length === 0) {
    return false;
  }
  return variable.technologies.every((id) => !chosenIds.has(id));
}

/** Pourquoi un nom saisi à la main est refusé — ou `undefined` s'il passe. */
export type CustomEnvError = 'invalid' | 'duplicate';

/**
 * Vérifie un nom de variable ajouté à la main : la grammaire du manifest
 * (`ENV_NAME_PATTERN`), et pas de doublon avec ce qui est déjà listé — par la
 * stack ou par une saisie précédente.
 */
export function customEnvError(
  name: string,
  listed: readonly string[],
): CustomEnvError | undefined {
  if (!ENV_NAME_PATTERN.test(name) || name.length > 128) {
    return 'invalid';
  }
  return listed.includes(name) ? 'duplicate' : undefined;
}

/** Ajoute une variable au brouillon — la liste reste triée. */
export function withCustomEnv(draft: DraftState, name: string): DraftState {
  const current = draft.customEnv ?? [];
  if (current.includes(name)) {
    return draft;
  }
  return { ...draft, customEnv: [...current, name].sort() };
}

/** Retire une variable ajoutée à la main ; la liste vide disparaît du brouillon. */
export function withoutCustomEnv(draft: DraftState, name: string): DraftState {
  const rest = (draft.customEnv ?? []).filter((existing) => existing !== name);
  const { customEnv: _removed, ...others } = draft;
  return rest.length === 0 ? others : { ...others, customEnv: rest };
}

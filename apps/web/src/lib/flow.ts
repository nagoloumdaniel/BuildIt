import { PROJECT_NAME_PATTERN } from '@buildit/manifest';
import type { DraftState } from './draft';
import { offeredTargets, refusedTargets } from './targets';

/**
 * La machine à états du parcours (§3) les 14 écrans moins le menu d'accueil
 * et le Dependency Graph, qui est accessible **depuis** le Blueprint (§6.11)
 * et n'est donc pas une étape.
 *
 * Ce fichier est la seule définition de l'ordre des étapes : le brouillon s'y
 * réfère, la barre de progression s'y référera, et `nextStep` / `previousStep`
 * en découlent. Une liste recopiée ailleurs finirait par diverger.
 */

export const STEP_ORDER = [
  'create',
  'target',
  'type',
  'architecture',
  'stack',
  'capabilities',
  'env',
  'infrastructure',
  'blueprint',
  'preview',
  'generate',
  'report',
] as const;

export type StepId = (typeof STEP_ORDER)[number];

/** Le rang d'une étape, ou `-1` si elle n'appartient pas au parcours. */
export function stepIndex(step: StepId): number {
  return STEP_ORDER.indexOf(step);
}

export function nextStep(step: StepId): StepId | null {
  const index = stepIndex(step);
  return index < 0 ? null : at(index + 1);
}

export function previousStep(step: StepId): StepId | null {
  const index = stepIndex(step);
  return index < 0 ? null : at(index - 1);
}

/** L'étape à ce rang, ou `null` : c'est là que vivent les bornes du parcours. */
function at(index: number): StepId | null {
  const step = STEP_ORDER[index];
  return step === undefined ? null : step;
}

/**
 * **Pourquoi** on ne peut pas avancer la phrase que l'écran affiche.
 *
 * Une seule source de vérité : `canAdvance` en découle. Deux fonctions
 * séparées finiraient par se contredire, et l'écran montrerait « Continuer »
 * actif à côté d'un message d'erreur (§12 : un refus dit pourquoi).
 */
export function blockedReason(draft: DraftState): string | undefined {
  switch (draft.step) {
    case 'create':
      return PROJECT_NAME_PATTERN.test(draft.name)
        ? undefined
        : 'Choisissez un nom : minuscules, chiffres, points, tirets ou soulignés.';
    case 'target': {
      // §6.3 : au moins une cible. Puis §7.9, §7.10 : une cible sans framework
      // au catalogue ne peut pas produire de manifest (§10) le refus est dit
      // ici, avec sa raison, plutôt que découvert trois écrans plus loin sur un
      // champ absent. Un brouillon hérité ou un lien de partage peut encore la
      // porter : l'écran Target, lui, ne la propose plus.
      if (draft.targets.length === 0) {
        return 'Choisissez au moins une plateforme.';
      }
      const refused = refusedTargets(draft.targets);
      if (refused.length === 0) {
        return undefined;
      }
      const plural = refused.length > 1;
      return `Le catalogue n’offre aucun framework pour ${refused.join(', ')} : ${
        plural ? 'ces plateformes ne peuvent' : 'cette plateforme ne peut'
      } pas produire de manifest (§10). Plateformes proposées : ${offeredTargets().join(', ')}.`;
    }
    case 'stack':
      if (draft.resolution === undefined) {
        return 'La compatibilité de la sélection n’a pas encore été vérifiée.';
      }
      // `experimental` passe : c'est un avertissement, pas un refus (§12).
      return draft.resolution.issues.length === 0 ? undefined : draft.resolution.issues.join(' ');
    default:
      // Aucun bloquant écrit dans le §6 pour ces écrans choix, pas oubli.
      return undefined;
  }
}

export function canAdvance(draft: DraftState): boolean {
  return blockedReason(draft) === undefined;
}

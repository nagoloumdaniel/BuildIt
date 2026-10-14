import { PROJECT_NAME_PATTERN } from '@buildit/manifest';
import type { DraftState } from './draft';
import type { Messages } from './i18n/messages';
import { missingRequirements, requirementText } from './requirements';
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
 *
 * Les phrases viennent du dictionnaire (`t`) : c'est le seul endroit du
 * parcours où un refus est écrit pour un humain, et il doit l'être dans sa
 * langue. Les refus du **moteur**, eux, passent tels quels : ils sont les mêmes
 * dans un terminal.
 */
export function blockedReason(draft: DraftState, t: Messages): string | undefined {
  switch (draft.step) {
    case 'create':
      return PROJECT_NAME_PATTERN.test(draft.name) ? undefined : t.journey.blocked.name;
    case 'target': {
      // §6.3 : au moins une cible. Puis §7.9, §7.10 : une cible sans framework
      // au catalogue ne peut pas produire de manifest (§10) le refus est dit
      // ici, avec sa raison, plutôt que découvert trois écrans plus loin sur un
      // champ absent. Un brouillon hérité ou un lien de partage peut encore la
      // porter : l'écran Target, lui, ne la propose plus.
      if (draft.targets.length === 0) {
        return t.journey.blocked.platform;
      }
      const refused = refusedTargets(draft.targets);
      if (refused.length === 0) {
        return undefined;
      }
      return t.journey.blocked.platformRefused(
        refused.join(', '),
        offeredTargets().join(', '),
        refused.length > 1,
      );
    }
    case 'stack':
      if (draft.resolution === undefined) {
        return t.journey.blocked.compatibility;
      }
      // `experimental` passe : c'est un avertissement, pas un refus (§12).
      if (draft.resolution.issues.length > 0) {
        return draft.resolution.issues.join(' ');
      }
      return requirementBlocker(draft, t);
    default:
      // Les autres écrans n'ont pas de refus écrit, mais ils héritent des
      // minimums des écrans déjà passés : un accès direct à une adresse ne doit
      // pas contourner ce qu'un écran précédent exige.
      return requirementBlocker(draft, t);
  }
}

/**
 * Les minimums non satisfaits, jusqu'à l'écran affiché.
 *
 * Un besoin d'un écran **suivant** ne bloque pas celui-ci : la file d'attente
 * d'une architecture événementielle se choisit à l'écran Capacités, pas au
 * Stack Builder. L'ordre des étapes est celui de `STEP_ORDER`, une seule fois.
 */
function requirementBlocker(draft: DraftState, t: Messages): string | undefined {
  const current = stepIndex(draft.step);
  const missing = missingRequirements(draft).filter((need) => stepIndex(need.screen) <= current);
  if (missing.length === 0) {
    return undefined;
  }
  return missing.map((need) => requirementText(t, need)).join(' ');
}

export function canAdvance(draft: DraftState, t: Messages): boolean {
  return blockedReason(draft, t) === undefined;
}

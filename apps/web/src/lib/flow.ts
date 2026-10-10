import { PROJECT_NAME_PATTERN } from '@project-factory/manifest';
import type { DraftState } from './draft';

/**
 * La machine à états du parcours (§3) — les 14 écrans moins le menu d'accueil
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
 * Les conditions bloquantes du §6, étape par étape.
 *
 * Seules trois étapes en ont une dans le cahier des charges. Les autres
 * passent : c'est un choix écrit, pas un oubli — un écran qui n'a rien à
 * exiger ne doit pas retenir l'utilisateur.
 */
export function canAdvance(draft: DraftState): boolean {
  switch (draft.step) {
    case 'create':
      return PROJECT_NAME_PATTERN.test(draft.name);
    case 'target':
      // §6.3 : au moins une cible.
      return draft.targets.length > 0;
    case 'stack':
      // La résolution doit avoir eu lieu **et** ne rien avoir trouvé à redire.
      // `experimental` passe : c'est un avertissement, pas un refus (§12).
      return draft.resolution !== undefined && draft.resolution.issues.length === 0;
    default:
      return true;
  }
}

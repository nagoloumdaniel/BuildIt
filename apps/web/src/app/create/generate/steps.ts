/**
 * Generation Progress (§6.13) et rapport (§6.14), hors du rendu.
 *
 * Une Server Action ne diffuse pas ses étapes : elle rend son résultat d'un
 * seul coup. L'écran ne peut donc pas prétendre à un avancement temps réel ; il
 * montre ce qui est **en attente**, puis les étapes réellement terminées que
 * l'action renvoie. Ces fonctions traduisent ce que le moteur a fait — jamais
 * ce qu'il n'a pas fait, et dans la langue courante : les libellés des étapes
 * et le poids viennent du dictionnaire, pas d'ici.
 */

import { formatBytes } from '../../../lib/projects';

/**
 * Le poids écrit, dans la langue courante : « 1,5 ko » en français, « 1.5 kB »
 * en anglais. Ré-exporté de `lib/projects.ts` — une seule table d'unités pour
 * tout le configurateur, donc deux écrans ne peuvent pas diverger.
 */
export { formatBytes };

/**
 * Ce que `generateProjectAction` exécute réellement.
 *
 * `generateProject` n'installe rien et n'initialise rien par défaut : le moteur
 * ne lance aucune commande qu'on ne lui a pas demandée. L'écran n'annonce donc
 * ni installation, ni Git, ni validation.
 */
export const GENERATION_STEPS: readonly string[] = ['plan', 'write'];

/**
 * Le nom d'une étape du §22, dans la langue courante.
 *
 * Table **ouverte** : `generateProjectAction` peut renvoyer une étape qu'on
 * n'avait pas prévue (le moteur évolue), et `labels` peut ne pas la connaître —
 * elle est alors montrée telle quelle plutôt que de disparaître.
 */
export function stepLabel(step: string, labels: Readonly<Record<string, string>>): string {
  return labels[step] ?? step;
}

export interface ProgressStep {
  readonly step: string;
  readonly label: string;
  readonly done: boolean;
}

/**
 * L'avancement : les étapes attendues, marquées faites ou non, plus celles que
 * le moteur a terminées sans qu'on les ait annoncées.
 */
export function progressStates(
  completed: readonly string[],
  expected: readonly string[],
  labels: Readonly<Record<string, string>>,
): readonly ProgressStep[] {
  const done = new Set(completed);
  const steps = [...expected];
  for (const step of completed) {
    if (!steps.includes(step)) {
      steps.push(step);
    }
  }
  return steps.map((step) => ({ step, label: stepLabel(step, labels), done: done.has(step) }));
}

/**
 * Le dossier cible, celui qu'on montre **avant** d'écrire.
 *
 * Il n'est pas construit avec `node:path` : ce code s'exécute aussi dans le
 * navigateur. Le nom du projet ne peut pas contenir de séparateur
 * (`PROJECT_NAME_PATTERN`), donc concaténer est sûr.
 */
export function targetDirectory(root: string, name: string): string {
  if (root === '') {
    return name;
  }
  const separator = root.endsWith('/') || root.endsWith('\\') ? '' : '/';
  return `${root}${separator}${name}`;
}

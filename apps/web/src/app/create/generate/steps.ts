/**
 * Generation Progress (§6.13) et rapport (§6.14), hors du rendu.
 *
 * Une Server Action ne diffuse pas ses étapes : elle rend son résultat d'un
 * seul coup. L'écran ne peut donc pas prétendre à un avancement temps réel ; il
 * montre ce qui est **en attente**, puis les étapes réellement terminées que
 * l'action renvoie. Ces fonctions traduisent ce que le moteur a fait — jamais
 * ce qu'il n'a pas fait.
 */

/**
 * Les étapes du pipeline du §22, dites en clair.
 *
 * Table **ouverte** : `generateProjectAction` peut renvoyer une étape qu'on
 * n'avait pas prévue (le moteur évolue), et `stepLabel` la montre alors telle
 * quelle plutôt que de la masquer.
 */
export const STEP_LABELS: Readonly<Record<string, string>> = {
  plan: 'Planification',
  write: 'Écriture des fichiers',
  install: 'Installation des dépendances',
  git: 'Dépôt Git',
  validate: 'Validation',
};

/**
 * Ce que `generateProjectAction` exécute réellement.
 *
 * `generateProject` n'installe rien et n'initialise rien par défaut : le moteur
 * ne lance aucune commande qu'on ne lui a pas demandée. L'écran n'annonce donc
 * ni installation, ni Git, ni validation.
 */
export const GENERATION_STEPS: readonly string[] = ['plan', 'write'];

export function stepLabel(step: string): string {
  return STEP_LABELS[step] ?? step;
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
): readonly ProgressStep[] {
  const done = new Set(completed);
  const steps = [...expected];
  for (const step of completed) {
    if (!steps.includes(step)) {
      steps.push(step);
    }
  }
  return steps.map((step) => ({ step, label: stepLabel(step), done: done.has(step) }));
}

const UNITS = ['o', 'ko', 'Mo', 'Go'] as const;

/** Le poids écrit, en français : 1 536 octets → « 1,5 ko ». */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 o';
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text = unit === 0 ? String(Math.round(value)) : value.toFixed(1).replace('.', ',');
  return `${text} ${UNITS[unit] ?? 'o'}`;
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

import type { GenerationView } from '../../actions';

/**
 * Le rapport de génération (§6.14) transmis de l'écran Generation à l'écran
 * Report.
 *
 * Le rapport vit dans `sessionStorage` : il est donc **non fiable** à la
 * relecture, exactement comme le brouillon. `loadReport` revalide champ par
 * champ et rend `null` plutôt qu'une forme à moitié remplie — l'écran dit
 * alors « aucun rapport », ce qui est vrai.
 *
 * `GenerationView` est un type importé de `actions.ts` : contrat unique, aucune
 * copie de la forme du rapport.
 */

/** Clé de session : le rapport ne survit pas à l'onglet, et c'est voulu. */
export const REPORT_STORAGE_KEY = 'pf-generation-report';

export type GenerationReport = GenerationView;

/** Les seules chaînes d'un tableau relu — le reste est écarté, sans lever. */
function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

export function saveReport(storage: Storage | null, report: GenerationReport): void {
  try {
    storage?.setItem(REPORT_STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Quota plein ou stockage refusé : le rapport reste affiché à l'écran, il
    // ne sera simplement pas repris par l'onglet suivant.
  }
}

export function loadReport(storage: Storage | null): GenerationReport | null {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(REPORT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const { ok, directory, bytes, files, warnings, steps, issues } = parsed as Record<
      string,
      unknown
    >;
    if (typeof ok !== 'boolean' || typeof directory !== 'string' || typeof bytes !== 'number') {
      return null;
    }
    return {
      ok,
      directory,
      bytes,
      files: strings(files),
      warnings: strings(warnings),
      steps: strings(steps),
      issues: strings(issues),
    };
  } catch {
    return null;
  }
}

/**
 * Le `sessionStorage` du navigateur, ou `null` quand il est refusé.
 *
 * Y accéder peut lever (cookies bloqués, iframe cloisonnée) : le rapport est un
 * confort, il ne doit pas empêcher la page de s'afficher.
 */
export function browserSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

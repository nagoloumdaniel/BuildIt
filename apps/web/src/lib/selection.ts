import type { DraftState } from './draft';
import { type InfraBooleans, infraIds } from './infrastructure-ids';

/**
 * La **sélection** envoyée au moteur de compatibilité, en un seul endroit.
 *
 * Le brouillon range ses choix dans trois listes (`technologies`,
 * `capabilities`) et deux booléens (`infra`), mais le moteur ne connaît qu'une
 * sélection de technologies : c'est déjà la règle de `chosenIds` dans
 * `lib/draft-to-manifest.ts`. Trois écrans recopiaient cette union (Stack,
 * Capacités, Infrastructure) et le modèle d'environnement une quatrième fois :
 * quatre copies, donc quatre occasions d'oublier une liste. Elles convergent
 * ici.
 *
 * L'union est **triée et dédupliquée** : deux ordres de clics doivent donner la
 * même vérification, et un choix posé à la fois comme capacité et comme
 * technologie ne doit pas compter deux fois.
 */

/** Ce que le moteur attend pour vérifier une sélection. */
export interface EngineSelection {
  readonly targets: readonly string[];
  readonly technologies: readonly string[];
}

/** Les listes du brouillon dont la sélection est l'union. */
export interface SelectionParts {
  readonly targets: readonly string[];
  readonly technologies: readonly string[];
  readonly capabilities: readonly string[];
  readonly infra: InfraBooleans;
}

/**
 * L'union, à partir des listes brutes.
 *
 * Forme « pièces détachées » pour que les écrans puissent la mémoïser : mémoriser
 * `selectionOf(draft)` sur le brouillon entier relancerait le chargement à
 * chaque écriture de `resolution`, qui est justement ce que la mémoïsation doit
 * éviter.
 */
export function selectionFor(parts: SelectionParts): EngineSelection {
  return {
    targets: [...parts.targets],
    technologies: [
      ...new Set([...parts.technologies, ...parts.capabilities, ...infraIds(parts.infra)]),
    ].sort(),
  };
}

export function selectionOf(draft: DraftState): EngineSelection {
  return selectionFor(draft);
}

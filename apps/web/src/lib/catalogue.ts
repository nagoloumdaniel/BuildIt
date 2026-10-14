import { loadCatalogue, type Registry } from '@buildit/registry';

/**
 * Le catalogue officiel, chargé **une fois** pour toute l'application.
 *
 * Trois modules le lisaient chacun de leur côté (`lib/targets.ts`,
 * `lib/draft-to-manifest.ts`, et maintenant `lib/requirements.ts`) : trois
 * caches pour la même donnée, donc trois occasions de diverger sur la
 * politique d'échec. Elle vit ici, une fois.
 *
 * Un catalogue illisible est un artefact de construction cassé, pas une erreur
 * de brouillon : on lève plutôt que de rendre une décision partielle, qui
 * aurait l'air juste.
 */

let loaded: Registry | undefined;

export function catalogue(): Registry {
  if (loaded === undefined) {
    const result = loadCatalogue();
    if (!result.ok) {
      throw new Error(
        `Catalogue du registry illisible : ${result.issues.map((issue) => issue.code).join(', ')}.`,
      );
    }
    loaded = result.value;
  }
  return loaded;
}

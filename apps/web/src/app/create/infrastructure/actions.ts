'use server';

import type { Category } from '@buildit/registry';
import type { OptionView } from '../../../lib/engine';
import { CI_ID, DOCKER_ID } from '../../../lib/infrastructure-ids';
import { loadOptionsAction } from '../../actions';
import { categoriesWithRole } from '../capabilities/capabilities';

/** Les deux raccourcis qui ont leur propre carte, donc exclus des listes. */
const shortcuts: ReadonlySet<string> = new Set([DOCKER_ID, CI_ID]);

/** Une catégorie d'infrastructure et ses options, telles que l'écran les rend. */
export interface InfrastructureBlock {
  readonly category: Category;
  readonly options: readonly OptionView[];
}

/**
 * Le chargement des **six** catégories d'infrastructure (§6.9), en un aller-retour.
 *
 * L'écran ne demandait que `hosting` ; les cinq autres catégories
 * (`package-manager`, `monorepo`, `containers`, `dev-environment`, `ci-cd`)
 * n'avaient aucun écran dédié, alors que `SCREEN_ROLE` les lui attribue. Elles
 * s'affichent maintenant ici, chacune filtrée par la même vérification de
 * compatibilité que le Stack Builder : c'est ce qui « combine » enfin les
 * possibilités de la pile avec celles de l'infrastructure.
 *
 * La liste des catégories vient de `categoriesWithRole('infrastructure')`,
 * jamais d'une liste écrite ici : une catégorie ajoutée au registry tombe dans
 * cet écran sans qu'on y touche.
 *
 * Un seul aller-retour, comme au Stack Builder : 6 Server Actions concurrentes
 * coûteraient 6 transports là où le serveur les exécute de toute façon en
 * série (mesure du §8bis).
 */
export async function loadInfrastructureBlocksAction(
  selection: unknown,
): Promise<InfrastructureBlock[]> {
  const loaded = await Promise.all(
    categoriesWithRole('infrastructure').map(async (category) => ({
      category,
      options: await loadOptionsAction(category, selection),
    })),
  );

  // Docker et l'intégration continue ont leurs deux cartes à part : leurs
  // identifiants sortent des listes **ici**, pas seulement à l'écran, pour
  // qu'aucun appelant ne les voie deux fois. Une catégorie vidée par ce filtre
  // disparaît au lieu de s'afficher vide.
  return loaded
    .map((block) => ({
      category: block.category,
      options: block.options.filter((option) => !shortcuts.has(option.id)),
    }))
    .filter((block) => block.options.length > 0);
}

'use server';

import type { Category } from '@buildit/registry';
import type { OptionView } from '../../../lib/engine';
import { loadOptionsAction } from '../../actions';
import { categoriesWithRole } from '../capabilities/capabilities';

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

  // Une catégorie sans fiche ne s'affiche pas : elle ne serait qu'un cul-de-sac.
  return loaded.filter((block) => block.options.length > 0);
}

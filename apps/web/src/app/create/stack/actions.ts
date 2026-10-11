'use server';

import { CATEGORIES } from '@buildit/registry';
import { loadOptionsAction } from '../../actions';
import type { CategoryBlock } from './stack-view';

/**
 * Le chargement unique du Stack Builder (§8bis.2).
 *
 * La page appelait `loadOptionsAction` **une fois par catégorie** : 37 Server
 * Actions par rendu, et 76 requêtes par visite (l'écran charge aussi au
 * branchement du brouillon persisté). Mesuré sur le build de production
 * (`next start`, 8 rechargements à chaud, 2026-10-11) : les 37 actions
 * concurrentes coûtent ~325 ms de transport isolé, contre ~9 ms pour une seule,
 * parce que le serveur les exécute **en série**. La mesure est reproductible par
 * les scripts décrits dans le rapport `docs/superpowers/specs/2026-10-11-phase8bis-chargement-stack-builder.md`
 * (hors de l'arbre de travail : un dossier de mesure y avait fait échouer le lint).
 *
 * Le travail du moteur, lui, n'est pas le problème (~1,7 ms pour les 37
 * catégories). Ce qui est supprimé ici, c'est 36 allers-retours, pas du calcul.
 *
 * Rien n'est décidé ici : l'action ne fait que rendre le même travail que la
 * page faisait, et `actions.ts` reste le seul fichier qui parle au moteur — ce
 * module-ci est une action, pas un adaptateur. Le catalogue reste hors du bundle
 * client : `actions.ts` importe `lib/engine.ts`, qui porte `server-only`.
 */
export async function loadStackBlocksAction(selection: unknown): Promise<CategoryBlock[]> {
  // `Promise.all` garde l'ordre de `CATEGORIES` et laisse le moteur travailler
  // en parallèle — c'était déjà la forme du chargement de la page.
  const loaded = await Promise.all(
    CATEGORIES.map(async (category) => ({
      category,
      options: await loadOptionsAction(category, selection),
    })),
  );

  // Une catégorie sans fiche ne s'affiche pas : elle ne serait qu'un cul-de-sac.
  return loaded.filter((block) => block.options.length > 0);
}

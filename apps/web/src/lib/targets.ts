import { TARGETS, type Target } from '@buildit/manifest';
import { loadCatalogue, type RegistryEntry, targetsWithoutFramework } from '@buildit/registry';

/**
 * Les cibles que l'écran Target propose et la raison de celles qu'il ne
 * propose pas (§7.9, §7.10, §23).
 *
 * Le §10 décrit chaque cible par une **application** : `web` par `frontend`,
 * `mobile` par `mobile`, `desktop` par `desktop`, `api` par `backend` et
 * chacune exige un `framework`. Un brouillon qui choisit une cible sans
 * framework ne peut donc pas produire de manifest : il échouait trois écrans
 * plus loin, sur un champ manquant, sans que l'utilisateur sache pourquoi.
 *
 * L'écran ne propose plus que ce que le catalogue peut honorer. La décision
 * n'est **pas** une liste d'interdits écrite ici : elle se lit dans le
 * catalogue (`targetsWithoutFramework`), donc le jour où une fiche `expo` vise
 * `mobile`, l'écran la propose sans qu'on touche à ce fichier.
 *
 * Le §10 dit quelles cibles exigent une application ; le catalogue dit ce qu'il
 * contient. Les deux se croisent ici, une seule fois.
 */

/** L'application qu'une cible implique dans le manifest (§10). */
export type AppKey = 'frontend' | 'mobile' | 'desktop' | 'backend';

/**
 * La table des applications du §10. Une seule copie : `draft-to-manifest.ts`
 * la lit d'ici, il ne la réécrit pas.
 */
export const APP_TARGET: Readonly<Record<AppKey, Target>> = {
  frontend: 'web',
  mobile: 'mobile',
  desktop: 'desktop',
  backend: 'api',
};

/** Les cibles que le §10 décrit par une application : elles exigent un framework. */
const APPLICATION_TARGETS: ReadonlySet<Target> = new Set(Object.values(APP_TARGET));

let entries: readonly RegistryEntry[] | undefined;

/**
 * Le catalogue officiel, chargé une fois.
 *
 * Même politique que `draft-to-manifest.ts` : un catalogue illisible est un
 * artefact de construction cassé, pas une erreur de brouillon. On lève plutôt
 * que de proposer une cible sur une information tronquée.
 */
function catalogueEntries(): readonly RegistryEntry[] {
  if (entries === undefined) {
    const result = loadCatalogue();
    if (!result.ok) {
      throw new Error(
        `Catalogue du registry illisible : ${result.issues.map((issue) => issue.code).join(', ')}.`,
      );
    }
    entries = result.value.entries();
  }
  return entries;
}

let offered: readonly Target[] | undefined;

/**
 * Les cibles que l'écran Target propose : celles que le manifest ne décrit pas
 * par une application (rien à exiger) ou pour lesquelles le catalogue offre un
 * framework. L'ordre est celui de `TARGETS`.
 */
export function offeredTargets(): readonly Target[] {
  if (offered === undefined) {
    const missing = new Set(targetsWithoutFramework(catalogueEntries()));
    offered = TARGETS.filter((target) => !APPLICATION_TARGETS.has(target) || !missing.has(target));
  }
  return offered;
}

/**
 * Les cibles choisies que l'écran ne propose plus un brouillon d'une version
 * précédente, ou un manifest importé d'un lien de partage (§20). Le refus est
 * nommé ici pour que l'écran dise **pourquoi** avant d'aller plus loin (§12).
 */
export function refusedTargets(selected: readonly string[]): readonly string[] {
  const proposed = new Set<string>(offeredTargets());
  return selected.filter((target) => !proposed.has(target));
}

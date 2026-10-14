/**
 * Qui écrit le projet quand l'utilisateur choisit un dossier.
 *
 * La décision se prend sur **deux faits indépendants** :
 * - `local` : le serveur qui répond tourne-t-il sur la machine de l'utilisateur ?
 *   (`canOpenNativePickerAction`, adossée à `isHostedEnvironment`) ;
 * - `browserWrite` : le navigateur courant sait-il écrire dans un dossier ?
 *
 * Le sélecteur **serveur** ne dépend jamais du second : en local, BuildIt ouvre
 * l'explorateur de la machine quel que soit le navigateur, y compris ceux qui
 * n'exposent pas la File System Access API. C'est ce qui rend « choisir un
 * dossier et installer » possible partout en local.
 *
 * Ce module reste **pur et sans import serveur** : `project-export.tsx` est un
 * composant client, et importer `output-destination.ts` (qui lit `node:fs`)
 * ferait échouer la compilation navigateur. `output-destination.ts` le
 * réexporte pour que le chemin d'import reste celui de la destination.
 */

export type FolderOutputMode =
  /** Le serveur n'a pas encore répondu : la carte dossier n'est pas encore montrée. */
  | 'pending'
  /** Local : explorateur natif côté serveur, écriture **et** installation. */
  | 'native'
  /** Hébergé, navigateur capable d'écrire : il écrit lui-même, sans installation. */
  | 'browser'
  /** Hébergé, navigateur incapable d'écrire : le ZIP est la seule sortie. */
  | 'zip';

export function folderOutputMode(local: boolean | null, browserWrite: boolean): FolderOutputMode {
  if (local === null) {
    return 'pending';
  }
  if (local) {
    return 'native';
  }
  return browserWrite ? 'browser' : 'zip';
}

import { destinationState, resolveAbsoluteDestination } from '../../clone/destination';

/**
 * Où un projet généré atterrit quand l'utilisateur choisit le dossier.
 *
 * Le parent vient de l'explorateur de la machine (`pickFolderAction`), donc du
 * navigateur : il est revalidé ici comme n'importe quelle entrée. La règle est
 * celle du clone (`resolveAbsoluteDestination`, `destinationState`) : un parent
 * absolu, lisible, et un sous-dossier au nom du projet qui n'existe pas encore
 * ou qui est vide. Un dossier non vide est refusé : la génération n'écrase
 * jamais ce que l'utilisateur avait mis là.
 *
 * Utilisée deux fois, avec la même réponse : par l'action qui prévient dès le
 * choix du dossier, et par la route qui écrit. La seconde ne fait pas
 * confiance à la première, le disque a pu changer entre les deux.
 */

export type OutputDestination =
  | { readonly ok: true; readonly directory: string }
  | { readonly ok: false; readonly directory: string; readonly issues: readonly string[] };

export const HOSTED_FOLDER_REFUSAL =
  'BuildIt ne peut pas écrire sur votre machine depuis le web. Téléchargez le ZIP, ou lancez BuildIt en local avec pf web.';

export async function checkOutputDestination(
  parent: unknown,
  name: unknown,
  hosted: boolean,
): Promise<OutputDestination> {
  if (hosted) {
    return { ok: false, directory: '', issues: [HOSTED_FOLDER_REFUSAL] };
  }
  const destination = await resolveAbsoluteDestination(parent, name);
  if (!destination.ok) {
    return { ok: false, directory: '', issues: destination.issues };
  }
  const directory = destination.value.directory;
  if ((await destinationState(directory)) === 'taken') {
    return {
      ok: false,
      directory,
      issues: [
        `Le dossier ${directory} existe déjà et n’est pas vide. Rien n’a été écrit : choisissez un autre dossier parent, ou renommez le projet.`,
      ],
    };
  }
  return { ok: true, directory };
}

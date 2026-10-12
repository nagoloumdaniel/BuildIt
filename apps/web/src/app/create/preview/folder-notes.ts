/**
 * Une phrase par dossier racine (§6.12).
 *
 * `tree.ts` dit explicitement qu'un nom reste opaque — il ne l'interprète pas.
 * Ce module l'interprète, mais à part, et seulement pour les noms que ce
 * générateur produit vraiment (grep sur `packages/generator/templates` et
 * `monorepo.ts`) : jamais une liste générique recopiée d'ailleurs, et jamais
 * plus profond que la racine — un `src/lib` d'un preset n'a pas le même sens
 * qu'un `src/lib` d'un autre.
 *
 * Les phrases viennent du dictionnaire (`build.preview.folderNotes`), dans la
 * langue courante. Un dossier absent de la table n'affiche rien : silencieux,
 * pas une excuse inventée.
 */
export function rootFolderNote(
  name: string,
  notes: Readonly<Record<string, string>>,
): string | undefined {
  return notes[name];
}

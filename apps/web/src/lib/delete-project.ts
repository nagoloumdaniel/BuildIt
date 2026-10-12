/**
 * Supprimer un projet généré — la règle, hors Node et hors React.
 *
 * Une Server Action qui supprime récursivement le dossier que le navigateur
 * lui désigne est une suppression de fichier arbitraire : le JSON vient du
 * client, donc n'importe qui peut l'écrire à la main. La règle tenue ici est
 * donc volontairement étroite, et elle est la **même** que celle de l'écriture
 * (`generateProjectAction`) : le configurateur écrit dans `~/buildit/<nom>`,
 * il ne supprime rien d'autre.
 *
 * Trois conditions, toutes nécessaires :
 * - le chemin est un **enfant direct** du dossier de travail — pas le dossier
 *   de travail lui-même, pas un petit-enfant, pas un chemin qui remonte ;
 * - il ne contient ni `..` ni segment vide une fois résolu ;
 * - il porte un nom, donc le dossier existe en tant que nom (l'existence
 *   réelle est vérifiée par l'appelant, qui a accès au disque).
 *
 * Le module ne touche pas à `fs` : il se teste sans écrire un seul fichier.
 */

export type DeleteRefusal =
  | 'hosted'
  | 'empty'
  | 'notInWorkspace'
  | 'isWorkspace'
  | 'notADirectChild';

export interface DeletionTarget {
  readonly ok: true;
  /** Le chemin absolu, normalisé, sûr à supprimer. */
  readonly directory: string;
}

export interface DeletionRefused {
  readonly ok: false;
  readonly reason: DeleteRefusal;
}

/**
 * Les segments d'un chemin, quelles que soient ses barres.
 *
 * Deux découpages successifs plutôt qu'une classe de caractères : une
 * expression régulière mêlant `\` et `/` se fait « simplifier » par les
 * outils de formatage, et perdre la barre inverse rendait la comparaison
 * aveugle sur Windows — un chemin entier devenait un seul segment.
 */
function segments(path: string): readonly string[] {
  return path
    .split('\\')
    .flatMap((part) => part.split('/'))
    .filter((part) => part !== '');
}

/**
 * Le dossier est-il supprimable, et sous quelle forme ?
 *
 * `workspaceRoot` est le dossier de travail **résolu** par le serveur : il ne
 * vient jamais du client. La comparaison est faite sur les segments plutôt que
 * sur les chaînes, parce qu'un `C:\Users\x\buildit` et un
 * `C:/Users/x/buildit/` désignent le même dossier et qu'un `startsWith` sur
 * les chaînes laisserait passer `~/buildit-autre`.
 */
export function deletionTarget(
  directory: unknown,
  workspaceRoot: string,
  hosted: boolean,
): DeletionTarget | DeletionRefused {
  if (hosted) {
    return { ok: false, reason: 'hosted' };
  }
  if (typeof directory !== 'string' || directory.trim() === '') {
    return { ok: false, reason: 'empty' };
  }

  const target = segments(directory);
  const root = segments(workspaceRoot);

  if (target.some((part) => part === '..' || part === '.')) {
    return { ok: false, reason: 'notInWorkspace' };
  }
  if (target.length === root.length) {
    return { ok: false, reason: 'isWorkspace' };
  }
  if (target.length !== root.length + 1) {
    return { ok: false, reason: 'notADirectChild' };
  }
  // La comparaison ignore la casse : Windows ne la distingue pas, et exiger
  // `C:\Users` quand le navigateur renvoie `c:\users` refuserait un dossier
  // parfaitement légitime.
  const sameRoot = root.every(
    (part, index) => part.toLowerCase() === (target[index] ?? '').toLowerCase(),
  );
  if (!sameRoot) {
    return { ok: false, reason: 'notInWorkspace' };
  }

  return { ok: true, directory };
}

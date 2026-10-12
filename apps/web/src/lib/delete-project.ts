/**
 * Supprimer un projet généré — la règle, hors Node et hors React.
 *
 * Une Server Action qui supprime récursivement le dossier que le navigateur
 * lui désigne est une suppression de fichier arbitraire : le JSON vient du
 * client, donc n'importe qui peut l'écrire à la main. La règle tenue ici est
 * donc volontairement étroite, et elle suit l'écriture : le configurateur ne
 * supprime que ce qu'il a lui-même écrit.
 *
 * Après les refus communs (mode hébergé, chemin vide, segment `..` ou `.`,
 * dossier de travail lui-même), deux façons d'être accepté :
 * - le chemin est un **enfant direct** du dossier de travail, là où
 *   `generateProjectAction` écrit `~/buildit/<nom>` ;
 * - ou il figure au **registre** des dossiers que BuildIt a générés ailleurs
 *   (`lib/output-registry.ts`). Depuis que l'utilisateur choisit le dossier
 *   parent dans l'explorateur, un projet peut vivre n'importe où, et seul le
 *   serveur, qui l'a écrit, peut en témoigner : le registre vit sur son disque,
 *   le navigateur ne peut pas y ajouter une ligne.
 *
 * L'existence réelle du dossier est vérifiée par l'appelant, qui a accès au
 * disque. Le module ne touche pas à `fs` : il se teste sans écrire un seul
 * fichier.
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
 * Deux suites de segments désignent-elles le même dossier ?
 *
 * La comparaison ignore la casse : Windows ne la distingue pas, et exiger
 * `C:\Users` quand le navigateur renvoie `c:\users` refuserait un dossier
 * parfaitement légitime.
 */
function sameSegments(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((part, index) => part.toLowerCase() === (right[index] ?? '').toLowerCase())
  );
}

/** Vrai quand `a` et `b` désignent le même dossier, barres et casse mises à part. */
export function sameDirectory(a: string, b: string): boolean {
  return sameSegments(segments(a), segments(b));
}

/**
 * Le dossier est-il supprimable, et sous quelle forme ?
 *
 * `workspaceRoot` est le dossier de travail **résolu** par le serveur : il ne
 * vient jamais du client. `registered` est le registre relu par le serveur sur
 * son propre disque, jamais une liste envoyée par le navigateur. La comparaison
 * est faite sur les segments plutôt que sur les chaînes, parce qu'un
 * `C:\Users\x\buildit` et un `C:/Users/x/buildit/` désignent le même dossier et
 * qu'un `startsWith` sur les chaînes laisserait passer `~/buildit-autre`.
 */
export function deletionTarget(
  directory: unknown,
  workspaceRoot: string,
  hosted: boolean,
  registered: readonly string[] = [],
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
  if (sameSegments(target, root)) {
    return { ok: false, reason: 'isWorkspace' };
  }
  // Le registre passe avant la règle de l'enfant direct, mais jamais pour la
  // racine d'un disque : un `C:\` ou un `/` ne peut pas avoir été généré, et
  // un registre altéré à la main ne doit pas suffire à le vider.
  if (target.length >= 2 && registered.some((entry) => sameSegments(segments(entry), target))) {
    return { ok: true, directory };
  }
  const inside = target.length > root.length && sameSegments(root, target.slice(0, root.length));
  if (!inside) {
    return { ok: false, reason: 'notInWorkspace' };
  }
  if (target.length !== root.length + 1) {
    return { ok: false, reason: 'notADirectChild' };
  }

  return { ok: true, directory };
}

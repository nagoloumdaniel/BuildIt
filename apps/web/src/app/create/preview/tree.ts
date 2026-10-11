/**
 * Chemins → arbre (§6.12).
 *
 * L'aperçu ne reçoit du moteur qu'une **liste de chemins** (`previewManifestAction`
 * rend `{ files, warnings }`, un dry-run du §22). L'arborescence affichée est
 * donc une pure dérivation : aucune écriture, aucun contenu inventé, et un ordre
 * qui ne dépend pas de l'ordre d'arrivée du plan — sinon deux aperçus du même
 * projet se ressembleraient sans être identiques.
 *
 * Les noms restent opaques ici : un segment est un segment. Le fichier n'est pas
 * interprété, il est rangé.
 */

export interface TreeNode {
  /** Le segment, tel quel — c'est ce qui s'affiche. */
  readonly name: string;
  /** Le chemin complet depuis la racine, séparateur `/`. */
  readonly path: string;
  readonly kind: 'file' | 'directory';
  /** Vide pour un fichier. Trié : dossiers d'abord, puis par nom. */
  readonly children: readonly TreeNode[];
}

/** Nœud de travail : un `Map` donne l'identité par nom sans doublon. */
interface MutableNode {
  readonly name: string;
  readonly path: string;
  kind: 'file' | 'directory';
  readonly children: Map<string, MutableNode>;
}

/**
 * Les segments utiles d'un chemin.
 *
 * `\` est accepté comme séparateur : un plan venu d'une machine Windows ne doit
 * pas produire un fichier nommé `src\app\page.tsx`. Les segments vides (`//`) et
 * les `.` sont ignorés — ce ne sont pas des noms de fichiers.
 */
function segmentsOf(path: string): string[] {
  return path
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
}

/** Dossiers d'abord, puis par nom : l'ordre est une décision, pas un hasard. */
function compare(a: MutableNode, b: MutableNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'fr');
}

function toNodes(level: ReadonlyMap<string, MutableNode>): readonly TreeNode[] {
  return [...level.values()].sort(compare).map((node) => ({
    name: node.name,
    path: node.path,
    kind: node.kind,
    children: toNodes(node.children),
  }));
}

/**
 * Construit l'arbre d'un plan.
 *
 * Un nom qui apparaît à la fois comme fichier et comme dossier devient un
 * dossier : le cas ne vient pas de `planProject`, mais une entrée inattendue ne
 * doit pas casser l'écran ni dupliquer une branche.
 */
export function buildFileTree(paths: readonly string[]): readonly TreeNode[] {
  const root = new Map<string, MutableNode>();

  for (const raw of paths) {
    const segments = segmentsOf(raw);
    let level = root;
    let prefix = '';

    for (const [index, name] of segments.entries()) {
      const isLast = index === segments.length - 1;
      const path = prefix === '' ? name : `${prefix}/${name}`;
      prefix = path;

      const existing = level.get(name);
      if (existing === undefined) {
        const node: MutableNode = {
          name,
          path,
          kind: isLast ? 'file' : 'directory',
          children: new Map(),
        };
        level.set(name, node);
        level = node.children;
        continue;
      }

      // Un chemin plus profond impose que ce nom soit un dossier.
      if (!isLast && existing.kind === 'file') {
        existing.kind = 'directory';
      }
      level = existing.children;
    }
  }

  return toNodes(root);
}

/** Le nombre de fichiers — ce que l'écran annonce, dossiers exclus. */
export function countFiles(nodes: readonly TreeNode[]): number {
  return nodes.reduce(
    (total, node) => total + (node.kind === 'file' ? 1 : countFiles(node.children)),
    0,
  );
}

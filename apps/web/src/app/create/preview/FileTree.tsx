import type { ReactElement } from 'react';
import { rootFolderNote } from './folder-notes';
import type { TreeNode } from './tree';

export interface FileTreeProps {
  readonly nodes: readonly TreeNode[];
}

/**
 * L'arborescence (§6.12) — un composant **pur** : il reçoit son arbre, il ne le
 * lit pas. C'est ce qui le rend vérifiable sans DOM, comme `ToastList`.
 *
 * Les dossiers sont marqués par un `/` et par l'indentation : la profondeur est
 * lisible même quand la couleur ne l'est pas.
 *
 * Seule la racine porte une phrase (`rootFolderNote`) : un `lib` imbriqué n'a
 * pas le sens du `lib` racine, et une note à chaque niveau noierait l'arbre.
 */
function Rows({
  nodes,
  depth,
}: {
  readonly nodes: readonly TreeNode[];
  readonly depth: number;
}): ReactElement {
  return (
    <>
      {nodes.map((node) => {
        const note =
          depth === 0 && node.kind === 'directory' ? rootFolderNote(node.name) : undefined;
        return (
          <li key={node.path} className="pf-mono">
            {node.name}
            {node.kind === 'directory' ? '/' : ''}
            {note === undefined ? null : <span className="pf-hint ml-2">{note}</span>}
            {node.children.length === 0 ? null : (
              <ul className="m-0 ml-4 list-none border-l border-border p-0 pl-3">
                <Rows nodes={node.children} depth={depth + 1} />
              </ul>
            )}
          </li>
        );
      })}
    </>
  );
}

export function FileTree({ nodes }: FileTreeProps): ReactElement {
  return (
    <ul aria-label="Arborescence des fichiers à générer" className="m-0 list-none p-0">
      <Rows nodes={nodes} depth={0} />
    </ul>
  );
}

import type { ReactElement } from 'react';
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
 */
function Rows({ nodes }: { readonly nodes: readonly TreeNode[] }): ReactElement {
  return (
    <>
      {nodes.map((node) => (
        <li key={node.path} className="pf-mono">
          {node.name}
          {node.kind === 'directory' ? '/' : ''}
          {node.children.length === 0 ? null : (
            <ul className="m-0 ml-4 list-none border-l border-border p-0 pl-3">
              <Rows nodes={node.children} />
            </ul>
          )}
        </li>
      ))}
    </>
  );
}

export function FileTree({ nodes }: FileTreeProps): ReactElement {
  return (
    <ul aria-label="Arborescence des fichiers à générer" className="m-0 list-none p-0">
      <Rows nodes={nodes} />
    </ul>
  );
}

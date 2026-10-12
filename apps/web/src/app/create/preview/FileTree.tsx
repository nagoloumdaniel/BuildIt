'use client';

import type { ReactElement } from 'react';
import { useMessages } from '../../../lib/i18n/provider';
import { rootFolderNote } from './folder-notes';
import type { TreeNode } from './tree';

export interface FileTreeProps {
  readonly nodes: readonly TreeNode[];
}

/**
 * L'arborescence (§6.12) — un composant **pur** : il reçoit son arbre, il ne le
 * lit pas. C'est ce qui le rend vérifiable sans DOM, comme `ToastList` ; seule
 * la langue vient du contexte (`useMessages`).
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
  const t = useMessages();
  return (
    <>
      {nodes.map((node) => {
        const note =
          depth === 0 && node.kind === 'directory'
            ? rootFolderNote(node.name, t.build.preview.folderNotes)
            : undefined;
        return (
          <li key={node.path} className="pf-mono break-all">
            {node.name}
            {node.kind === 'directory' ? '/' : ''}
            {note === undefined ? null : <span className="pf-hint ml-2 break-normal">{note}</span>}
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
  const t = useMessages();
  return (
    <ul aria-label={t.build.preview.treeLabel} className="m-0 list-none overflow-x-auto p-0">
      <Rows nodes={nodes} depth={0} />
    </ul>
  );
}

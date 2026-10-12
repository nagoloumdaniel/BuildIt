import type { ReactElement } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import {
  type RelationEdge,
  type RelationNode,
  relationLabel,
  sortedEdges,
  sortedNodes,
  stateLabel,
} from './relations';

/**
 * L'équivalent textuel du graphe (§6.11).
 *
 * Deux tableaux : un pour les nœuds — chacun dit s'il a été choisi ou ajouté par
 * le moteur — un pour les relations, chacune nommant sa nature. Un lecteur
 * d'écran n'a pas besoin du dessin ; ces tables sont le graphe.
 *
 * Les en-têtes et les états viennent du dictionnaire ; les identifiants du
 * catalogue (noms, catégories) restent tels quels — ce sont des valeurs.
 */

export function GraphNodesTable({
  nodes,
}: {
  readonly nodes: readonly RelationNode[];
}): ReactElement {
  const t = useMessages();
  return (
    <table className="pf-table">
      <caption className="pf-eyebrow text-left">{t.graph.nodesCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{t.graph.nodeColumn}</th>
          <th scope="col">{t.graph.categoryColumn}</th>
          <th scope="col">{t.graph.originColumn}</th>
        </tr>
      </thead>
      <tbody>
        {sortedNodes(nodes).map((node) => (
          <tr key={node.id}>
            <td>{node.label}</td>
            <td className="pf-mono">{node.category}</td>
            <td>
              <span className={node.state === 'selected' ? 'pf-badge pf-badge-accent' : 'pf-badge'}>
                {stateLabel(node.state, t.graph)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface GraphEdgesTableProps {
  readonly edges: readonly RelationEdge[];
  readonly labels: ReadonlyMap<string, string>;
}

export function GraphEdgesTable({ edges, labels }: GraphEdgesTableProps): ReactElement {
  const t = useMessages();
  const ordered = sortedEdges(edges);
  if (ordered.length === 0) {
    return <p className="pf-hint">{t.graph.noEdges}</p>;
  }
  return (
    <table className="pf-table">
      <caption className="pf-eyebrow text-left">{t.graph.relationsCaption}</caption>
      <thead>
        <tr>
          <th scope="col">{t.graph.fromColumn}</th>
          <th scope="col">{t.graph.relationColumn}</th>
          <th scope="col">{t.graph.toColumn}</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((edge) => (
          <tr key={`${edge.from}|${edge.kind}|${edge.to}`}>
            <td>{labels.get(edge.from) ?? edge.from}</td>
            <td>{relationLabel(edge.kind, t.graph)}</td>
            <td>{labels.get(edge.to) ?? edge.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

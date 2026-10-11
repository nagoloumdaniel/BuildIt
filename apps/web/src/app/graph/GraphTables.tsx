import type { ReactElement } from 'react';
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
 */

export function GraphNodesTable({
  nodes,
}: {
  readonly nodes: readonly RelationNode[];
}): ReactElement {
  return (
    <table className="w-full text-left text-sm">
      <caption className="pf-eyebrow text-left">Nœuds du graphe</caption>
      <thead>
        <tr>
          <th scope="col" className="pf-label">
            Technologie
          </th>
          <th scope="col" className="pf-label">
            Catégorie
          </th>
          <th scope="col" className="pf-label">
            Origine
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedNodes(nodes).map((node) => (
          <tr key={node.id}>
            <td className="py-1 pr-3">{node.label}</td>
            <td className="pf-mono py-1 pr-3">{node.category}</td>
            <td className="py-1">
              <span className={node.state === 'selected' ? 'pf-badge pf-badge-accent' : 'pf-badge'}>
                {stateLabel(node.state)}
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
  const ordered = sortedEdges(edges);
  if (ordered.length === 0) {
    return <p className="pf-hint">Aucune relation déclarée entre ces technologies.</p>;
  }
  return (
    <table className="w-full text-left text-sm">
      <caption className="pf-eyebrow text-left">Relations déclarées</caption>
      <thead>
        <tr>
          <th scope="col" className="pf-label">
            De
          </th>
          <th scope="col" className="pf-label">
            Relation
          </th>
          <th scope="col" className="pf-label">
            Vers
          </th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((edge) => (
          <tr key={`${edge.from}|${edge.kind}|${edge.to}`}>
            <td className="py-1 pr-3">{labels.get(edge.from) ?? edge.from}</td>
            <td className="py-1 pr-3">{relationLabel(edge.kind)}</td>
            <td className="py-1">{labels.get(edge.to) ?? edge.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

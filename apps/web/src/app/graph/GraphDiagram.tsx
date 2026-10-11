import type { ReactElement } from 'react';
import { describeNode, type GraphLayout, graphText } from './relations';

export interface GraphDiagramProps {
  readonly layout: GraphLayout;
  readonly labels: ReadonlyMap<string, string>;
}

/**
 * Le dessin, sans librairie et sans dépendance : un SVG déterministe (§6.11).
 *
 * Il est **décoratif au sens strict** : `role="img"` et un `<desc>` qui contient
 * l'équivalent textuel complet, doublé par les tableaux de l'écran. La couleur
 * ne porte aucune information — un nœud choisi est plein, un nœud ajouté est
 * creux — et la nature d'une arête se lit dans le tableau, pas dans ses
 * pointillés.
 */
export function GraphDiagram({ layout, labels }: GraphDiagramProps): ReactElement {
  const description = graphText(
    layout.nodes.map((placed) => placed.node),
    layout.edges.map((drawn) => drawn.edge),
    labels,
  ).join(' ');

  return (
    <svg
      role="img"
      aria-labelledby="pf-graph-title pf-graph-desc"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className="text-text h-auto w-full"
    >
      <title id="pf-graph-title">Graphe de dépendances de la sélection</title>
      <desc id="pf-graph-desc">{description}</desc>
      {layout.edges.map((drawn) => (
        <line
          key={`${drawn.edge.from}|${drawn.edge.kind}|${drawn.edge.to}`}
          x1={drawn.from.x}
          y1={drawn.from.y}
          x2={drawn.to.x}
          y2={drawn.to.y}
          stroke="currentColor"
          strokeWidth={1}
          opacity={0.45}
          {...(drawn.edge.kind === 'compatibleWith' ? { strokeDasharray: '4 3' } : {})}
        />
      ))}
      {layout.nodes.map((placed) => (
        <g key={placed.node.id}>
          <title>{describeNode(placed.node)}</title>
          <circle
            cx={placed.x}
            cy={placed.y}
            r={5}
            stroke="currentColor"
            strokeWidth={1.5}
            fill={placed.node.state === 'selected' ? 'currentColor' : 'none'}
          />
          <text x={placed.x + 11} y={placed.y + 4} fill="currentColor" fontSize={12}>
            {placed.node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

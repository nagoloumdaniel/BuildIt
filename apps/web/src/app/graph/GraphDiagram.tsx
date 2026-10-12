import type { ReactElement } from 'react';
import { useMessages } from '../../lib/i18n/provider';
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
 *
 * Il est rendu à sa taille naturelle et défile dans son conteneur plutôt que
 * d'être réduit : des étiquettes à 6 px ne sont pas « responsives », elles sont
 * illisibles. Les tableaux qui suivent restent l'équivalent complet.
 */
export function GraphDiagram({ layout, labels }: GraphDiagramProps): ReactElement {
  const t = useMessages();
  const description = graphText(
    layout.nodes.map((placed) => placed.node),
    layout.edges.map((drawn) => drawn.edge),
    labels,
    t.graph,
  ).join(' ');

  return (
    <svg
      aria-labelledby="pf-graph-title pf-graph-desc"
      className="text-text"
      height={layout.height}
      role="img"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
    >
      <title id="pf-graph-title">{t.graph.diagramTitle}</title>
      <desc id="pf-graph-desc">{description}</desc>
      {layout.edges.map((drawn) => (
        <line
          key={`${drawn.edge.from}|${drawn.edge.kind}|${drawn.edge.to}`}
          opacity={0.45}
          stroke="currentColor"
          strokeWidth={1}
          x1={drawn.from.x}
          x2={drawn.to.x}
          y1={drawn.from.y}
          y2={drawn.to.y}
          {...(drawn.edge.kind === 'compatibleWith' ? { strokeDasharray: '4 3' } : {})}
        />
      ))}
      {layout.nodes.map((placed) => (
        <g key={placed.node.id}>
          <title>{describeNode(placed.node, t.graph)}</title>
          <circle
            cx={placed.x}
            cy={placed.y}
            fill={placed.node.state === 'selected' ? 'currentColor' : 'none'}
            r={5}
            stroke="currentColor"
            strokeWidth={1.5}
          />
          <text fill="currentColor" fontSize={13} x={placed.x + 11} y={placed.y + 4}>
            {placed.node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

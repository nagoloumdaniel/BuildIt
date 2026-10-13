import { type ReactElement, useId } from 'react';
import { TechIcon } from '../../components/ui/tech-icon';
import { useMessages } from '../../lib/i18n/provider';
import { describeNode, type GraphLayout, graphText } from './relations';

export interface GraphDiagramProps {
  readonly layout: GraphLayout;
  readonly labels: ReadonlyMap<string, string>;
}

/**
 * Le dessin, sans librairie et sans dépendance (§6.11).
 *
 * Deux couches posées aux mêmes coordonnées : un SVG pour les liens (des
 * courbes, qu'aucune boîte HTML ne trace proprement) et des pastilles HTML
 * pour les nœuds, parce qu'elles portent le logo du catalogue (`TechIcon`) et
 * tronquent un nom trop long en CSS, ce qu'un `<text>` SVG ne sait pas faire.
 *
 * L'ensemble est une image au sens de l'accessibilité : `role="img"`, un titre
 * et une description qui contient l'équivalent textuel complet. Les couches
 * sont donc masquées aux lecteurs d'écran, qui ne liraient sinon que des noms
 * sans les flèches. Le texte de l'écran, sous le dessin, explique le reste.
 *
 * La couleur ne porte jamais l'information seule : un nœud choisi a une
 * bordure pleine, un nœud ajouté une bordure pointillée ; une exigence a une
 * flèche, une compatibilité un pointillé sans flèche.
 *
 * Il est rendu à sa taille naturelle et défile dans son conteneur plutôt que
 * d'être réduit : des étiquettes à 6 px ne sont pas « responsives », elles sont
 * illisibles.
 */
export function GraphDiagram({ layout, labels }: GraphDiagramProps): ReactElement {
  const t = useMessages();
  // Les identifiants de React portent des deux-points : on les retire d'une référence `url(#…)`.
  const id = `pf-graph${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;
  const arrowId = `${id}-arrow`;
  const description = graphText(
    layout.nodes.map((placed) => placed.node),
    layout.edges.map((drawn) => drawn.edge),
    labels,
    t.graph,
  ).join(' ');

  return (
    <div
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="pf-graph-canvas"
      role="img"
      style={{ height: layout.height, width: layout.width }}
    >
      <span className="pf-sr-only" id={titleId}>
        {t.graph.diagramTitle}
      </span>
      <span className="pf-sr-only" id={descId}>
        {description}
      </span>
      <svg
        aria-hidden="true"
        className="pf-graph-links"
        focusable="false"
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
      >
        <defs>
          <marker
            id={arrowId}
            markerHeight={8}
            markerUnits="userSpaceOnUse"
            markerWidth={8}
            orient="auto"
            refX={7}
            refY={4}
          >
            <path className="pf-graph-arrow" d="M1 1L7 4L1 7" />
          </marker>
        </defs>
        {layout.edges.map((drawn) => (
          <path
            className="pf-graph-link"
            d={drawn.path}
            data-kind={drawn.edge.kind}
            key={`${drawn.edge.from}|${drawn.edge.kind}|${drawn.edge.to}`}
            {...(drawn.edge.kind === 'requires' ? { markerEnd: `url(#${arrowId})` } : {})}
          />
        ))}
      </svg>
      <ul aria-hidden="true" className="pf-graph-nodes">
        {layout.nodes.map((placed) => (
          <li
            className="pf-graph-node"
            data-state={placed.node.state}
            key={placed.node.id}
            style={{
              height: layout.pillHeight,
              left: placed.x,
              top: placed.y,
              width: layout.pillWidth,
            }}
            title={describeNode(placed.node, t.graph)}
          >
            <TechIcon id={placed.node.id} name={placed.node.label} size={16} />
            <span className="pf-graph-node-label">{placed.node.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

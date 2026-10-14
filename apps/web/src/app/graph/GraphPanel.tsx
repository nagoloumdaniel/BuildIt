import { Badge } from '@buildit/ui';
import { type ReactElement, useMemo } from 'react';
import { Icon } from '../../components/ui/icon';
import { useMessages } from '../../lib/i18n/provider';
import { GraphDiagram } from './GraphDiagram';
import { GraphGuide } from './GraphGuide';
import type { GraphData } from './graph-load';
import { layoutGraph } from './relations';

export interface GraphPanelProps {
  /** Un graphe **non vide** : le vide est une issue, traitée par l'écran. */
  readonly graph: GraphData;
}

/**
 * Le graphe affiché : le badge d'état, le compte, le dessin et sa lecture.
 *
 * Ce bloc est le même pour le brouillon (`/graph`) et pour un projet déjà
 * généré (`/projects/graph`) : un même graphe doit se lire pareil avant et
 * après la génération. Les issues attente, échec, vide, elles, dépendent de
 * l'écran (d'où l'on repart), et restent chez lui.
 *
 * Rien n'est recalculé ici : le chargement (`useGraphLoad`) et la sélection
 * sont en amont, ce composant ne fait que mettre en forme.
 */
export function GraphPanel({ graph }: GraphPanelProps): ReactElement {
  const t = useMessages();
  const labels = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node.label])), [graph]);
  const layout = useMemo(() => layoutGraph(graph.nodes, graph.edges), [graph]);

  return (
    <div>
      <p className="flex flex-wrap items-center gap-2">
        <Badge tone={graph.status === 'certified' ? 'ok' : 'accent'}>
          {graph.status === 'certified' ? t.graph.certified : t.graph.experimental}
        </Badge>
        <span className="pf-hint">{t.graph.counts(graph.nodes.length, graph.edges.length)}</span>
      </p>

      <section className="pf-card pf-graph-card mt-4">
        <div className="pf-graph-card-head">
          <h2 className="pf-label flex items-center gap-2">
            <Icon name="gitBranch" size={14} />
            {t.graph.diagramHeading}
          </h2>
          <p className="pf-hint">{t.graphGuide.diagramHint}</p>
        </div>
        <div className="pf-scroll-x pf-graph-stage">
          <GraphDiagram labels={labels} layout={layout} />
        </div>
        <p className="pf-hint pf-graph-scroll-hint">{t.graphGuide.scrollHint}</p>
      </section>

      <GraphGuide edges={graph.edges} nodes={graph.nodes} />
    </div>
  );
}

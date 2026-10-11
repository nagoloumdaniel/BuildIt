'use client';

import { Badge, buttonClassName, StatusMessage } from '@project-factory/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDraft } from '../../components/wizard/draft-provider';
import { ScreenShell } from '../../components/wizard/shell';
import { draftToManifest } from '../../lib/draft-to-manifest';
import { loadGraphAction } from '../actions';
import { manifestTechnologyIds } from '../create/blueprint/summary';
import { GraphDiagram } from './GraphDiagram';
import { GraphEdgesTable, GraphNodesTable } from './GraphTables';
import { layoutGraph, type RelationEdge, type RelationNode } from './relations';

interface GraphState {
  readonly nodes: readonly RelationNode[];
  readonly edges: readonly RelationEdge[];
  readonly status: 'certified' | 'experimental';
}

/**
 * Dependency Graph (§6.11) — la vue avancée, **accessible depuis le Blueprint,
 * jamais imposée**. Elle est hors parcours (`ScreenShell`, sans progression) et
 * n'a aucune dépendance : pas de librairie de graphe, un SVG déterministe plus
 * deux tableaux qui sont l'équivalent textuel complet.
 *
 * La sélection est celle du manifest canonique quand il est constructible :
 * le graphe montre alors exactement ce que le moteur a résolu, additions
 * comprises. Un brouillon incomplet montre ce qui a été coché — imparfait mais
 * honnête, plutôt qu'un graphe vide.
 */
export default function GraphPage() {
  const draft = useDraft();

  const selection = useMemo(() => {
    const manifest = draftToManifest(draft);
    if (manifest.ok) {
      return {
        targets: manifest.value.targets,
        technologies: [...manifestTechnologyIds(manifest.value)],
      };
    }
    return {
      targets: draft.targets,
      technologies: [...draft.technologies, ...draft.capabilities],
    };
  }, [draft]);

  const [graph, setGraph] = useState<GraphState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    void loadGraphAction(selection)
      .then((value) => {
        if (alive) {
          setGraph({ nodes: value.nodes, edges: value.edges, status: value.status });
        }
      })
      .catch(() => {
        if (alive) {
          setError('Le graphe n’a pas pu être calculé.');
        }
      });
    return () => {
      alive = false;
    };
  }, [selection]);

  const labels = useMemo(
    () => new Map((graph?.nodes ?? []).map((node) => [node.id, node.label])),
    [graph],
  );
  const layout = useMemo(() => layoutGraph(graph?.nodes ?? [], graph?.edges ?? []), [graph]);

  return (
    <ScreenShell
      title="Graphe de dépendances"
      description="Ce qui a été choisi, ce que le moteur a ajouté, et par quoi les pièces tiennent ensemble."
      actions={
        <Link className={buttonClassName()} href="/create/blueprint">
          Retour au Blueprint
        </Link>
      }
    >
      {graph === null ? (
        <StatusMessage>{error ?? 'Calcul du graphe…'}</StatusMessage>
      ) : graph.nodes.length === 0 ? (
        <StatusMessage>
          Aucune technologie sélectionnée : le graphe est vide. Choisissez des technologies aux
          écrans précédents.
        </StatusMessage>
      ) : (
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={graph.status === 'certified' ? 'ok' : 'accent'}>
              {graph.status === 'certified' ? 'Sélection certifiée' : 'Sélection expérimentale'}
            </Badge>
            <span className="pf-hint">
              {graph.nodes.length} nœud{graph.nodes.length > 1 ? 's' : ''}, {graph.edges.length}{' '}
              relation{graph.edges.length > 1 ? 's' : ''}
            </span>
          </p>

          <div className="pf-card pf-card-pad mt-4 overflow-x-auto">
            <GraphDiagram layout={layout} labels={labels} />
          </div>

          <section className="mt-5">
            <h2 className="pf-label">Nœuds</h2>
            <div className="mt-2 overflow-x-auto">
              <GraphNodesTable nodes={graph.nodes} />
            </div>
          </section>

          <section className="mt-5">
            <h2 className="pf-label">Relations</h2>
            <div className="mt-2 overflow-x-auto">
              <GraphEdgesTable edges={graph.edges} labels={labels} />
            </div>
          </section>
        </div>
      )}
    </ScreenShell>
  );
}

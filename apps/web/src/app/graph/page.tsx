'use client';

import { Badge, Button, buttonClassName } from '@buildit/ui';
import Link from 'next/link';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine, ProgressBar } from '../../components/ui/loading';
import { useDraft } from '../../components/wizard/draft-provider';
import { ScreenShell } from '../../components/wizard/shell';
import { draftToManifest } from '../../lib/draft-to-manifest';
import { useMessages } from '../../lib/i18n/provider';
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
export default function GraphPage(): ReactElement {
  const t = useMessages();
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
  const [failed, setFailed] = useState(false);

  /**
   * Chaque calcul porte un numéro : une réponse tardive — la sélection a changé
   * entre-temps, ou l'utilisateur a relancé — ne doit pas écraser l'état
   * courant. Le bouton « Recalculer » rappelle simplement `load`.
   */
  const requestId = useRef(0);
  const load = useCallback((): void => {
    const ticket = requestId.current + 1;
    requestId.current = ticket;
    setFailed(false);
    setGraph(null);
    void loadGraphAction(selection)
      .then((value) => {
        if (requestId.current === ticket) {
          setGraph({ nodes: value.nodes, edges: value.edges, status: value.status });
        }
      })
      .catch(() => {
        if (requestId.current === ticket) {
          setFailed(true);
        }
      });
  }, [selection]);

  useEffect(() => {
    load();
    return () => {
      // La réponse en vol devient obsolète : elle ne touchera plus l'écran.
      requestId.current += 1;
    };
  }, [load]);

  const labels = useMemo(
    () => new Map((graph?.nodes ?? []).map((node) => [node.id, node.label])),
    [graph],
  );
  const layout = useMemo(() => layoutGraph(graph?.nodes ?? [], graph?.edges ?? []), [graph]);

  return (
    <ScreenShell
      icon="workflow"
      actions={
        <Link className={buttonClassName()} href="/create/blueprint">
          <Icon name="arrowLeft" />
          {t.graph.backToBlueprint}
        </Link>
      }
      description={t.graph.description}
      title={t.graph.title}
    >
      {failed ? (
        <ErrorState
          actions={
            <>
              <Button onClick={load} variant="primary">
                <Icon name="refresh" />
                {t.graph.retry}
              </Button>
              <Link className="pf-btn" href="/create/blueprint">
                <Icon name="arrowLeft" />
                {t.graph.backToBlueprint}
              </Link>
            </>
          }
          body={t.graph.errorBody}
          title={t.graph.errorTitle}
        />
      ) : graph === null ? (
        <div>
          <LoadingLine>{t.graph.loading}</LoadingLine>
          <ProgressBar className="mt-2" />
        </div>
      ) : graph.nodes.length === 0 ? (
        <EmptyState
          actions={
            <Link className={buttonClassName('primary')} href="/create/stack">
              <Icon name="grid" />
              {t.graph.emptyAction}
            </Link>
          }
          body={t.graph.emptyBody}
          icon="grid"
          title={t.graph.emptyTitle}
        />
      ) : (
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone={graph.status === 'certified' ? 'ok' : 'accent'}>
              {graph.status === 'certified' ? t.graph.certified : t.graph.experimental}
            </Badge>
            <span className="pf-hint">
              {t.graph.counts(graph.nodes.length, graph.edges.length)}
            </span>
          </p>

          <section className="pf-card pf-card-pad mt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="pf-label flex items-center gap-2">
                <Icon name="gitBranch" size={14} />
                {t.graph.diagramHeading}
              </h2>
              <p className="pf-hint">{t.graph.diagramHint}</p>
            </div>
            <div className="pf-scroll-x mt-3">
              <GraphDiagram labels={labels} layout={layout} />
            </div>
            <p className="pf-eyebrow mt-3">{t.graph.legendTitle}</p>
            <ul className="pf-row mt-1 list-none p-0 text-sm">
              <li className="pf-hint flex items-center gap-2">
                <Icon name="check" size={14} />
                {t.graph.stateLabels.selected}
              </li>
              <li className="pf-hint flex items-center gap-2">
                <Icon name="sparkles" size={14} />
                {t.graph.stateLabels.added}
              </li>
              <li className="pf-hint flex items-center gap-2">
                <Icon name="gitBranch" size={14} />
                {t.graph.relationLabels.requires}
              </li>
              <li className="pf-hint flex items-center gap-2">
                <Icon name="externalLink" size={14} />
                {t.graph.relationLabels.compatibleWith}
              </li>
            </ul>
          </section>

          <section className="mt-5">
            <h2 className="pf-label flex items-center gap-2">
              <Icon name="list" size={14} />
              {t.graph.nodesHeading}
            </h2>
            <div className="pf-scroll-x mt-2">
              <GraphNodesTable nodes={graph.nodes} />
            </div>
          </section>

          <section className="mt-5">
            <h2 className="pf-label flex items-center gap-2">
              <Icon name="link" size={14} />
              {t.graph.relationsHeading}
            </h2>
            <div className="pf-scroll-x mt-2">
              <GraphEdgesTable edges={graph.edges} labels={labels} />
            </div>
          </section>
        </div>
      )}
    </ScreenShell>
  );
}

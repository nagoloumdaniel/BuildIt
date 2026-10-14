'use client';

import { Button, buttonClassName } from '@buildit/ui';
import Link from 'next/link';
import { type ReactElement, useMemo } from 'react';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine, ProgressBar } from '../../components/ui/loading';
import { useDraft } from '../../components/wizard/draft-provider';
import { ScreenShell } from '../../components/wizard/shell';
import { draftToManifest } from '../../lib/draft-to-manifest';
import { useMessages } from '../../lib/i18n/provider';
import { manifestTechnologyIds } from '../create/blueprint/summary';
import { GraphPanel } from './GraphPanel';
import { useGraphLoad } from './graph-load';

/**
 * Dependency Graph (§6.11) la vue avancée, **accessible depuis le Blueprint,
 * jamais imposée**. Elle est hors parcours (`ScreenShell`, sans progression) et
 * n'a aucune dépendance : pas de librairie de graphe, un dessin déterministe
 * (dont la description porte l'équivalent textuel complet) puis une lecture
 * propre au graphe affiché : qui a été choisi, ce que le moteur a ajouté et
 * à cause de quoi, et la légende du dessin.
 *
 * La sélection est celle du manifest canonique quand il est constructible :
 * le graphe montre alors exactement ce que le moteur a résolu, additions
 * comprises. Un brouillon incomplet montre ce qui a été coché imparfait mais
 * honnête, plutôt qu'un graphe vide.
 *
 * Le chargement et le dessin sont partagés avec `/projects/graph` (`useGraphLoad`,
 * `GraphPanel`) : seul le point de départ de la sélection est propre à l'écran.
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

  const { graph, failed, reload: load } = useGraphLoad(selection);

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
        <GraphPanel graph={graph} />
      )}
    </ScreenShell>
  );
}

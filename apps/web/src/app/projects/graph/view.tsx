'use client';

import type { Manifest } from '@buildit/manifest';
import { Button } from '@buildit/ui';
import Link from 'next/link';
import { type ReactElement, useMemo } from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine, ProgressBar } from '../../../components/ui/loading';
import { ScreenShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import { manifestTechnologyIds } from '../../create/blueprint/summary';
import { GraphPanel } from '../../graph/GraphPanel';
import { useGraphLoad } from '../../graph/graph-load';
// La recherche du projet (`?id=`) est celle de `/projects/architecture` : la
// règle est la même pour toute page d'un projet, elle n'est pas recopiée.
import type { ProjectLookup } from '../architecture/view';

/**
 * Le graphe de dépendances d'un projet déjà généré : la vue.
 *
 * Le projet est relu depuis `localStorage` par la page, après hydratation ;
 * cette vue ne fait que choisir la forme. Trois issues, et aucune n'est un
 * cul-de-sac (§8) : chacune ramène à la liste des projets.
 *
 * - le projet n'est pas dans la liste de ce navigateur (identifiant inconnu
 *   ou absent) : on le dit, sans supposer pourquoi plus que nécessaire ;
 * - le projet n'a pas de manifest conservé (généré avant que la liste ne le
 *   garde) : le moteur ne peut rien recalculer, et l'écran le dit au lieu de
 *   dessiner un graphe vide ;
 * - sinon, le graphe, calculé par le même moteur et **dessiné par le même
 *   composant** que l'étape 11 (`GraphPanel`) : un même manifest doit se lire
 *   pareil avant et après la génération.
 *
 * Next interdit tout export autre que `default` dans un `page.tsx` : la vue
 * testable vit donc ici, et le chargement du graphe avec elle. Il n'est pas
 * dans `components/ui` comme `ProjectArchitecture` : un seul écran le monte.
 *
 * Les mots viennent d'ailleurs, jamais d'une copie : les états communs à toute
 * page de projet (lecture, projet introuvable, retour) sont ceux de
 * `architecture.project`, le dessin et sa lecture ceux de `graph`, et seules
 * les deux phrases propres au graphe d'un projet (`projects.graphLegacyBody`,
 * `projects.graphEmptyBody`) lui appartiennent.
 */

export interface ProjectGraphScreenProps {
  /** `null` : la liste n'a pas encore été lue (`localStorage`, après hydratation). */
  readonly lookup: ProjectLookup | null;
}

export function ProjectGraphScreen({ lookup }: ProjectGraphScreenProps): ReactElement {
  const t = useMessages();
  const copy = t.architecture.project;
  const back = { href: '/projects', label: copy.back };
  const backLink = (
    <Link className="pf-btn" href="/projects">
      <Icon name="arrowLeft" />
      {copy.backToProjects}
    </Link>
  );

  if (lookup === null) {
    return (
      <ScreenShell back={back} title={t.projects.graph}>
        <LoadingLine>{copy.loading}</LoadingLine>
      </ScreenShell>
    );
  }

  if (lookup.kind === 'unknown') {
    return (
      <ScreenShell back={back} title={t.projects.graph}>
        <EmptyState
          actions={backLink}
          body={copy.unknownBody}
          icon="search"
          title={copy.unknownTitle}
        />
      </ScreenShell>
    );
  }

  if (lookup.kind === 'legacy') {
    return (
      <ScreenShell back={back} title={t.projects.graph}>
        <EmptyState
          actions={backLink}
          body={t.projects.graphLegacyBody}
          icon="gitBranch"
          title={t.graph.errorTitle}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell back={back} description={t.graph.description} title={t.projects.graph}>
      <ProjectGraph manifest={lookup.manifest} />
    </ScreenShell>
  );
}

/** Le projet à dessiner : sa sélection vient de son manifest, jamais du brouillon. */
function ProjectGraph({ manifest }: { readonly manifest: Manifest }): ReactElement {
  const t = useMessages();
  const copy = t.architecture.project;

  /**
   * La sélection est celle du manifest, dans l'ordre canonique du §10 : le
   * graphe montre exactement ce que le moteur a résolu pour ce projet, comme
   * au Blueprint. Le brouillon, lui, n'existe plus (§6.14).
   */
  const selection = useMemo(
    () => ({ targets: manifest.targets, technologies: manifestTechnologyIds(manifest) }),
    [manifest],
  );
  const { graph, failed, reload } = useGraphLoad(selection);

  if (failed) {
    return (
      <ErrorState
        actions={
          <>
            <Button onClick={reload} variant="primary">
              <Icon name="refresh" />
              {t.graph.retry}
            </Button>
            <Link className="pf-btn" href="/projects">
              <Icon name="arrowLeft" />
              {copy.backToProjects}
            </Link>
          </>
        }
        body={t.graph.errorBody}
        title={t.graph.errorTitle}
      />
    );
  }

  if (graph === null) {
    return (
      <div>
        <LoadingLine>{t.graph.loading}</LoadingLine>
        <ProgressBar className="mt-2" />
      </div>
    );
  }

  if (graph.nodes.length === 0) {
    return (
      <EmptyState
        actions={
          <Link className="pf-btn" href="/projects">
            <Icon name="arrowLeft" />
            {copy.backToProjects}
          </Link>
        }
        body={t.projects.graphEmptyBody}
        icon="grid"
        title={t.graph.emptyTitle}
      />
    );
  }

  return <GraphPanel graph={graph} />;
}

'use client';

import type { Manifest } from '@buildit/manifest';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { ProjectArchitecture } from '../../../components/ui/project-architecture';
import { ScreenShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import type { StoredProject } from '../../../lib/projects';

/**
 * L'architecture d'un projet déjà généré : la vue.
 *
 * Le projet est relu depuis `localStorage` par la page, après hydratation ;
 * cette vue ne fait que choisir la forme. Trois issues, et aucune n'est un
 * cul-de-sac (§8) : chacune ramène à la liste des projets.
 *
 * - le projet n'est pas dans la liste de ce navigateur (identifiant inconnu
 *   ou absent) : on le dit, sans supposer pourquoi plus que nécessaire ;
 * - le projet n'a pas de manifest conservé (généré avant que la liste ne le
 *   garde) : le moteur ne peut rien recalculer, et l'écran le dit au lieu
 *   d'afficher un arbre vide ;
 * - sinon, l'architecture, recalculée par le même composant que l'étape 10.
 *
 * Next interdit tout export autre que `default` dans un `page.tsx` : la vue
 * testable et la recherche du projet vivent donc ici.
 */

export type ProjectLookup =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'legacy'; readonly project: StoredProject }
  | { readonly kind: 'ready'; readonly project: StoredProject; readonly manifest: Manifest };

/** Le projet désigné par `?id=`, et ce qu'on peut en montrer. */
export function lookupProject(
  projects: readonly StoredProject[],
  id: string | null,
): ProjectLookup {
  const project = id === null ? undefined : projects.find((item) => item.id === id);
  if (project === undefined) {
    return { kind: 'unknown' };
  }
  return project.manifest === undefined
    ? { kind: 'legacy', project }
    : { kind: 'ready', project, manifest: project.manifest };
}

export interface ProjectArchitectureScreenProps {
  /** `null` : la liste n'a pas encore été lue (`localStorage`, après hydratation). */
  readonly lookup: ProjectLookup | null;
}

export function ProjectArchitectureScreen({
  lookup,
}: ProjectArchitectureScreenProps): ReactElement {
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
      <ScreenShell back={back} title={copy.fallbackTitle}>
        <LoadingLine>{copy.loading}</LoadingLine>
      </ScreenShell>
    );
  }

  if (lookup.kind === 'unknown') {
    return (
      <ScreenShell back={back} title={copy.fallbackTitle}>
        <EmptyState
          actions={backLink}
          body={copy.unknownBody}
          icon="search"
          title={copy.unknownTitle}
        />
      </ScreenShell>
    );
  }

  const title = copy.title(lookup.project.name);

  if (lookup.kind === 'legacy') {
    return (
      <ScreenShell back={back} title={title}>
        <EmptyState
          actions={backLink}
          body={copy.legacyBody}
          icon="folderTree"
          title={copy.legacyTitle}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell back={back} description={copy.description} title={title}>
      <ProjectArchitecture manifest={lookup.manifest} />
    </ScreenShell>
  );
}

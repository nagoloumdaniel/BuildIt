'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine } from '../../components/ui/loading';
import { ProjectCard } from '../../components/ui/project-card';
import { ScreenShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { NEW_PROJECT_HREF } from '../../lib/new-project';
import type { StoredProject } from '../../lib/projects';
import type { GenerationView } from '../actions';

/**
 * L'écran « Tous les projets » (§6.14).
 *
 * La **même carte** que l'accueil, pour la même raison : un projet généré se
 * lit partout de la même façon, et une deuxième mise en page aurait divergé au
 * premier ajustement. La seule différence est le geste de plus « Retirer de
 * la liste » et l'absence de limite : ici, tous les projets, du plus récent
 * au plus ancien.
 *
 * Le vidage de la liste porte une confirmation **explicite**, et la suppression
 * d'un projet en porte une autre, dans sa carte : la première n'efface aucun
 * fichier, la seconde les efface tous. Aucune des deux ne part d'un seul clic,
 * et leurs libellés disent laquelle est laquelle « Vider la liste » n'est pas
 * « Supprimer du disque ».
 *
 * Next interdit tout export autre que `default` dans un `page.tsx` : la vue
 * testable et son tri vivent donc ici.
 */

/** Du plus récent au plus ancien. Une date illisible ne passe pas devant les autres. */
export function newestFirst(projects: readonly StoredProject[]): readonly StoredProject[] {
  const at = (project: StoredProject): number => {
    const parsed = Date.parse(project.generatedAt);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return [...projects].sort((a, b) => at(b) - at(a));
}

export interface ProjectsViewProps {
  /** `null` : la liste n'a pas encore été lue (`localStorage`, après hydratation). */
  readonly projects: readonly StoredProject[] | null;
  readonly onForget?: ((id: string) => void) | undefined;
  readonly onForgetAll?: (() => void) | undefined;
  /** La suppression du dossier sur le disque un autre geste que l'oubli. */
  readonly onDelete?: ((project: StoredProject) => void) | undefined;
  /** Le projet dont le dossier est en cours de suppression, s'il y en a un. */
  readonly deletingId?: string | null;
  /** Une sortie réussie (archive ou dossier) depuis la carte d'un projet. */
  readonly onExported?: ((project: StoredProject, result: GenerationView) => void) | undefined;
  readonly confirmingClear?: boolean;
  readonly onConfirmingClear?: ((value: boolean) => void) | undefined;
}

export function ProjectsView({
  projects,
  onForget,
  onForgetAll,
  onDelete,
  deletingId = null,
  onExported,
  confirmingClear = false,
  onConfirmingClear,
}: ProjectsViewProps): ReactElement {
  const t = useMessages();

  if (projects === null) {
    return (
      <ScreenShell description={t.projects.description} icon="layers" title={t.projects.title}>
        <LoadingLine>{t.projects.loading}</LoadingLine>
      </ScreenShell>
    );
  }

  const ordered = newestFirst(projects);

  return (
    <ScreenShell description={t.projects.description} icon="layers" title={t.projects.title}>
      {ordered.length === 0 ? (
        <EmptyState
          actions={
            <Link className="pf-btn pf-btn-primary" href={NEW_PROJECT_HREF}>
              <Icon name="plus" size={15} />
              {t.projects.emptyAction}
            </Link>
          }
          body={t.projects.forgetHint}
          icon="package"
          title={t.projects.empty}
        />
      ) : (
        <>
          <div className="pf-stack">
            {ordered.map((project) => (
              <ProjectCard
                key={project.id}
                deleting={deletingId === project.id}
                onDelete={
                  onDelete === undefined
                    ? undefined
                    : () => {
                        onDelete(project);
                      }
                }
                onForget={
                  onForget === undefined
                    ? undefined
                    : () => {
                        onForget(project.id);
                      }
                }
                onExported={
                  onExported === undefined
                    ? undefined
                    : (result) => {
                        onExported(project, result);
                      }
                }
                project={project}
              />
            ))}
          </div>

          {onForgetAll === undefined ? (
            <p className="pf-hint mt-4">{t.projects.forgetHint}</p>
          ) : (
            <div className="mt-4">
              {confirmingClear ? (
                <section className="pf-card pf-card-pad" role="alert">
                  <p className="pf-title-sm flex items-center gap-2">
                    <span aria-hidden="true" style={{ color: 'var(--pf-danger)' }}>
                      <Icon name="warning" size={16} />
                    </span>
                    {t.projects.clearConfirmTitle}
                  </p>
                  <p className="pf-hint mt-1">{t.projects.clearConfirmBody}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button className="pf-btn pf-btn-danger" onClick={onForgetAll} type="button">
                      <Icon name="trash" size={15} />
                      {t.projects.clearConfirmAction}
                    </button>
                    <button
                      className="pf-btn pf-btn-ghost"
                      onClick={() => onConfirmingClear?.(false)}
                      type="button"
                    >
                      <Icon name="close" size={15} />
                      {t.common.cancel}
                    </button>
                  </div>
                </section>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="pf-btn"
                    onClick={() => onConfirmingClear?.(true)}
                    type="button"
                  >
                    <Icon name="trash" size={15} />
                    {t.projects.forgetAll}
                  </button>
                  <span className="pf-hint">{t.projects.forgetHint}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </ScreenShell>
  );
}

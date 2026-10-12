'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { EmptyState } from '../components/ui/empty-state';
import { Icon } from '../components/ui/icon';
import { LoadingLine } from '../components/ui/loading';
import { ProjectCard } from '../components/ui/project-card';
import type { DraftState } from '../lib/draft';
import { STEP_ORDER, type StepId } from '../lib/flow';
import { useMessages } from '../lib/i18n/provider';
import { recentProjects, type StoredProject } from '../lib/projects';
import type { GenerationReport } from './create/report/result';
import { PickCard } from './open/pick-card';
import type { PickHandoff } from './open/pick-handoff';

/**
 * Le contenu de l'écran 1 — Dashboard (§6.1, §18bis), hors `page.tsx`.
 *
 * Next interdit tout export autre que `default` dans un `page.tsx` : les
 * données et les composants testables vivent ici, `page.tsx` ne fait que
 * câbler `useDraft()`/`useSession()`, la liste des projets générés
 * (`localStorage`) et l'ouverture locale.
 *
 * Trois idées gouvernent la page :
 * 1. **Un projet généré n'est jamais un brouillon.** Dès que le brouillon est
 *    à l'écran « rapport », il sort de « Brouillon en cours » — la liste des
 *    projets générés le porte, et le rapport de session n'est qu'un bonus.
 * 2. **Ouvrir un projet local ouvre l'explorateur**, pas une page
 *    intermédiaire : la carte du menu porte tout le fil (choix, analyse,
 *    résultat, installation).
 * 3. **La carte d'un projet est la même partout** (`ProjectCard`).
 */

/** L'URL d'une étape : l'étape `create` vit à `/create`, pas à `/create/create`. */
function resumeHref(step: StepId): string {
  return step === STEP_ORDER[0] ? '/create' : `/create/${step}`;
}

/**
 * Y a-t-il quelque chose à reprendre ?
 *
 * Le brouillon vide est le brouillon frais : proposer de « reprendre » une page
 * blanche ne rendrait service à personne.
 */
function hasDraft(draft: DraftState): boolean {
  return (
    draft.name !== '' ||
    draft.step !== STEP_ORDER[0] ||
    draft.targets.length > 0 ||
    draft.technologies.length > 0 ||
    draft.capabilities.length > 0
  );
}

/**
 * Le brouillon a-t-il produit un projet **terminé** ?
 *
 * Deux signaux, et il en faut deux :
 *
 * 1. le brouillon est sur l'écran « rapport » et un rapport de session le
 *    confirme — le cas normal, juste après la génération ;
 * 2. le rapport est en main **et** la liste des projets générés contient déjà
 *    ce projet (même nom, même dossier).
 *
 * Le second n'est pas une redondance : depuis le rapport, le rail d'étapes
 * reste cliquable, et redescendre corriger un choix réécrit `draft.step`. Sans
 * lui, l'accueil reproposerait « Reprendre » sur un projet déjà écrit et
 * verrouillé — exactement ce que le §6.14 interdit. Et comme il s'appuie sur la
 * liste persistée, il survit à la fermeture de l'onglet, là où le rapport de
 * session disparaît.
 */
function isCompletedProject(
  draft: DraftState,
  report: GenerationReport | null,
  projects: readonly StoredProject[] | null,
): boolean {
  if (report === null || !report.ok) {
    return false;
  }
  if (draft.step === 'report') {
    return true;
  }
  return (
    report.directory !== '' &&
    (projects ?? []).some(
      (project) => project.directory === report.directory && project.name === draft.name,
    )
  );
}

export interface DashboardViewProps {
  readonly draft: DraftState;
  readonly report?: GenerationReport | null;
  readonly onReset?: (() => void) | undefined;
  readonly onRedownload?: (() => void) | undefined;
  /** `null` : la liste n'a pas encore été lue (`localStorage`, après hydratation). */
  readonly projects?: readonly StoredProject[] | null;
  /** Le choix du dossier ; absent, la carte redevient un simple lien. */
  readonly openLocal?: PickHandoff | undefined;
}

export function DashboardView({
  draft,
  report = null,
  onReset,
  onRedownload,
  projects = [],
  openLocal,
}: DashboardViewProps): ReactElement {
  const t = useMessages();
  const completed = isCompletedProject(draft, report, projects);
  // Le brouillon ne s'affiche **que** hors de l'écran « rapport » : un projet
  // généré n'est pas un parcours à reprendre, même onglet rouvert.
  const draftOnly = !completed && draft.step !== 'report' && hasDraft(draft);
  const list = projects === null ? null : recentProjects(projects, 2);
  // Le rapport de session décrit un projet qui est déjà dans la liste : on ne
  // le montre pas deux fois.
  const completedInList =
    report !== null &&
    report.directory !== '' &&
    (list ?? []).some((project) => project.directory === report.directory);
  const showCompletedCard = completed && !completedInList;

  return (
    <>
      <nav aria-label={t.dashboard.pathsLabel} className="pf-grid">
        <Link className="pf-choice no-underline" href="/create">
          <span className="pf-choice-name">
            <span aria-hidden="true" style={{ color: 'var(--pf-accent)' }}>
              <Icon name="hammer" size={16} />
            </span>
            {t.dashboard.createTitle}
          </span>
          <span className="pf-choice-note">{t.dashboard.createNote}</span>
        </Link>
        <Link className="pf-choice no-underline" href="/clone">
          <span className="pf-choice-name">
            <span aria-hidden="true" style={{ color: 'var(--pf-steel)' }}>
              <Icon name="gitBranch" size={16} />
            </span>
            {t.dashboard.cloneTitle}
          </span>
          <span className="pf-choice-note">{t.dashboard.cloneNote}</span>
        </Link>
        {openLocal === undefined ? (
          <Link className="pf-choice no-underline" href="/open">
            <span className="pf-choice-name">
              <span aria-hidden="true" style={{ color: 'var(--pf-accent)' }}>
                <Icon name="folderOpen" size={16} />
              </span>
              {t.dashboard.openTitle}
            </span>
            <span className="pf-choice-note">{t.dashboard.openNote}</span>
          </Link>
        ) : (
          <LocalOpenCard handoff={openLocal} />
        )}
      </nav>

      <section className="mt-6">
        {list === null ? (
          <LoadingLine>{t.projects.loading}</LoadingLine>
        ) : (
          <>
            {list.length === 0 ? null : (
              <>
                <div className="pf-card-head">
                  <div className="min-w-0">
                    <p className="pf-eyebrow">{t.dashboard.projectsTitle}</p>
                  </div>
                  <Link className="pf-btn pf-btn-sm" href="/projects">
                    <Icon name="list" size={14} />
                    {t.dashboard.projectsAll}
                  </Link>
                </div>
                <div className="pf-stack mt-3">
                  {list.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </>
            )}

            {showCompletedCard ? (
              <section className="pf-card pf-card-pad">
                <p className="pf-eyebrow">{t.dashboard.projectsTitle}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <span>{draft.name === '' ? t.dashboard.unnamed : draft.name}</span>
                  <span className="pf-badge pf-badge-ok">{t.projects.done}</span>
                </p>
                <p className="pf-hint mt-1">{t.dashboard.projectDone}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link className="pf-btn" href="/repo">
                    <Icon name="github" size={15} />
                    {t.projects.connectGithub}
                  </Link>
                  <Link className="pf-btn" href="/create/report">
                    <Icon name="file" size={15} />
                    {t.dashboard.projectReport}
                  </Link>
                  {onRedownload === undefined ? null : (
                    <button className="pf-btn pf-btn-ghost" onClick={onRedownload} type="button">
                      <Icon name="download" size={15} />
                      {t.build.report.download}
                    </button>
                  )}
                </div>
              </section>
            ) : null}

            {list.length === 0 && !showCompletedCard ? (
              <EmptyState
                actions={
                  <Link className="pf-btn" href="/create">
                    <Icon name="plus" size={15} />
                    {t.dashboard.createTitle}
                  </Link>
                }
                icon="package"
                title={t.dashboard.projectsEmpty}
              />
            ) : null}
          </>
        )}
      </section>

      <section className="pf-card pf-card-pad mt-3">
        <p className="pf-eyebrow">{t.dashboard.draftTitle}</p>
        {draftOnly ? (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-2">
              <span>{draft.name === '' ? t.dashboard.unnamed : draft.name}</span>
              <span className="pf-badge pf-badge-accent">{draft.step}</span>
            </p>
            <p className="pf-hint mt-1">
              {t.dashboard.draftLastScreen(t.dashboard.draftStep[draft.step])}{' '}
              {t.dashboard.draftKept}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link className="pf-btn pf-btn-primary" href={resumeHref(draft.step)}>
                <Icon name="play" size={15} />
                {t.dashboard.resume}
              </Link>
              {onReset === undefined ? null : (
                <button className="pf-btn pf-btn-ghost" onClick={onReset} type="button">
                  <Icon name="refresh" size={15} />
                  {t.dashboard.reset}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="pf-hint mt-1">
            {completed || draft.step === 'report'
              ? t.dashboard.draftEmptyAfterProject
              : t.dashboard.draftEmpty}
          </p>
        )}
      </section>

      <nav aria-label={t.dashboard.accountLabel} className="pf-grid mt-3">
        <Link className="pf-choice no-underline" href="/github">
          <span className="pf-choice-name">
            <span aria-hidden="true" style={{ color: 'var(--pf-steel)' }}>
              <Icon name="github" size={16} />
            </span>
            {t.dashboard.githubTitle}
          </span>
          <span className="pf-choice-note">{t.dashboard.githubNote}</span>
        </Link>
        <Link className="pf-choice no-underline" href="/repo">
          <span className="pf-choice-name">
            <span aria-hidden="true" style={{ color: 'var(--pf-steel)' }}>
              <Icon name="users" size={16} />
            </span>
            {t.dashboard.repoTitle}
          </span>
          <span className="pf-choice-note">{t.dashboard.repoNote}</span>
        </Link>
      </nav>
    </>
  );
}

export interface LocalOpenCardProps {
  readonly handoff: PickHandoff;
}

/**
 * La carte « Ouvrir un projet local » du menu.
 *
 * **La carte est le bouton.** L'appuyer ouvre l'explorateur — celui de la
 * machine en local, celui du navigateur en hébergé — et dès qu'un dossier est
 * désigné, l'écran d'ouverture s'affiche avec l'analyse déjà en route.
 *
 * Elle n'affiche ni détection, ni commande, ni installation : c'est l'écran
 * d'ouverture qui les porte, une seule fois. Deux endroits pour la même
 * information finissaient par diverger, et l'accueil se transformait en écran
 * complet au milieu d'une grille de trois cartes.
 */
export function LocalOpenCard({ handoff }: LocalOpenCardProps): ReactElement {
  const t = useMessages();

  return (
    <div className="min-w-0">
      <PickCard
        busy={handoff.busy}
        busyLabel={t.picker.openingHint}
        disabled={handoff.mode === 'none'}
        note={t.dashboard.openNote}
        onPick={handoff.start}
        title={t.dashboard.openTitle}
      />
      {handoff.notice === null ? null : (
        <p aria-live="polite" className="pf-hint mt-2" role="status">
          {handoff.notice}
        </p>
      )}
    </div>
  );
}

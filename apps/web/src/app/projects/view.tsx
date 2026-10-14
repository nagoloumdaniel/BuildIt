'use client';

import Link from 'next/link';
import { type ReactElement, type ReactNode, useCallback, useState } from 'react';
import {
  ConfirmDeleteDialog,
  type DeleteTarget,
  type DeleteTargetId,
} from '../../components/ui/confirm-delete-dialog';
import { EmptyState } from '../../components/ui/empty-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine } from '../../components/ui/loading';
import { ProjectCard } from '../../components/ui/project-card';
import { ScreenShell } from '../../components/wizard/shell';
import type { Messages } from '../../lib/i18n/messages';
import { useMessages } from '../../lib/i18n/provider';
import { NEW_PROJECT_HREF } from '../../lib/new-project';
import {
  browserProjectStorage,
  detachRepository,
  forgetAllProjects,
  type StoredProject,
} from '../../lib/projects';
import { deleteProjectAction, type GenerationView } from '../actions';
import { deleteRepositoryAction } from '../actions-node';

/**
 * L'écran « Tous les projets » (§6.14).
 *
 * La **même carte** que l'accueil, pour la même raison : un projet généré se
 * lit partout de la même façon, et une deuxième mise en page aurait divergé au
 * premier ajustement. La seule différence est l'absence de limite : ici, tous
 * les projets, du plus récent au plus ancien.
 *
 * Un seul geste de retrait, et c'est la poubelle de la carte : elle demande
 * **ce qui** disparaît la ligne BuildIt, le dépôt GitHub, le dossier local.
 * « Retirer de la liste » et « Supprimer du disque » étaient deux boutons pour
 * un seul besoin, et ils se ressemblaient assez pour qu'on se trompe.
 *
 * Le vidage de la liste vit **à droite du titre**, et il demande les mêmes
 * précisions que la carte, sur **toute** la liste : les plateformes qu'il
 * propose ne sont que celles réellement présentes (aucun dépôt dans la liste,
 * aucune cible GitHub), et le compte rendu dit ce qui est parti et ce qui a
 * échoué. Rien n'efface jamais au premier clic.
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

/** Les adresses de dépôt distinctes de la liste, sans doublon. */
export function repositoryUrls(projects: readonly StoredProject[]): readonly string[] {
  const urls = new Set<string>();
  for (const project of projects) {
    if (project.repositoryUrl !== undefined) {
      urls.add(project.repositoryUrl);
    }
  }
  return [...urls];
}

/** Les dossiers distincts de la liste : deux projets peuvent partager un dossier. */
export function directories(projects: readonly StoredProject[]): readonly string[] {
  const found = new Set<string>();
  for (const project of projects) {
    if (project.directory !== '') {
      found.add(project.directory);
    }
  }
  return [...found];
}

/**
 * Les cibles du vidage, déduites de **toute** la liste.
 *
 * Le site s'il y a une ligne à retirer, GitHub s'il y a au moins une adresse,
 * le local s'il y a au moins un dossier. Comme pour la carte, une cible absente
 * n'est pas proposée : vider une liste sans dépôt ne doit pas demander de
 * supprimer des dépôts qui n'existent pas.
 *
 * Fonction pure et exportée : c'est elle que les tests interrogent, plutôt que
 * d'ouvrir la popup pour découvrir la même liste.
 */
export function clearTargets(
  projects: readonly StoredProject[],
  t: Messages,
): readonly DeleteTarget[] {
  const m = t.projects;
  return [
    ...(projects.length === 0
      ? []
      : [{ id: 'site' as const, label: m.clearTargetSite, note: m.clearTargetSiteNote }]),
    ...(repositoryUrls(projects).length === 0
      ? []
      : [{ id: 'github' as const, label: m.clearTargetGithub, note: m.clearTargetGithubNote }]),
    ...(directories(projects).length === 0
      ? []
      : [{ id: 'local' as const, label: m.clearTargetLocal, note: m.clearTargetLocalNote }]),
  ];
}

/** Une ligne du compte rendu, déjà écrite dans la langue de l'utilisateur. */
interface StepLine {
  readonly key: string;
  readonly text: string;
}

export interface ProjectsViewProps {
  /** `null` : la liste n'a pas encore été lue (`localStorage`, après hydratation). */
  readonly projects: readonly StoredProject[] | null;
  /**
   * Le vidage est porté par la vue elle-même : elle seule sait quoi supprimer
   * (les dossiers, les adresses, les lignes). `onChanged` prévient le parent,
   * qui relit `localStorage`.
   */
  /** La liste persistée a changé : le parent la relit. */
  readonly onChanged?: (() => void) | undefined;
  /** Une sortie réussie (archive ou dossier) depuis la carte d'un projet. */
  readonly onExported?: ((project: StoredProject, result: GenerationView) => void) | undefined;
}

export function ProjectsView({ projects, onChanged, onExported }: ProjectsViewProps): ReactElement {
  const t = useMessages();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  /** Le compte rendu, écrit une fois le vidage terminé. */
  const [summary, setSummary] = useState<string | undefined>(undefined);
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [lines, setLines] = useState<readonly StepLine[]>([]);

  const ordered = projects === null ? [] : newestFirst(projects);

  /**
   * Les cibles du vidage, déduites de **toute** la liste (voir `clearTargets`).
   */
  const targets = clearTargets(ordered, t);

  /**
   * Le vidage, cible par cible, et son compte rendu.
   *
   * Les projets ne quittent la liste **qu'après** un succès : une disparition
   * sur un échec laisserait croire que les fichiers sont partis. Chaque échec
   * est compté, pas avalé : le compte rendu dit combien ont réussi et combien
   * ont échoué, sans quoi un « Liste vidée » mentirait sur les dossiers restés
   * sur le disque.
   */
  const clear = useCallback(
    async (selected: readonly DeleteTargetId[]): Promise<void> => {
      setBusy(true);
      setError(undefined);
      setSummary(undefined);
      const done: StepLine[] = [];
      const failures: string[] = [];
      const storage = browserProjectStorage();
      const list = projects ?? [];

      if (selected.includes('github')) {
        let deleted = 0;
        let alreadyGone = 0;
        for (const url of repositoryUrls(list)) {
          try {
            const outcome = await deleteRepositoryAction(url);
            if (!outcome.ok) {
              failures.push(outcome.message);
              continue;
            }
            if (outcome.status === 'gone') {
              alreadyGone += 1;
            } else {
              deleted += 1;
            }
            // Le dépôt a disparu (supprimé ici ou déjà absent côté GitHub) :
            // l'adresse est retirée de **chaque** projet qui la portait, sinon
            // l'application garderait un lien mort.
            for (const project of list) {
              if (project.repositoryUrl === url) {
                detachRepository(storage, project.id);
              }
            }
          } catch {
            failures.push(t.errors.offline);
          }
        }
        if (deleted > 0) {
          done.push({ key: 'github', text: t.projects.clearRepositories(deleted) });
        }
        if (alreadyGone > 0) {
          done.push({ key: 'gone', text: t.projects.clearGone(alreadyGone) });
        }
      }

      if (selected.includes('local')) {
        let removed = 0;
        for (const directory of directories(list)) {
          try {
            const outcome = await deleteProjectAction(directory);
            if (outcome.ok) {
              removed += 1;
            } else {
              failures.push(outcome.issues.join(' '));
            }
          } catch {
            failures.push(t.errors.offline);
          }
        }
        if (removed > 0) {
          done.push({ key: 'local', text: t.projects.clearLocal(removed) });
        }
      }

      // Le site en dernier : une fois la liste vidée, les boucles ci-dessus
      // n'ont plus rien à parcourir, et le retrait de la ligne est le geste
      // qui doit suivre les deux autres.
      if (selected.includes('site')) {
        forgetAllProjects(storage);
        done.push({ key: 'site', text: t.projects.clearRemoved(list.length) });
      }

      setLines(done);
      setSummary(
        failures.length === 0
          ? undefined
          : `${t.projects.clearFailures(failures.length)} ${failures.join(' ')}`,
      );
      setBusy(false);
      setStep('result');
      onChanged?.();
    },
    [onChanged, projects, t],
  );

  const closed = (): void => {
    setConfirming(false);
    setStep('form');
    setLines([]);
    setSummary(undefined);
    setError(undefined);
  };

  const result: ReactNode =
    step === 'form' ? undefined : (
      <>
        <p className="pf-title-sm">{t.projects.clearDone}</p>
        {lines.length === 0 ? null : (
          <ul className="pf-steps-list mt-2">
            {lines.map((line) => (
              <li className="pf-steps-item" key={line.key}>
                <span className="pf-steps-index" aria-hidden="true">
                  ·
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
        )}
        {summary === undefined ? null : (
          <p className="pf-error mt-2" role="status">
            {summary}
          </p>
        )}
      </>
    );

  if (projects === null) {
    return (
      <ScreenShell description={t.projects.description} icon="layers" title={t.projects.title}>
        <LoadingLine>{t.projects.loading}</LoadingLine>
      </ScreenShell>
    );
  }

  /**
   * Le bouton reste **en place** même sans rien à vider : il est désactivé.
   * Le faire disparaître ferait croire qu'il a été retiré de l'écran. Le
   * libellé s'efface en petit écran (la place manque à côté du titre),
   * `aria-label` reste : un bouton en icône seule garde son nom.
   */
  const clearButton = (
    <button
      aria-label={t.projects.forgetAll}
      className="pf-btn pf-btn-sm pf-btn-danger"
      disabled={targets.length === 0}
      onClick={() => setConfirming(true)}
      title={t.projects.forgetAll}
      type="button"
    >
      <Icon name="trash" size={14} />
      <span className="hidden sm:inline">{t.projects.forgetAll}</span>
    </button>
  );

  return (
    <ScreenShell
      actions={clearButton}
      description={t.projects.description}
      icon="layers"
      title={t.projects.title}
    >
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
          <div className="grid items-stretch gap-3 md:grid-cols-2">
            {ordered.map((project) => (
              <ProjectCard
                key={project.id}
                onChanged={onChanged}
                onExported={
                  onExported === undefined
                    ? undefined
                    : (value) => {
                        onExported(project, value);
                      }
                }
                project={project}
              />
            ))}
          </div>
          <p className="pf-hint mt-4">{t.projects.forgetHint}</p>
        </>
      )}

      {!confirming ? null : (
        <ConfirmDeleteDialog
          busy={busy}
          busyLabel={t.projects.clearWorking}
          cancelLabel={t.common.cancel}
          closeLabel={t.common.close}
          confirmLabel={t.projects.clearConfirmAction}
          description={t.projects.clearConfirmBody}
          error={error}
          onClose={closed}
          onConfirm={(selection) => void clear(selection)}
          result={result}
          targets={targets}
          title={t.projects.clearConfirmTitle}
        />
      )}
    </ScreenShell>
  );
}

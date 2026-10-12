'use client';

import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { downloadZip } from '../../lib/download-zip';
import { useMessages } from '../../lib/i18n/provider';
import {
  browserProjectStorage,
  forgetAllProjects,
  forgetProject,
  loadProjects,
  type StoredProject,
} from '../../lib/projects';
import { toast } from '../../lib/toasts';
import { deleteProjectAction } from '../actions';
import { browserSessionStorage, type GenerationReport, loadReport } from '../create/report/result';
import { ProjectsView } from './view';

/**
 * Écran « Tous les projets » (§6.14) : le branchement.
 *
 * La liste vit en `localStorage` : elle n'est donc lue qu'après hydratation,
 * jamais au premier rendu serveur. Tant qu'elle n'est pas lue, la vue dit
 * qu'elle lit — elle n'affiche pas « aucun projet », qui serait faux.
 *
 * Le re-téléchargement n'est proposé que pour le projet dont l'archive est
 * encore en main : le rapport vit en `sessionStorage` et ne concerne que la
 * génération de l'onglet courant.
 *
 * Deux gestes de retrait, et ils ne se confondent pas : `forget` oublie la
 * ligne (rien ne quitte le disque), `remove` supprime le dossier — par une
 * Server Action, parce que le navigateur n'a aucun accès au disque, et avec un
 * retour explicite dans les deux cas. Le projet ne quitte la liste **qu'après**
 * un succès : une carte qui disparaît sur un échec laisserait croire que les
 * fichiers sont partis.
 */
export default function ProjectsPage(): ReactElement {
  const [projects, setProjects] = useState<readonly StoredProject[] | null>(null);
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = useMessages();

  useEffect(() => {
    setProjects(loadProjects(browserProjectStorage()));
    setReport(loadReport(browserSessionStorage()));
  }, []);

  const forget = useCallback((id: string): void => {
    setProjects(forgetProject(browserProjectStorage(), id));
  }, []);

  const forgetAll = useCallback((): void => {
    setProjects(forgetAllProjects(browserProjectStorage()));
    setConfirmingClear(false);
  }, []);

  const remove = useCallback(
    (project: StoredProject): void => {
      setDeletingId(project.id);
      void deleteProjectAction(project.directory)
        .then((result) => {
          if (result.ok) {
            setProjects(forgetProject(browserProjectStorage(), project.id));
            toast(t.projects.deleted(project.name), { kind: 'success' });
            return;
          }
          toast(result.issues.join(' ') || t.errors.offline, { kind: 'error' });
        })
        .catch(() => {
          toast(t.errors.offline, { kind: 'error' });
        })
        .finally(() => {
          setDeletingId(null);
        });
    },
    [t],
  );

  const isRedownloadable = useCallback(
    (project: StoredProject): boolean =>
      report?.ok === true &&
      report.zipBase64 !== undefined &&
      report.directory === project.directory,
    [report],
  );

  const redownload = useCallback(
    (project: StoredProject): void => {
      if (report?.zipBase64 !== undefined) {
        downloadZip(report.zipBase64, project.name);
      }
    },
    [report],
  );

  return (
    <ProjectsView
      confirmingClear={confirmingClear}
      deletingId={deletingId}
      isRedownloadable={isRedownloadable}
      onConfirmingClear={setConfirmingClear}
      onDelete={remove}
      onForget={forget}
      onForgetAll={forgetAll}
      onRedownload={redownload}
      projects={projects}
    />
  );
}

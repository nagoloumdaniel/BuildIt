'use client';

import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { downloadZip } from '../../lib/download-zip';
import {
  browserProjectStorage,
  forgetAllProjects,
  forgetProject,
  loadProjects,
  type StoredProject,
} from '../../lib/projects';
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
 */
export default function ProjectsPage(): ReactElement {
  const [projects, setProjects] = useState<readonly StoredProject[] | null>(null);
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

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
      isRedownloadable={isRedownloadable}
      onConfirmingClear={setConfirmingClear}
      onForget={forget}
      onForgetAll={forgetAll}
      onRedownload={redownload}
      projects={projects}
    />
  );
}

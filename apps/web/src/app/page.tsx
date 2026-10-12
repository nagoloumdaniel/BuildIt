'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useDraft, useSession } from '../components/wizard/draft-provider';
import { ScreenShell } from '../components/wizard/shell';
import { downloadZip } from '../lib/download-zip';
import { useMessages } from '../lib/i18n/provider';
import { browserProjectStorage, loadProjects, type StoredProject } from '../lib/projects';
import { browserSessionStorage, type GenerationReport, loadReport } from './create/report/result';
import { DashboardView } from './dashboard-view';
import { useLocalProjectOpen } from './open/local-open';
import { SharedLink } from './shared-link';

/**
 * Écran 1 — Dashboard (§6.1, §18bis) : le branchement.
 *
 * Le contenu testable vit dans `dashboard-view.tsx` (Next interdit tout export
 * autre que `default` ici). Ce fichier ne fait que fournir le brouillon, la
 * session, le rapport de génération — et la liste des projets générés, lus en
 * `sessionStorage`/`localStorage`, donc **après hydratation**, jamais au
 * premier rendu serveur.
 *
 * Tant que la liste n'est pas lue, `DashboardView` reçoit `null` et dit qu'elle
 * lit — annoncer « aucun projet » puis afficher trois cartes serait un
 * mensonge, et un saut de mise en page.
 */
export default function Home(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [projects, setProjects] = useState<readonly StoredProject[] | null>(null);
  const openLocal = useLocalProjectOpen();

  useEffect(() => {
    setReport(loadReport(browserSessionStorage()));
    setProjects(loadProjects(browserProjectStorage()));
  }, []);

  /**
   * Le re-téléchargement n'est proposé que pour le projet dont l'archive est
   * encore en main : en local, le projet est sur le disque, il n'y a rien à
   * re-télécharger et le bouton disparaît plutôt que de mentir.
   */
  const isRedownloadable = (project: StoredProject): boolean =>
    report?.ok === true && report.zipBase64 !== undefined && report.directory === project.directory;

  return (
    <ScreenShell back={null} description={t.dashboard.description} title={t.dashboard.title}>
      <DashboardView
        draft={draft}
        isRedownloadable={isRedownloadable}
        openLocal={openLocal}
        onRedownloadProject={(project) => {
          if (report?.zipBase64 !== undefined) {
            downloadZip(report.zipBase64, project.name);
          }
        }}
        onReset={() => {
          session.reset();
        }}
        projects={projects}
        report={report}
        {...(report?.zipBase64 === undefined
          ? {}
          : {
              onRedownload: () => {
                if (report.zipBase64 !== undefined) {
                  downloadZip(report.zipBase64, draft.name);
                }
              },
            })}
      />

      {/* Le champ « lien partagé reçu » vit **dans** la page, pas dans une
          seconde coquille : deux `pf-shell` empilés doublaient le rembourrage
          bas et laissaient un vide de 150 px sous la dernière carte. Il utilise
          le routeur, mais les tests le simulent déjà (`page.test.ts`). */}
      <SharedLink />
    </ScreenShell>
  );
}

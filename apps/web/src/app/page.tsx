'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useDraft, useSession } from '../components/wizard/draft-provider';
import { ScreenShell } from '../components/wizard/shell';
import { downloadZip } from '../lib/download-zip';
import { browserSessionStorage, type GenerationReport, loadReport } from './create/report/result';
import { DashboardView } from './dashboard-view';
import { SharedLink } from './shared-link';

/**
 * Écran 1 — Dashboard (§6.1, §18bis) : le branchement.
 *
 * Le contenu testable vit dans `dashboard-view.tsx` (Next interdit tout export
 * autre que `default` ici). Ce fichier ne fait que fournir le brouillon, la
 * session, et le rapport de génération — lu en `sessionStorage`, donc après
 * hydratation, jamais au premier rendu serveur.
 */
export default function Home(): ReactElement {
  const draft = useDraft();
  const session = useSession();
  const [report, setReport] = useState<GenerationReport | null>(null);

  useEffect(() => {
    setReport(loadReport(browserSessionStorage()));
  }, []);

  return (
    <>
      <ScreenShell
        title="BuildIt"
        description="Décrivez un projet, obtenez un projet prêt à développer. Trois façons de commencer."
      >
        <DashboardView
          draft={draft}
          report={report}
          onReset={() => {
            session.reset();
          }}
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
      </ScreenShell>
      {/* Hors de `ScreenShell` : `SharedLink` utilise le routeur, que le
          rendu statique des tests ne monte pas. */}
      <div className="pf-shell pt-0">
        <SharedLink />
      </div>
    </>
  );
}

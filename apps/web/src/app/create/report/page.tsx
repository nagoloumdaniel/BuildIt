'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { StepShell } from '../../../components/wizard/shell';
import { ReportBody } from './ReportBody';
import { browserSessionStorage, type GenerationReport, loadReport } from './result';

/**
 * Generation Report (§6.14) — ce qui a été généré, avec erreurs et
 * avertissements.
 *
 * Le rapport vient de l'écran Generation par `sessionStorage` : c'est une
 * frontière non fiable, donc `loadReport` revalide la forme relue. Sans rapport
 * — onglet rouvert, session effacée — l'écran le dit et propose d'aller
 * générer ; il n'affiche pas un rapport vide qui aurait l'air valide.
 *
 * `nextStep('report')` est `null` : pas de « Continuer » après le rapport.
 */
export default function ReportPage() {
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReport(loadReport(browserSessionStorage()));
    setReady(true);
  }, []);

  return (
    <StepShell
      step="report"
      title="Rapport de génération"
      description="Ce qui a été écrit, les étapes terminées, les avertissements et les erreurs éventuelles."
    >
      {!ready ? (
        <p className="pf-hint" role="status">
          Lecture du rapport…
        </p>
      ) : report === null ? (
        <div>
          <p className="pf-hint">Aucun rapport de génération dans cette session.</p>
          <Link className="pf-btn mt-3" href="/create/generate">
            Aller à la génération
          </Link>
        </div>
      ) : (
        <div>
          <ReportBody report={report} />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link className="pf-btn" href="/create/generate">
              Revenir à la génération
            </Link>
            <Link className="pf-btn" href="/create/blueprint">
              Revoir le plan
            </Link>
          </div>
        </div>
      )}
    </StepShell>
  );
}

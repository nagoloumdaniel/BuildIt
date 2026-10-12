'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { downloadZip } from '../../../lib/download-zip';
import { useMessages } from '../../../lib/i18n/provider';
import { browserProjectStorage, isGithubUrl, loadProjects } from '../../../lib/projects';
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
 *
 * « Ouvrir sur GitHub » n'apparaît que si le projet **retenu** pour ce même
 * dossier porte une adresse de dépôt valide (`isGithubUrl`) : l'adresse n'est
 * jamais construite à partir du nom, qui mènerait chez un inconnu ou à une 404.
 */
export default function ReportPage() {
  const t = useMessages();
  const draft = useDraft();
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [ready, setReady] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loaded = loadReport(browserSessionStorage());
    setReport(loaded);
    // Une archive n'a pas de dossier : rien ne la relie à un projet retenu.
    if (loaded !== null && loaded.directory !== '') {
      const project = loadProjects(browserProjectStorage()).find(
        (item) => item.directory === loaded.directory,
      );
      setRepositoryUrl(isGithubUrl(project?.repositoryUrl) ? project?.repositoryUrl : undefined);
    }
    setReady(true);
  }, []);

  return (
    <StepShell
      step="report"
      title={t.build.report.title}
      description={t.build.report.description}
      hidePrevious={report?.ok === true}
    >
      {!ready ? (
        <LoadingLine>{t.build.report.loading}</LoadingLine>
      ) : report === null ? (
        <div>
          <p className="pf-hint">{t.build.report.missing}</p>
          <Link className="pf-btn mt-3" href="/create/generate">
            <Icon name="arrowRight" />
            {t.build.report.missingAction}
          </Link>
        </div>
      ) : (
        <ReportBody
          projectName={draft.name}
          report={report}
          technologies={draft.technologies}
          docker={draft.infra.docker}
          envVarNames={draft.envVarNames}
          {...(repositoryUrl === undefined ? {} : { repositoryUrl })}
          {...(report.zipBase64 === undefined
            ? {}
            : {
                onRedownload: () => {
                  if (report.zipBase64 !== undefined) {
                    downloadZip(report.zipBase64, draft.name);
                  }
                },
              })}
        />
      )}
    </StepShell>
  );
}

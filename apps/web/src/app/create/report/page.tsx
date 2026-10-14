'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { downloadZip } from '../../../lib/download-zip';
import { useMessages } from '../../../lib/i18n/provider';
import { browserProjectStorage, isGithubUrl, loadProjects } from '../../../lib/projects';
import { ReportBody } from './ReportBody';
import { browserSessionStorage, clearReport, type GenerationReport, loadReport } from './result';

/**
 * Generation Report (§6.14) ce qui a été généré, avec erreurs et
 * avertissements.
 *
 * Le rapport vient de l'écran Generation par `sessionStorage` : c'est une
 * frontière non fiable, donc `loadReport` revalide la forme relue. Sans rapport
 * onglet rouvert, session effacée l'écran le dit et propose d'aller
 * générer ; il n'affiche pas un rapport vide qui aurait l'air valide.
 *
 * `nextStep('report')` est `null` : pas de « Continuer » après le rapport.
 *
 * « Ouvrir sur GitHub » n'apparaît que si le projet **retenu** pour ce même
 * dossier porte une adresse de dépôt valide (`isGithubUrl`) : l'adresse n'est
 * jamais construite à partir du nom, qui mènerait chez un inconnu ou à une 404.
 *
 * Le projet retenu est aussi ce qui donne son **identifiant** au rapport : les
 * boutons « Architecture du projet » et « Graphe de dépendances » mènent aux
 * pages du projet (`?id=`), seules joignables une fois le parcours refermé.
 * Un rapport refusé n'a rien écrit : il n'en reçoit aucun.
 *
 * « Terminer » est la seule sortie : il range le rapport, remet le brouillon à
 * zéro (le projet verrouillé ne doit pas être repris comme un brouillon en
 * cours), puis recharge l'accueil **entièrement**, pour que la liste des
 * projets et le brouillon y soient relus plutôt que servis depuis le cache du
 * routeur. Le retour vers l'étape précédente est masqué dans tous les cas.
 */
export default function ReportPage() {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [ready, setReady] = useState(false);
  const [repositoryUrl, setRepositoryUrl] = useState<string | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const loaded = loadReport(browserSessionStorage());
    setReport(loaded);
    // Le rapport porte l'adresse du dépôt créé pendant la génération en
    // dossier. Sinon, on retombe sur la liste des projets : un projet
    // régénéré ailleurs peut avoir été connecté depuis l'écran Dépôt.
    const fromReport = isGithubUrl(loaded?.repositoryUrl) ? loaded?.repositoryUrl : undefined;
    // L'identifiant du projet écrit vit dans la liste, pas dans le rapport :
    // c'est `rememberProject` qui l'y a rangé à la génération. Le dossier est
    // la clé que les deux partagent quand la sortie a écrit un dossier ; une
    // sortie en archive n'écrit rien (dossier vide), et le nom est alors le
    // seul lien, la liste allant du plus récent au plus ancien. Un rapport
    // refusé n'a rien écrit : il n'a pas d'identifiant à désigner, même si ce
    // dossier porte déjà un projet d'une génération précédente.
    const directory = loaded?.ok === true ? loaded.directory : undefined;
    const written =
      directory === undefined
        ? undefined
        : loadProjects(browserProjectStorage()).find((item) =>
            directory === '' ? item.name === draft.name : item.directory === directory,
          );
    if (written !== undefined) {
      setProjectId(written.id);
    }
    if (fromReport !== undefined) {
      setRepositoryUrl(fromReport);
      setReady(true);
      return;
    }
    setRepositoryUrl(isGithubUrl(written?.repositoryUrl) ? written?.repositoryUrl : undefined);
    setReady(true);
    // Le nom ne change plus une fois le projet écrit : cette dépendance ne
    // relance pas la lecture du rapport, elle dit seulement ce que l'effet lit.
  }, [draft.name]);

  return (
    <StepShell
      step="report"
      title={t.build.report.title}
      description={t.build.report.description}
      hidePrevious
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
          {...(projectId === undefined ? {} : { projectId })}
          onFinish={() => {
            clearReport(browserSessionStorage());
            session.reset();
            window.location.assign('/');
          }}
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

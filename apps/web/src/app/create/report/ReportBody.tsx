import Link from 'next/link';
import type { ReactElement } from 'react';
import { IssueList, NoteList } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { ProjectFolder } from '../../../components/ui/project-export';
import { useLocale } from '../../../lib/i18n/provider';
import { isGithubUrl } from '../../../lib/projects';
import { formatBytes } from '../generate/steps';
import { FinishButton } from './finish-button';
import { InstallGuide } from './install-guide';
import { installSteps } from './install-steps';
import type { GenerationReport } from './result';

export interface ReportBodyProps {
  readonly report: GenerationReport;
  /** Ce que le brouillon porte encore — un refus doit permettre de le corriger. */
  readonly technologies: readonly string[];
  readonly docker: boolean;
  readonly envVarNames: readonly string[];
  /** Le nom du projet, tel que le brouillon le porte : un rapport dit ce qu'il décrit. */
  readonly projectName?: string;
  /** Absent si l'archive n'est plus en main (sortie en dossier : rien à re-télécharger). */
  readonly onRedownload?: () => void;
  /**
   * L'adresse du dépôt GitHub du projet, telle que la liste des projets l'a
   * retenue. Jamais devinée : sans elle, pas de bouton « Ouvrir sur GitHub ».
   */
  readonly repositoryUrl?: string;
  /**
   * Ce que fait « Terminer » (brouillon remis à zéro, retour à l'accueil).
   * Absent, pas de bouton : le rapport reste rendu sans effet de bord.
   */
  readonly onFinish?: () => void;
}

/**
 * Le rapport du §6.14 — il reçoit son rapport et ne relit rien : ni le
 * brouillon, ni le moteur. Seule la langue vient du contexte (`useLocale`),
 * parce que le poids en dépend.
 *
 * Il dit d'abord si la génération a réussi, puis où et combien, puis ce qui
 * doit alerter, puis comment reprendre le projet. La liste des fichiers n'y
 * est plus : l'architecture du projet a son propre écran (étape 10), et un
 * seul bouton y mène. Aucun lien vers l'accueil ici : la seule sortie d'un
 * projet réussi est « Terminer », qui range le brouillon avant d'y retourner.
 * Un refus n'a pas de « Terminer » : rien n'a été écrit, il reste à corriger.
 */
export function ReportBody({
  report,
  projectName,
  technologies,
  docker,
  envVarNames,
  onRedownload,
  repositoryUrl,
  onFinish,
}: ReportBodyProps): ReactElement {
  const { t, locale } = useLocale();
  const body = t.build.report;
  const o = t.output.report;
  const github = isGithubUrl(repositoryUrl) ? repositoryUrl : undefined;

  return (
    <div>
      <p className="flex flex-wrap items-center gap-2">
        {projectName === undefined || projectName === '' ? null : (
          <span className="pf-title-sm pf-mono">{projectName}</span>
        )}
        <span className={report.ok ? 'pf-badge pf-badge-ok' : 'pf-badge pf-badge-danger'}>
          {report.ok ? body.okBadge : body.refusedBadge}
        </span>
      </p>

      {report.directory === '' ? null : (
        // Un rapport avec un dossier vient toujours d'une écriture locale par le
        // serveur : le dossier est au registre, il peut s'ouvrir.
        <ProjectFolder className="mt-3" directory={report.directory} openable />
      )}

      {report.ok ? (
        <dl className="pf-grid mt-4">
          <div className="pf-card pf-card-pad">
            <dt className="pf-eyebrow">{body.filesCount}</dt>
            <dd className="pf-mono">{report.files.length}</dd>
          </div>
          <div className="pf-card pf-card-pad">
            <dt className="pf-eyebrow">{body.weight}</dt>
            <dd className="pf-mono">{formatBytes(report.bytes, locale)}</dd>
          </div>
        </dl>
      ) : null}

      {report.warnings.length === 0 ? null : (
        <section className="mt-5">
          <h3 className="pf-label">{body.warningsTitle}</h3>
          <NoteList className="mt-1" notes={report.warnings} />
        </section>
      )}

      {!report.ok || report.issues.length === 0 ? null : (
        <section className="mt-5">
          <h3 className="pf-label">{body.issuesTitle}</h3>
          <IssueList className="mt-1" issues={report.issues} />
        </section>
      )}

      {report.ok ? null : (
        <section className="mt-5">
          <ErrorState
            title={body.refusalTitle}
            body={body.refusalBody}
            issues={report.issues}
            actions={
              <Link className="pf-btn" href="/create/stack">
                <Icon name="layers" />
                {body.fixStack}
              </Link>
            }
          />

          <div className="mt-3 min-w-0">
            <p className="pf-label">{body.technologiesTitle}</p>
            {technologies.length === 0 ? (
              <p className="pf-hint">{body.none}</p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-2">
                {technologies.map((id) => (
                  <span key={id} className="pf-badge pf-mono break-all">
                    {id}
                  </span>
                ))}
              </p>
            )}
          </div>
        </section>
      )}

      {!report.ok ? null : (
        <section className="mt-5">
          <h3 className="pf-label">{body.installationTitle}</h3>
          <p className="pf-hint">{body.installationNote}</p>
          <p className="pf-hint mt-1">{o.installWhere}</p>
          {report.installed === true ? <p className="pf-hint mt-1">{o.installedNote}</p> : null}
          <InstallGuide
            className="mt-3"
            steps={installSteps(
              {
                directory: report.directory,
                docker,
                envVarNames,
                ...(report.installed === undefined ? {} : { installed: report.installed }),
              },
              t,
            )}
            what={body.commandWhat}
          />
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!report.ok || onFinish === undefined ? null : <FinishButton onFinish={onFinish} />}
        <Link className="pf-btn" href="/create/preview">
          <Icon name="layers" />
          {o.architecture}
        </Link>
        {!report.ok ? null : github !== undefined ? (
          <a
            aria-label={o.openGithubLabel}
            className="pf-btn"
            href={github}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon name="github" />
            {o.openGithub}
            <Icon name="externalLink" size={14} />
          </a>
        ) : report.directory === '' ? null : (
          <Link className="pf-btn" href="/repo">
            <Icon name="github" />
            {body.connectGithub}
          </Link>
        )}
        {!report.ok || report.zipBase64 === undefined || onRedownload === undefined ? null : (
          <button type="button" className="pf-btn" onClick={onRedownload}>
            <Icon name="download" />
            {body.download}
          </button>
        )}
      </div>
    </div>
  );
}

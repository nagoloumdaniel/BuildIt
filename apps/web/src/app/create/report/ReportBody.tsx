import Link from 'next/link';
import type { ReactElement } from 'react';
import { CommandLine, CommandSteps } from '../../../components/ui/copy';
import { IssueList, NoteList } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { useLocale } from '../../../lib/i18n/provider';
import { formatBytes, stepLabel } from '../generate/steps';
import { installSteps } from './install-steps';
import type { GenerationReport } from './result';

export interface ReportBodyProps {
  readonly report: GenerationReport;
  /** Ce que le brouillon porte encore — un refus doit permettre de le corriger. */
  readonly technologies: readonly string[];
  readonly docker: boolean;
  readonly envVarNames: readonly string[];
  /** Absent si l'archive n'est plus en main (mode local : rien à re-télécharger). */
  readonly onRedownload?: () => void;
}

/**
 * Le rapport du §6.14 — il reçoit son rapport et ne relit rien : ni le
 * brouillon, ni le moteur. Seule la langue vient du contexte (`useLocale`),
 * parce que le poids et les libellés d'étape en dépendent.
 *
 * Il dit d'abord si la génération a réussi, puis ce qui a été écrit, puis ce
 * qui doit alerter : avertissements, puis problèmes. Un refus n'affiche pas une
 * liste de fichiers vide comme si c'était un succès : « Aucun fichier écrit »
 * est une phrase, pas une case blanche — et il propose de corriger les
 * technologies sans perdre le brouillon.
 */
export function ReportBody({
  report,
  technologies,
  docker,
  envVarNames,
  onRedownload,
}: ReportBodyProps): ReactElement {
  const { t, locale } = useLocale();
  const body = t.build.report;
  const stepLabels = t.build.generate.steps;
  const steps = report.steps;

  return (
    <div>
      <p className="flex flex-wrap items-center gap-2">
        <span className={report.ok ? 'pf-badge pf-badge-ok' : 'pf-badge pf-badge-danger'}>
          {report.ok ? body.okBadge : body.refusedBadge}
        </span>
      </p>

      {report.directory === '' ? null : (
        <CommandLine className="mt-3" value={report.directory} what={body.directoryWhat} />
      )}

      <dl className="pf-grid mt-4">
        <div className="pf-card pf-card-pad">
          <dt className="pf-eyebrow">{body.filesCount}</dt>
          <dd>{report.files.length}</dd>
        </div>
        <div className="pf-card pf-card-pad">
          <dt className="pf-eyebrow">{body.weight}</dt>
          <dd>{formatBytes(report.bytes, locale)}</dd>
        </div>
        <div className="pf-card pf-card-pad">
          <dt className="pf-eyebrow">{body.stepsTitle}</dt>
          <dd>
            {steps.length === 0
              ? body.noSteps
              : steps.map((step) => stepLabel(step, stepLabels)).join(', ')}
          </dd>
        </div>
      </dl>

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
              <>
                <Link className="pf-btn" href="/create/stack">
                  <Icon name="layers" />
                  {body.fixStack}
                </Link>
                <Link className="pf-btn pf-btn-ghost" href="/">
                  <Icon name="home" />
                  {body.backHome}
                </Link>
              </>
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
          <CommandSteps
            className="mt-3"
            steps={installSteps({ directory: report.directory, docker, envVarNames }, t)}
            what={body.commandWhat}
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {report.zipBase64 === undefined || onRedownload === undefined ? null : (
              <button type="button" className="pf-btn" onClick={onRedownload}>
                <Icon name="download" />
                {body.download}
              </button>
            )}
            {report.directory === '' ? null : (
              <Link className="pf-btn" href="/repo">
                <Icon name="github" />
                {body.connectGithub}
              </Link>
            )}
            <Link className="pf-btn pf-btn-ghost" href="/">
              <Icon name="home" />
              {body.backHome}
            </Link>
          </div>
        </section>
      )}

      <section className="mt-5">
        <h3 className="pf-label">{body.filesTitle}</h3>
        {report.files.length === 0 ? (
          <p className="pf-hint">{body.noFiles}</p>
        ) : (
          <ul className="pf-mono mt-1 list-none p-0">
            {report.files.map((file) => (
              <li key={file} className="break-all">
                {file}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { ReactElement } from 'react';
import { formatBytes, stepLabel } from '../generate/steps';
import type { GenerationReport } from './result';

export interface ReportBodyProps {
  readonly report: GenerationReport;
}

/**
 * Le rapport du §6.14 — un composant **pur** : il reçoit son rapport, il ne
 * relit rien. Il dit d'abord si la génération a réussi, puis ce qui a été écrit,
 * puis ce qui doit alerter : avertissements, puis problèmes.
 *
 * Un refus n'affiche pas une liste de fichiers vide comme si c'était un succès :
 * « Aucun fichier écrit » est une phrase, pas une case blanche.
 */
export function ReportBody({ report }: ReportBodyProps): ReactElement {
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2">
        <span className={report.ok ? 'pf-badge pf-badge-ok' : 'pf-badge pf-badge-danger'}>
          {report.ok ? 'Réussi' : 'Refusé'}
        </span>
        {report.directory === '' ? null : <span className="pf-mono">{report.directory}</span>}
      </p>

      <dl className="pf-grid mt-4">
        <div className="pf-card pf-card-pad">
          <dt className="pf-eyebrow">Fichiers écrits</dt>
          <dd>{report.files.length}</dd>
        </div>
        <div className="pf-card pf-card-pad">
          <dt className="pf-eyebrow">Poids</dt>
          <dd>{formatBytes(report.bytes)}</dd>
        </div>
        <div className="pf-card pf-card-pad">
          <dt className="pf-eyebrow">Étapes</dt>
          <dd>
            {report.steps.length === 0
              ? 'Aucune'
              : report.steps.map((step) => stepLabel(step)).join(', ')}
          </dd>
        </div>
      </dl>

      {report.warnings.length === 0 ? null : (
        <section className="mt-5">
          <h3 className="pf-label">Avertissements</h3>
          <ul className="mt-1 list-disc pl-5">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {report.issues.length === 0 ? null : (
        <section className="mt-5">
          <h3 className="pf-label">Problèmes</h3>
          <ul className="pf-error mt-1 list-disc pl-5">
            {report.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h3 className="pf-label">Fichiers</h3>
        {report.files.length === 0 ? (
          <p className="pf-hint">Aucun fichier écrit.</p>
        ) : (
          <ul className="pf-mono mt-1 list-none p-0">
            {report.files.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

'use client';

import type { ReactElement } from 'react';
import { Icon } from '../../components/ui/icon';
import { Spinner } from '../../components/ui/loading';
import { useMessages } from '../../lib/i18n/provider';
import type { BaseFilesResult, BaseFilesView } from './local-open';

/**
 * Les dossiers et fichiers de base manquants d'un projet ouvert : la même
 * arborescence qu'un projet généré, sans jamais toucher un fichier présent.
 */
export interface BasePanelProps {
  readonly base: BaseFilesView;
  readonly busy: boolean;
  readonly result: BaseFilesResult | null;
  readonly onApply: () => void;
}

const SHOWN = 12;

export function BasePanel({ base, busy, result, onApply }: BasePanelProps): ReactElement {
  const t = useMessages();
  const count = base.missing.length;
  return (
    <section className="pf-card pf-card-pad mt-3" data-base-files="">
      <h2 className="pf-label">{t.open.baseTitle}</h2>
      <p className="pf-hint mt-1">
        {t.open.baseShape(base.shape.architecture, base.shape.source === 'manifest')}
      </p>
      {count === 0 ? (
        <p className="pf-hint mt-2" data-base-count="0">
          {t.open.baseNone}
        </p>
      ) : (
        <>
          <p className="mt-2" data-base-count={count}>
            {t.open.baseMissing(count)}
          </p>
          <ul className="pf-hint mt-2" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
            {base.missing.slice(0, SHOWN).map((file) => (
              <li key={file.path}>{file.path}</li>
            ))}
            {count > SHOWN ? <li>… +{count - SHOWN}</li> : null}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="pf-btn" disabled={busy} onClick={onApply} type="button">
              <Icon name={base.delivery === 'zip' ? 'download' : 'folderOpen'} size={15} />
              {base.delivery === 'zip' ? t.open.baseDownload : t.open.baseWrite}
            </button>
            {busy ? (
              <span className="pf-hint flex items-center gap-2" role="status">
                <Spinner size="sm" />
                {t.open.baseWriting}
              </span>
            ) : null}
          </div>
          {base.delivery === 'zip' ? <p className="pf-hint mt-2">{t.open.baseZipNote}</p> : null}
        </>
      )}
      {result === null ? null : (
        <p
          aria-live="polite"
          className={
            result.kind === 'failed' ? 'pf-callout mt-3' : 'pf-callout pf-callout-steel mt-3'
          }
          role="status"
        >
          {result.kind === 'written'
            ? t.open.baseWritten(result.count)
            : result.kind === 'zip'
              ? t.open.baseZipped(result.count)
              : `${t.open.baseFailed} : ${result.detail}`}
        </p>
      )}
    </section>
  );
}

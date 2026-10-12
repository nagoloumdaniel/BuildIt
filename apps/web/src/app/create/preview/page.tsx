'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { useMessages } from '../../../lib/i18n/provider';
import { previewManifestAction } from '../../actions';
import { FileTree } from './FileTree';
import { buildFileTree, countFiles } from './tree';

interface PreviewState {
  readonly files: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * File Preview (§6.12).
 *
 * `previewManifestAction` est un **dry-run** du §22 : il rend le plan, donc la
 * liste des chemins, et les avertissements. Il ne fournit pas le contenu des
 * fichiers — l'écran le dit et n'en invente aucun ; montrer un contenu fabriqué
 * serait pire que ne rien montrer.
 *
 * L'arborescence est dérivée des chemins par `buildFileTree`, une fonction pure
 * testée : fichiers plats, imbriqués, tri stable.
 */
export default function PreviewPage() {
  const t = useMessages();
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!manifest.ok) {
      setPreview(null);
      return;
    }
    const value = manifest.value;
    let alive = true;
    setPreview(null);
    void previewManifestAction(value)
      .then((result) => {
        if (alive) {
          setPreview({ files: result.files, warnings: result.warnings });
        }
      })
      .catch(() => {
        if (alive) {
          setPreview({ files: [], warnings: [t.build.preview.planFailed] });
        }
      });
    return () => {
      alive = false;
    };
  }, [manifest, t]);

  const tree = useMemo(() => buildFileTree(preview?.files ?? []), [preview]);
  const fileCount = useMemo(() => countFiles(tree), [tree]);

  if (!manifest.ok) {
    return (
      <StepShell
        step="preview"
        title={t.build.preview.title}
        description={t.build.preview.descriptionIncomplete}
      >
        <ErrorState
          title={t.build.preview.incompleteTitle}
          body={t.build.preview.incompleteBody}
          issues={manifest.issues.map((issue) => issue.message)}
          actions={
            <>
              <Link className="pf-btn" href="/create/stack">
                <Icon name="layers" />
                {t.build.preview.fixStack}
              </Link>
              <Link className="pf-btn pf-btn-ghost" href="/">
                <Icon name="home" />
                {t.build.preview.backHome}
              </Link>
            </>
          }
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      step="preview"
      title={t.build.preview.title}
      description={t.build.preview.description}
    >
      {preview === null ? (
        <LoadingLine>{t.build.preview.loading}</LoadingLine>
      ) : (
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="pf-badge pf-badge-accent">{t.build.preview.dryRun}</span>
            <span>{t.build.preview.files(fileCount)}</span>
          </p>

          <p className="pf-hint mt-2">{t.build.preview.hint}</p>

          {preview.warnings.length === 0 ? null : (
            <section className="mt-4">
              <h2 className="pf-label">{t.build.preview.warningsTitle}</h2>
              <ul className="mt-1 list-disc break-words pl-5">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="pf-card pf-card-pad mt-4">
            <h2 className="pf-label">{t.build.preview.treeTitle}</h2>
            <div className="mt-2">
              <FileTree nodes={tree} />
            </div>
          </section>
        </div>
      )}
    </StepShell>
  );
}

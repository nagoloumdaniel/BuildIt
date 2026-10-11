'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { draftToManifest } from '../../../lib/draft-to-manifest';
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
          setPreview({ files: [], warnings: ['Le plan n’a pas pu être calculé.'] });
        }
      });
    return () => {
      alive = false;
    };
  }, [manifest]);

  const tree = useMemo(() => buildFileTree(preview?.files ?? []), [preview]);
  const fileCount = useMemo(() => countFiles(tree), [tree]);

  if (!manifest.ok) {
    return (
      <StepShell
        step="preview"
        title="Aperçu des fichiers"
        description="L’arborescence qui sera générée — sans rien écrire."
      >
        <div className="pf-card pf-card-pad">
          <p className="pf-error" role="status">
            Le brouillon est incomplet : il n’y a rien à prévisualiser.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {manifest.issues.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="preview"
      title="Aperçu des fichiers"
      description="L’arborescence qui sera générée — sans rien écrire. Un dry-run du moteur."
    >
      {preview === null ? (
        <p className="pf-hint" role="status">
          Calcul du plan…
        </p>
      ) : (
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className="pf-badge pf-badge-accent">Dry-run</span>
            <span>
              {fileCount} fichier{fileCount > 1 ? 's' : ''}
            </span>
          </p>

          <p className="pf-hint mt-2">
            Le plan expose les chemins, pas le contenu des fichiers : rien n’est affiché ici qui ne
            vienne réellement du moteur.
          </p>

          {preview.warnings.length === 0 ? null : (
            <section className="mt-4">
              <h2 className="pf-label">Avertissements du plan</h2>
              <ul className="mt-1 list-disc pl-5">
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="pf-card pf-card-pad mt-4">
            <h2 className="pf-label">Arborescence</h2>
            <div className="mt-2">
              <FileTree nodes={tree} />
            </div>
          </section>
        </div>
      )}
    </StepShell>
  );
}

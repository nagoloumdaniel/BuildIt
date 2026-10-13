'use client';

import type { Manifest } from '@buildit/manifest';
import { type ReactElement, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { previewManifestAction } from '../../app/actions';
import {
  type ArchitectureNode,
  buildArchitecture,
  directoryPaths,
  initiallyOpen,
} from '../../lib/architecture-notes';
import { useMessages } from '../../lib/i18n/provider';
import { EmptyState, NoteList } from './empty-state';
import { ErrorState } from './error-state';
import { Icon } from './icon';
import { LoadingLine } from './loading';

/**
 * L'architecture d'un projet : l'arbre des fichiers que le moteur produit, et
 * le rôle de chacun.
 *
 * Deux écrans la montrent, pour deux moments : l'étape 10 du parcours (le
 * brouillon, avant d'écrire) et `/projects/architecture` (un projet déjà
 * généré, recalculé depuis son manifest). Le même composant sert les deux :
 * un même manifest doit se lire pareil avant et après la génération.
 *
 * Les fichiers viennent de `previewManifestAction`, un dry-run du §22 : rien
 * n'est écrit, et le contenu des fichiers n'est ni fourni ni inventé. Les
 * phrases viennent de la base de `lib/architecture-notes.ts`.
 */

export type ArchitectureStatus =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | {
      readonly kind: 'ready';
      readonly files: readonly string[];
      readonly warnings: readonly string[];
    };

export interface ProjectArchitectureProps {
  readonly manifest: Manifest;
}

/** Le branchement : lance le dry-run, puis délègue l'affichage à `ArchitectureView`. */
export function ProjectArchitecture({ manifest }: ProjectArchitectureProps): ReactElement {
  const [status, setStatus] = useState<ArchitectureStatus>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // `attempt` relance le calcul : « Réessayer » n'a pas d'autre effet.
    void attempt;
    let alive = true;
    setStatus({ kind: 'loading' });
    void previewManifestAction(manifest)
      .then((result) => {
        if (alive) {
          setStatus({ kind: 'ready', files: result.files, warnings: result.warnings });
        }
      })
      .catch(() => {
        if (alive) {
          setStatus({ kind: 'failed' });
        }
      });
    return () => {
      alive = false;
    };
  }, [manifest, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return <ArchitectureView onRetry={retry} rootName={manifest.name} status={status} />;
}

export interface ArchitectureViewProps {
  readonly status: ArchitectureStatus;
  readonly onRetry?: () => void;
  /**
   * Le nom du projet, posé en racine de l'arbre : tout part de lui, comme le
   * dossier que le moteur écrira. Sans nom, les entrées du premier niveau sont
   * leurs propres racines, sans filet.
   */
  readonly rootName?: string;
}

/**
 * Les quatre issues d'un calcul, chacune avec sa forme : on attend, le moteur
 * n'a pas répondu, le moteur refuse (ses raisons telles quelles), le plan est
 * vide, ou l'arbre.
 *
 * Un plan refusé arrive comme un plan **vide avec avertissements** : le
 * contrat du dry-run n'a qu'un canal (`warnings`), et c'est le seul cas où le
 * moteur ne rend aucun fichier tout en ayant quelque chose à dire.
 */
export function ArchitectureView({
  status,
  onRetry,
  rootName,
}: ArchitectureViewProps): ReactElement {
  const t = useMessages();

  if (status.kind === 'loading') {
    return <LoadingLine>{t.architecture.loading}</LoadingLine>;
  }

  if (status.kind === 'failed') {
    return (
      <ErrorState
        actions={
          onRetry === undefined ? undefined : (
            <button className="pf-btn" onClick={onRetry} type="button">
              <Icon name="refresh" />
              {t.architecture.retry}
            </button>
          )
        }
        body={t.architecture.failedBody}
        title={t.architecture.failedTitle}
      />
    );
  }

  if (status.files.length === 0) {
    return status.warnings.length > 0 ? (
      <ErrorState
        body={t.architecture.refusedBody}
        issues={status.warnings}
        title={t.architecture.refusedTitle}
      />
    ) : (
      <EmptyState
        body={t.architecture.emptyBody}
        icon="folderTree"
        title={t.architecture.emptyTitle}
      />
    );
  }

  // La clé remet l'ouverture des dossiers à zéro quand le plan change : un
  // dossier ouvert qui n'existe plus ne doit pas rester dans l'état.
  return (
    <ArchitecturePanel
      files={status.files}
      key={status.files.join('\n')}
      rootName={rootName}
      warnings={status.warnings}
    />
  );
}

function ArchitecturePanel({
  files,
  warnings,
  rootName,
}: {
  readonly files: readonly string[];
  readonly warnings: readonly string[];
  readonly rootName: string | undefined;
}): ReactElement {
  const t = useMessages();
  const baseId = useId();
  const tree = useMemo(() => buildArchitecture(files), [files]);
  const directories = useMemo(() => directoryPaths(tree), [tree]);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => initiallyOpen(tree));
  const total = tree.reduce((sum, node) => sum + node.fileCount, 0);
  const allOpen = directories.every((path) => open.has(path));
  const hasRoot = rootName !== undefined && rootName !== '';

  // Un identifiant par dossier, pour `aria-controls` : dérivé de l'ordre de
  // l'arbre, pas du chemin, qui peut contenir `[`, `.` ou `…`.
  const ids = useMemo(
    () => new Map(directories.map((path, index) => [path, `${baseId}-${index}`])),
    [directories, baseId],
  );

  const toggle = useCallback((path: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setOpen(allOpen ? new Set() : new Set(directories));
  }, [allOpen, directories]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2">
          <span className="pf-badge pf-badge-accent">{t.architecture.dryRun}</span>
          <span className="pf-mono">{t.architecture.files(total)}</span>
        </p>
        {directories.length === 0 ? null : (
          <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={toggleAll} type="button">
            <Icon name={allOpen ? 'minus' : 'plus'} size={14} />
            {allOpen ? t.architecture.collapseAll : t.architecture.expandAll}
          </button>
        )}
      </div>

      {warnings.length === 0 ? null : (
        <section className="mt-4">
          <h2 className="pf-label">{t.architecture.warningsTitle}</h2>
          <NoteList className="mt-1" notes={warnings} />
        </section>
      )}

      {/* Avec un nom de projet, l'arbre a une vraie racine : le premier niveau
          s'y accroche par les mêmes filets que les niveaux suivants, et le
          dessin se lit comme le dossier écrit sur le disque. */}
      <section className="pf-card pf-card-pad pf-arch mt-4">
        {hasRoot ? (
          <div className="pf-arch-row pf-arch-root">
            <span className="pf-arch-head pf-arch-lead">
              <Icon className="pf-arch-icon pf-arch-icon-folder" name="folderOpen" size={16} />
              <span className="pf-mono pf-arch-name">{rootName}/</span>
              <span className="pf-mono pf-arch-count">{t.architecture.files(total)}</span>
            </span>
          </div>
        ) : null}
        <ul
          aria-label={t.architecture.treeLabel}
          className={hasRoot ? 'pf-arch-tree pf-arch-children' : 'pf-arch-tree'}
        >
          <Branch ids={ids} nodes={tree} onToggle={toggle} open={open} />
        </ul>
      </section>
    </div>
  );
}

interface BranchProps {
  readonly nodes: readonly ArchitectureNode[];
  readonly open: ReadonlySet<string>;
  readonly ids: ReadonlyMap<string, string>;
  readonly onToggle: (path: string) => void;
}

/**
 * Les branches se dessinent en CSS (`architecture.css`) : chaque niveau a son
 * tronc vertical, chaque enfant son coude, et le dernier ferme le tronc en
 * « └ ». Le balisage reste une liste : les filets sont de la décoration, la
 * structure est dans l'imbrication des `<ul>`.
 *
 * Une liste imbriquée plutôt qu'un `role="tree"` : un arbre ARIA promet la
 * navigation aux flèches, et une promesse à moitié tenue est pire qu'une liste
 * honnête. Chaque dossier est un bouton qui dit son état (`aria-expanded`) et
 * désigne sa branche (`aria-controls`) ; la tabulation suffit pour tout ouvrir.
 *
 * Une branche repliée reste dans le document, `hidden` : `aria-controls`
 * désigne toujours un élément existant.
 */
function Branch({ nodes, open, ids, onToggle }: BranchProps): ReactElement {
  const t = useMessages();
  return (
    <>
      {nodes.map((node) => {
        const note =
          node.note === undefined ? null : (
            <span className="pf-arch-note">{t.architecture.notes[node.note]}</span>
          );

        if (node.kind === 'file') {
          return (
            <li className="pf-arch-node" key={node.path}>
              <div className="pf-arch-row">
                <span className="pf-arch-head pf-arch-lead">
                  <Icon className="pf-arch-icon" name="file" size={16} />
                  <span className="pf-mono pf-arch-name">{node.name}</span>
                </span>
                {note}
              </div>
            </li>
          );
        }

        const expanded = open.has(node.path);
        const id = ids.get(node.path);
        return (
          <li className="pf-arch-node" key={node.path}>
            <div className="pf-arch-row">
              <span className="pf-arch-head">
                <button
                  aria-controls={id}
                  aria-expanded={expanded}
                  className="pf-arch-toggle"
                  onClick={() => onToggle(node.path)}
                  type="button"
                >
                  <Icon className="pf-arch-chevron" name="chevronRight" size={12} />
                  <Icon
                    className="pf-arch-icon pf-arch-icon-folder"
                    name={expanded ? 'folderOpen' : 'folder'}
                    size={16}
                  />
                  <span className="pf-mono pf-arch-name">{node.name}/</span>
                </button>
                <span className="pf-mono pf-arch-count">
                  {t.architecture.files(node.fileCount)}
                </span>
              </span>
              {note}
            </div>
            <ul className="pf-arch-children" hidden={!expanded} id={id}>
              <Branch ids={ids} nodes={node.children} onToggle={onToggle} open={open} />
            </ul>
          </li>
        );
      })}
    </>
  );
}

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
import { loadGraphAction } from '../../actions';
import { shareLinkBaseAction } from '../../actions-share';
import { encodeShareLink, shareOrigin } from '../../share/codec';
import { BlueprintSummary } from './BlueprintSummary';
import { blueprintView, manifestTechnologyIds } from './summary';

/**
 * Project Blueprint (§6.10) — le résumé du manifest canonique.
 *
 * Le manifest vient de `draftToManifest` : c'est **le même** convertisseur que le
 * CLI, donc le résumé décrit le projet qui sera réellement généré. Les noms
 * lisibles viennent du catalogue, par `loadGraphAction` — le navigateur ne
 * charge jamais le catalogue lui-même. Un identifiant non nommé s'affiche tel
 * quel : l'écran n'invente pas de nom.
 *
 * Le Dependency Graph s'ouvre d'ici, mais **ne s'impose pas** : c'est un lien,
 * pas une étape de la progression (§6.11).
 */
export default function BlueprintPage() {
  const t = useMessages();
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [status, setStatus] = useState<'certified' | 'experimental' | null>(null);
  const [catalogueIssue, setCatalogueIssue] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const technologyIds = useMemo(
    () => (manifest.ok ? [...manifestTechnologyIds(manifest.value)] : []),
    [manifest],
  );

  useEffect(() => {
    if (!manifest.ok) {
      setCatalogueIssue(null);
      return;
    }
    const value = manifest.value;
    let alive = true;
    setCatalogueIssue(null);
    void loadGraphAction({ targets: value.targets, technologies: technologyIds })
      .then((graph) => {
        if (!alive) {
          return;
        }
        setLabels(new Map(graph.nodes.map((node) => [node.id, node.label])));
        setStatus(graph.status);
      })
      .catch(() => {
        if (alive) {
          setCatalogueIssue(t.build.blueprint.catalogueIssue);
        }
      });
    return () => {
      alive = false;
    };
  }, [manifest, technologyIds, t]);

  const view = useMemo(
    () => (manifest.ok ? blueprintView(manifest.value, labels, t) : null),
    [manifest, labels, t],
  );

  /**
   * Le lien de partage (§20) : la configuration est encodée dans le fragment,
   * donc rien n'est envoyé au serveur — le serveur ne fournit que l'origine
   * publique, quand elle est configurée (Phase 12). Un presse-papiers
   * inaccessible n'empêche pas le lien d'exister : il reste affiché.
   */
  async function createShareLink(): Promise<void> {
    if (!manifest.ok) {
      return;
    }
    const base = await shareLinkBaseAction().catch(() => '');
    const link = encodeShareLink(manifest.value, shareOrigin(base, window.location.origin));
    setShareLink(link);
    try {
      await navigator.clipboard.writeText(link);
      setShareNote(t.build.blueprint.shareCopied);
    } catch {
      setShareNote(t.build.blueprint.shareManual);
    }
  }

  if (!manifest.ok || view === null) {
    return (
      <StepShell
        step="blueprint"
        title={t.build.blueprint.title}
        description={t.build.blueprint.descriptionIncomplete}
      >
        <ErrorState
          title={t.build.blueprint.incompleteTitle}
          body={t.build.blueprint.incompleteBody}
          issues={manifest.ok ? [] : manifest.issues.map((issue) => issue.message)}
          actions={
            <>
              <Link className="pf-btn" href="/create/stack">
                <Icon name="layers" />
                {t.build.blueprint.fixStack}
              </Link>
              <Link className="pf-btn pf-btn-ghost" href="/">
                <Icon name="home" />
                {t.build.blueprint.backHome}
              </Link>
            </>
          }
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      step="blueprint"
      title={t.build.blueprint.title}
      description={t.build.blueprint.description}
    >
      <BlueprintSummary view={view} />

      {status === null ? (
        <LoadingLine className="mt-3">{t.build.blueprint.statusChecking}</LoadingLine>
      ) : (
        <p className="pf-hint mt-3">
          {status === 'certified'
            ? t.build.blueprint.statusCertified
            : t.build.blueprint.statusExperimental}
        </p>
      )}
      {catalogueIssue === null ? null : (
        <p className="pf-hint break-words" role="status">
          {catalogueIssue}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link className="pf-btn" href="/graph">
          <Icon name="gitBranch" />
          {t.build.blueprint.graphLink}
        </Link>
        <button
          type="button"
          className="pf-btn"
          onClick={() => void createShareLink()}
          {...(shareLink === null ? { 'aria-describedby': 'pf-share-note' } : {})}
        >
          <Icon name="link" />
          {t.build.blueprint.shareButton}
        </button>
      </div>

      {shareLink === null ? (
        <p id="pf-share-note" className="pf-hint mt-2">
          {t.build.blueprint.shareHintBefore} <code>pf web</code> {t.build.blueprint.shareHintAfter}
        </p>
      ) : (
        <div className="mt-3 min-w-0">
          <label className="pf-label" htmlFor="pf-share-link">
            {t.build.blueprint.shareLinkLabel}
          </label>
          <input
            id="pf-share-link"
            className="pf-input pf-mono"
            readOnly
            value={shareLink}
            onFocus={(event) => event.currentTarget.select()}
          />
          {shareNote === null ? null : (
            <p className="pf-hint mt-1" role="status">
              {shareNote}
            </p>
          )}
        </div>
      )}
    </StepShell>
  );
}

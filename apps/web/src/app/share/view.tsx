'use client';

import { badgeClassName, buttonClassName, StatusMessage } from '@buildit/ui';
import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/ui/card';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine } from '../../components/ui/loading';
import { ScreenShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { loadGraphAction } from '../actions';
import { BlueprintSummary } from '../create/blueprint/BlueprintSummary';
import { blueprintView, manifestTechnologyIds } from '../create/blueprint/summary';
import { decodeSharePayload, payloadFromHash, type ShareDecodeResult } from './codec';

/**
 * La page de partage en lecture seule (§20).
 *
 * Elle ne fait que **montrer** : pas d'édition, pas de génération, pas d'appel
 * qui modifie quoi que ce soit. Le manifest vient du fragment de l'URL — jamais
 * du serveur —, donc le rendu a lieu côté navigateur : le serveur ne voit ni le
 * payload, ni son contenu.
 *
 * Le résumé est celui du Blueprint : `BlueprintSummary` et `blueprintView` sont
 * réutilisés tels quels. Un lien partagé montre donc **exactement** ce que
 * l'auteur du lien voyait, sans second rendu à maintenir.
 *
 * Tout le texte passe par `useMessages()` ; ne restent affichés tels quels que
 * les refus du décodeur, qui sont les mêmes phrases pour tous les liens.
 */

/** Ce que la page affiche en attendant d'avoir lu le fragment. */
function ShareLoading(): ReactElement {
  const t = useMessages();
  return (
    <ScreenShell description={t.share.descriptionLoading} icon="send" title={t.share.title}>
      <Card>
        <LoadingLine>{t.share.loading}</LoadingLine>
      </Card>
    </ScreenShell>
  );
}

export interface SharePreviewProps {
  readonly result: ShareDecodeResult;
  /** Les noms lisibles des technologies, lus dans le catalogue par le serveur. */
  readonly labels: ReadonlyMap<string, string>;
  /** Vrai tant que le catalogue n'a pas répondu : le résumé reste lisible sans lui. */
  readonly loadingLabels?: boolean;
}

/**
 * Le rendu d'un lien : le Blueprint, ou la raison du refus.
 *
 * Pure : elle reçoit un résultat déjà décodé. Un lien illisible rend une phrase
 * — jamais une pile, jamais une invite à « réessayer » sans dire quoi corriger.
 */
export function SharePreview({
  result,
  labels,
  loadingLabels = false,
}: SharePreviewProps): ReactElement {
  const t = useMessages();

  if (!result.ok) {
    return (
      <ScreenShell description={t.share.descriptionLoading} icon="send" title={t.share.title}>
        <ErrorState
          actions={
            <a className={buttonClassName('primary')} href="/">
              <Icon name="home" />
              {t.share.backHome}
            </a>
          }
          body={t.share.invalidBody}
          issues={result.issues}
          title={t.share.invalidTitle}
        />
        <p className="pf-hint mt-3">
          {t.share.invalidHint} <a href="/">{t.share.invalidHomeWord}</a>.
        </p>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell description={t.share.description} icon="send" title={t.share.title}>
      <Card>
        <p className={badgeClassName()}>{t.share.readOnly}</p>
        <div className="mt-3">
          <BlueprintSummary view={blueprintView(result.value, labels, t)} />
        </div>
      </Card>

      <StatusMessage className="mt-3">{t.share.privacy}</StatusMessage>

      {loadingLabels ? (
        <LoadingLine className="mt-2">{t.share.readingCatalogue}</LoadingLine>
      ) : null}

      <nav aria-label={t.share.nextLabel} className="mt-4 flex flex-wrap items-center gap-3">
        <a className={buttonClassName()} href="/">
          <Icon name="home" />
          {t.share.homeLink}
        </a>
      </nav>
    </ScreenShell>
  );
}

export interface ShareViewProps {
  /**
   * Le fragment, injecté pour que la vue soit testable sans DOM. En vrai, il est
   * lu sur `window.location` : c'est la seule copie de la charge, et elle ne
   * quitte pas le navigateur.
   */
  readonly hash?: string | undefined;
}

export function ShareView({ hash }: ShareViewProps): ReactElement {
  const [fragment, setFragment] = useState<string | null>(hash === undefined ? null : hash);

  useEffect(() => {
    if (hash !== undefined) {
      return;
    }
    const read = (): void => {
      setFragment(window.location.hash);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => {
      window.removeEventListener('hashchange', read);
    };
  }, [hash]);

  const result = useMemo(
    () => (fragment === null ? null : decodeSharePayload(payloadFromHash(fragment))),
    [fragment],
  );

  const technologyIds = useMemo(
    () => (result === null || !result.ok ? [] : [...manifestTechnologyIds(result.value)]),
    [result],
  );

  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());

  useEffect(() => {
    if (result === null || !result.ok) {
      return;
    }
    const manifest = result.value;
    let alive = true;
    // Les noms lisibles viennent du catalogue, comme partout ailleurs : le
    // navigateur ne charge jamais le catalogue lui-même. Un catalogue
    // indisponible laisse les identifiants, il n'empêche pas la lecture.
    void loadGraphAction({ targets: manifest.targets, technologies: technologyIds })
      .then((graph) => {
        if (alive) {
          setLabels(new Map(graph.nodes.map((node) => [node.id, node.label])));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [result, technologyIds]);

  if (result === null) {
    return <ShareLoading />;
  }
  return (
    <SharePreview
      labels={labels}
      loadingLabels={result.ok && technologyIds.length > 0 && labels.size === 0}
      result={result}
    />
  );
}

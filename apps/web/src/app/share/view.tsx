'use client';

import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { ScreenShell } from '../../components/wizard/shell';
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
 */

/** Ce que la page affiche en attendant d'avoir lu le fragment. */
function ShareLoading(): ReactElement {
  return (
    <ScreenShell
      title="Configuration partagée"
      description="Lecture seule : ce lien décrit une configuration, il ne l’exécute pas."
    >
      <p className="pf-hint">Lecture du lien…</p>
    </ScreenShell>
  );
}

export interface SharePreviewProps {
  readonly result: ShareDecodeResult;
  /** Les noms lisibles des technologies, lus dans le catalogue par le serveur. */
  readonly labels: ReadonlyMap<string, string>;
}

/**
 * Le rendu d'un lien : le Blueprint, ou la raison du refus.
 *
 * Pure : elle reçoit un résultat déjà décodé. Un lien illisible rend une phrase
 * — jamais une pile, jamais une invite à « réessayer » sans dire quoi corriger.
 */
export function SharePreview({ result, labels }: SharePreviewProps): ReactElement {
  if (!result.ok) {
    return (
      <ScreenShell
        title="Configuration partagée"
        description="Lecture seule : ce lien décrit une configuration, il ne l’exécute pas."
      >
        <section className="pf-card pf-card-pad">
          <p className="pf-error" role="status">
            Ce lien n’a pas pu être lu.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {result.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <p className="pf-hint mt-3">
            Demandez à la personne qui vous l’a envoyé de le recopier en entier, ou repartez de{' '}
            <a href="/">l’accueil</a>.
          </p>
        </section>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Configuration partagée"
      description="Lecture seule : cette page montre les choix d’un projet. Elle ne modifie rien et ne génère rien."
    >
      <section className="pf-card pf-card-pad">
        <p className="pf-badge">Lecture seule</p>
        <div className="mt-3">
          <BlueprintSummary view={blueprintView(result.value, labels)} />
        </div>
      </section>

      <p className="pf-hint mt-3">
        La configuration est portée par le fragment du lien : elle n’a été envoyée à aucun serveur,
        et cette page n’en conserve aucune trace.
      </p>

      <nav className="mt-4 flex flex-wrap items-center gap-3" aria-label="Suite">
        <a className="pf-btn" href="/">
          Accueil
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
  return <SharePreview result={result} labels={labels} />;
}

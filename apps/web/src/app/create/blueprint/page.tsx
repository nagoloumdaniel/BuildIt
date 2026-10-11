'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { loadGraphAction } from '../../actions';
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
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [status, setStatus] = useState<'certified' | 'experimental' | null>(null);
  const [catalogueIssue, setCatalogueIssue] = useState<string | null>(null);

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
          setCatalogueIssue(
            'Le catalogue n’a pas pu être lu : les technologies restent affichées par leur identifiant.',
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [manifest, technologyIds]);

  const view = useMemo(
    () => (manifest.ok ? blueprintView(manifest.value, labels) : null),
    [manifest, labels],
  );

  if (!manifest.ok || view === null) {
    return (
      <StepShell
        step="blueprint"
        title="Plan du projet"
        description="Le résumé de ce qui sera généré, construit à partir de vos choix."
      >
        <div className="pf-card pf-card-pad">
          <p className="pf-error" role="status">
            Le brouillon est incomplet : le plan ne peut pas être construit.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {manifest.ok
              ? null
              : manifest.issues.map((issue) => <li key={issue.message}>{issue.message}</li>)}
          </ul>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="blueprint"
      title="Plan du projet"
      description="Le résumé de ce qui sera généré. Les mêmes choix qu’en ligne de commande produisent le même projet, octet pour octet."
    >
      <BlueprintSummary view={view} />

      <p className="pf-hint mt-3">
        {status === null
          ? 'Vérification de la sélection…'
          : status === 'certified'
            ? 'Sélection certifiée : le moteur connaît cette combinaison.'
            : 'Sélection expérimentale : le moteur l’accepte, mais aucun preset ne la certifie.'}
      </p>
      {catalogueIssue === null ? null : (
        <p className="pf-hint" role="status">
          {catalogueIssue}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link className="pf-btn" href="/graph">
          Voir le graphe de dépendances
        </Link>
        <Link className="pf-btn" href="/create/preview">
          Aperçu des fichiers
        </Link>
        <button type="button" className="pf-btn" disabled aria-describedby="pf-share-note">
          Créer un lien de partage
        </button>
      </div>
      <p id="pf-share-note" className="pf-hint mt-2">
        Le partage en lecture seule (§20) n’est pas encore branché : aucun lien n’est émis pour
        l’instant.
      </p>
    </StepShell>
  );
}

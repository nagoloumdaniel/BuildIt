'use client';

import { TARGETS, type Target } from '@project-factory/manifest';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { toggle } from '../../../lib/session';

/**
 * Ce que chaque plateforme veut dire (§4), en clair.
 *
 * Table **complète** : ajouter une cible au manifest casse la compilation ici,
 * et force à écrire sa phrase — c'est une décision produit, pas un détail.
 * Les identifiants, eux, viennent du manifest : ils ne se recopient pas.
 */
const NOTES: Readonly<Record<Target, { label: string; note: string }>> = {
  web: { label: 'Web', note: 'Site, SPA, SSR, full-stack ou PWA.' },
  mobile: { label: 'Mobile', note: 'Android et iOS depuis une base de code unique.' },
  desktop: { label: 'Ordinateur', note: 'Windows, macOS et Linux.' },
  api: { label: 'API', note: 'Backend partagé, sans interface.' },
  library: { label: 'Bibliothèque', note: 'Paquet interne ou publiable.' },
};

export default function TargetPage() {
  const draft = useDraft();
  const session = useSession();

  return (
    <StepShell
      step="target"
      title="Plateformes cibles"
      description="Ce choix détermine les technologies que les écrans suivants vous proposeront."
    >
      <div className="pf-grid">
        {TARGETS.map((target) => {
          const chosen = draft.targets.includes(target);
          return (
            <button
              key={target}
              type="button"
              className="pf-choice"
              aria-pressed={chosen}
              onClick={() =>
                session.update((current) => ({
                  ...current,
                  targets: toggle(current.targets, target),
                }))
              }
            >
              <span className="pf-choice-name">
                {NOTES[target].label}
                {chosen ? <span className="pf-badge pf-badge-accent ml-2">Choisie</span> : null}
              </span>
              <span className="pf-choice-note">{NOTES[target].note}</span>
            </button>
          );
        })}
      </div>

      <p className="pf-hint mt-4">
        {draft.targets.length === 0
          ? 'Aucune plateforme choisie pour l’instant.'
          : `${draft.targets.length} plateforme${draft.targets.length > 1 ? 's' : ''} : ${draft.targets.join(', ')}.`}
      </p>
    </StepShell>
  );
}

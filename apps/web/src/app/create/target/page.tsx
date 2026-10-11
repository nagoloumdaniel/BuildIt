'use client';

import { TARGETS, type Target } from '@project-factory/manifest';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { toggle } from '../../../lib/session';
import { offeredTargets } from '../../../lib/targets';

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
  // L'écran ne propose que ce que le catalogue peut honorer (§7.9, §7.10) :
  // une cible sans framework mène à un manifest impossible, donc à un
  // cul-de-sac. Le calcul se lit dans le catalogue, il ne s'écrit pas ici.
  const offered = offeredTargets();
  const withheld = TARGETS.filter((target) => !offered.includes(target));

  return (
    <StepShell
      step="target"
      title="Plateformes cibles"
      description="Ce choix détermine les technologies que les écrans suivants vous proposeront."
    >
      <div className="pf-grid">
        {offered.map((target) => {
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

      {withheld.length > 0 ? (
        // Ce n'est pas un oubli : le catalogue n'a encore aucune fiche capable
        // d'être le framework de ces plateformes. Le dire ici vaut mieux que de
        // les proposer et refuser trois écrans plus loin (§7.9, §7.10, §23).
        <p className="pf-hint">
          {withheld.map((target) => NOTES[target].label).join(' et ')} :{' '}
          {withheld.length > 1 ? 'ces plateformes ne sont' : 'cette plateforme n’est'} pas encore
          proposée{withheld.length > 1 ? 's' : ''} — le catalogue ne contient aucun framework pour{' '}
          {withheld.length > 1 ? 'elles' : 'elle'}. C’est la V1 (§23) ; le MVP génère des projets
          web, API et bibliothèque.
        </p>
      ) : null}
    </StepShell>
  );
}

'use client';

import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import { toggle } from '../../../lib/session';
import { offeredTargets } from '../../../lib/targets';

/**
 * Écran 2 Target Selection (§4).
 *
 * Ce que chaque plateforme veut dire, et ce qu'elle ne veut pas dire, est dit
 * par le dictionnaire : `wizard.targets.labels` est complet (`satisfies
 * Record<Target, …>`), donc ajouter une cible au manifest casse la compilation
 * ici et force à écrire sa phrase c'est une décision produit, pas un détail.
 * Les identifiants, eux, viennent du manifest : ils ne se recopient pas.
 */
export default function TargetPage() {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  // L'écran ne propose que ce que le catalogue peut honorer (§7.9, §7.10) :
  // une cible sans framework mène à un manifest impossible, donc à un
  // cul-de-sac. Le calcul se lit dans le catalogue, il ne s'écrit pas ici.
  const offered = offeredTargets();
  const labels = t.wizard.targets.labels;

  return (
    <StepShell
      step="target"
      title={t.wizard.targets.title}
      description={t.wizard.targets.description}
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
                {labels[target].label}
                {chosen ? (
                  <span className="pf-badge pf-badge-accent ml-2">{t.wizard.targets.chosen}</span>
                ) : null}
              </span>
              <span className="pf-choice-note">{labels[target].note}</span>
            </button>
          );
        })}
      </div>

      <p className="pf-hint mt-4">
        {draft.targets.length === 0
          ? t.wizard.targets.empty
          : t.wizard.targets.count(draft.targets.length, draft.targets.join(', '))}
      </p>
    </StepShell>
  );
}

import type { ReactElement } from 'react';
import type { ProgressStep } from './steps';

export interface PipelineProgressProps {
  readonly steps: readonly ProgressStep[];
  readonly running: boolean;
}

/**
 * L'avancement (§6.13).
 *
 * Une Server Action ne diffuse pas ses étapes : l'écran dit « en cours », puis
 * affiche les étapes que le moteur a réellement terminées. Il n'invente pas de
 * pourcentage — un pourcentage faux est pire qu'une attente annoncée.
 */
export function PipelineProgress({ steps, running }: PipelineProgressProps): ReactElement {
  return (
    <div>
      <p role="status" aria-live="polite" className="pf-hint">
        {running ? 'Génération en cours…' : 'Génération terminée.'}
      </p>
      <ol aria-label="Avancement de la génération" className="m-0 list-none space-y-1 p-0">
        {steps.map((step) => (
          <li key={step.step} className="flex items-center gap-2">
            <span className={step.done ? 'pf-badge pf-badge-ok' : 'pf-badge'}>
              {step.done ? 'Terminé' : 'En attente'}
            </span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

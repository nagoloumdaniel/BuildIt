'use client';

import type { ReactElement } from 'react';
import { ProgressBar, Spinner } from '../../../components/ui/loading';
import { useMessages } from '../../../lib/i18n/provider';
import type { ProgressStep } from './steps';

export interface PipelineProgressProps {
  readonly steps: readonly ProgressStep[];
  readonly running: boolean;
}

/**
 * L'avancement (§6.13).
 *
 * Une Server Action ne diffuse pas ses étapes : l'écran dit « en cours », puis
 * affiche les étapes que le moteur a réellement terminées. La barre est
 * **déterminée** — elle compte les étapes que le moteur a rendues sur celles qui
 * sont attendues, donc elle ne ment jamais : 0 % tant que rien n'est revenu,
 * 100 % quand tout l'est. Pas de pourcentage inventé, pas d'attente sans forme.
 */
export function PipelineProgress({ steps, running }: PipelineProgressProps): ReactElement {
  const t = useMessages();
  const done = steps.filter((step) => step.done).length;
  const percent = steps.length === 0 ? 0 : Math.round((done / steps.length) * 100);

  return (
    <div>
      <p role="status" aria-live="polite" className="pf-hint flex items-center gap-2">
        {running ? <Spinner size="sm" /> : null}
        {running ? t.build.generating : t.build.generate.progressDone}
      </p>
      <ProgressBar className="mt-2" value={percent} label={t.build.generate.progressLabel} />
      <ol aria-label={t.build.generate.progressLabel} className="m-0 mt-2 list-none space-y-1 p-0">
        {steps.map((step) => (
          <li key={step.step} className="flex items-center gap-2">
            <span className={step.done ? 'pf-badge pf-badge-ok' : 'pf-badge'}>
              {step.done ? t.build.generate.stepDone : t.build.generate.stepPending}
            </span>
            <span className="min-w-0 break-words">{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

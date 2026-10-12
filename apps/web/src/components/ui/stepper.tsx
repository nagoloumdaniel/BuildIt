'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { Icon } from './icon';
import { ProgressBar } from './loading';

/**
 * La barre d'étapes.
 *
 * Elle encode une information réelle — le parcours **est** une séquence, donc
 * les numéros ont leur place — et elle refuse le saut en avant : une étape
 * non franchie n'est pas un lien, parce que la franchir contournerait les
 * conditions bloquantes. Une étape déjà passée, elle, est cliquable : revenir
 * corriger un choix est le geste le plus fréquent du parcours.
 *
 * Deux rendus pour une seule source :
 * - au large, le rail complet avec les douze nœuds et leurs libellés ;
 * - au petit, « Étape 5 sur 12 » plus le nom de l'étape et une barre.
 *
 * Douze pastilles sur un téléphone ne seraient ni lisibles ni cliquables ;
 * les masquer et ne rien mettre priverait l'utilisateur de sa position. La
 * barre dit la position, le texte dit laquelle.
 */

export interface StepperItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface StepperProps {
  readonly steps: readonly StepperItem[];
  /** L'index de l'étape affichée, à partir de 0. */
  readonly current: number;
  readonly ariaLabel: string;
  /** « Étape 5 sur 12 », dans la langue courante. */
  readonly compactLabel: string;
}

export function Stepper({
  steps,
  current,
  ariaLabel,
  compactLabel,
}: StepperProps): ReactElement {
  const total = steps.length;
  const percent = total === 0 ? 0 : Math.round(((current + 1) / total) * 100);
  const currentStep = steps[current];

  return (
    <nav aria-label={ariaLabel}>
      {/* Petit écran : la position, pas la carte complète. */}
      <div className="md:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="pf-eyebrow">{compactLabel}</p>
          <p className="pf-title-sm">{currentStep?.label ?? ''}</p>
        </div>
        <ProgressBar className="mt-2" value={percent} />
      </div>

      {/* Large : le rail. `ol` parce que l'ordre porte le sens. */}
      <ol className="pf-stepper hidden md:flex">
        {steps.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'current' : 'todo';
          const last = index === total - 1;
          const node = (
            <span className="pf-step-node">
              {state === 'done' ? <Icon name="check" size={12} /> : index + 1}
            </span>
          );
          return (
            <li
              className="pf-step"
              data-state={state}
              key={step.id}
              {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
            >
              {state === 'done' ? (
                <Link
                  className="flex min-w-0 items-center gap-2 no-underline"
                  href={step.href}
                  title={step.label}
                >
                  {node}
                  <span className="pf-step-label">{step.label}</span>
                </Link>
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  {node}
                  <span className="pf-step-label">{step.label}</span>
                </span>
              )}
              {last ? null : <span aria-hidden="true" className="pf-step-rail" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

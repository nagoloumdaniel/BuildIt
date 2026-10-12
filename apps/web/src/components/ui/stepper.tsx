'use client';

import Link from 'next/link';
import { type CSSProperties, type ReactElement, useEffect, useRef, useState } from 'react';

/**
 * La barre d'étapes : douze numéros sur un seul rail.
 *
 * Elle encode une information réelle (le parcours **est** une séquence, donc
 * les numéros ont leur place) et elle refuse le saut en avant : une étape non
 * franchie n'est pas un lien, parce que la franchir contournerait les
 * conditions bloquantes. Une étape déjà passée, elle, est cliquable : revenir
 * corriger un choix est le geste le plus fréquent du parcours.
 *
 * Aucun nom d'étape n'est affiché : le titre de la page le dit déjà, en grand,
 * juste dessous. Les répéter en 12 px ne tenait pas sur un téléphone, et
 * obligeait à un second rendu « Étape 5 sur 12 » pour le petit écran. Ici, un
 * seul rendu à toutes les largeurs : les pastilles rétrécissent, le rail
 * reste. Le nom survit pour ceux qui ne voient pas le titre : texte masqué
 * pour le lecteur d'écran, `title` pour la souris.
 *
 * Le rail se remplit jusqu'à l'étape courante. Comme la page (donc le
 * stepper) est remontée à chaque étape, `from` lui dit d'où il part : il
 * s'affiche d'abord à l'ancienne position, puis glisse vers la nouvelle.
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
  /** « Étape 5 sur 12 », dans la langue courante : dit au lecteur d'écran. */
  readonly compactLabel: string;
  /** L'index de l'étape quittée, pour animer le remplissage depuis elle. */
  readonly from?: number;
}

/** La part du rail remplie, de 0 (première pastille) à 1 (dernière). */
function fillRatio(index: number, total: number): number {
  return total <= 1 ? 0 : index / (total - 1);
}

function clampIndex(index: number, total: number): number {
  return total === 0 ? 0 : Math.min(total - 1, Math.max(0, index));
}

export function Stepper({
  steps,
  current,
  ariaLabel,
  compactLabel,
  from,
}: StepperProps): ReactElement {
  const total = steps.length;
  const currentIndex = clampIndex(current, total);
  const [shown, setShown] = useState(() =>
    from === undefined ? currentIndex : clampIndex(from, total),
  );
  const railRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (shown === currentIndex) {
      return;
    }
    // Une transition CSS ne part que d'un style déjà calculé. La lecture de
    // géométrie force ce calcul sur l'ancienne position : sans elle, le
    // navigateur pourrait fusionner les deux états et poser le rail plein
    // d'un coup.
    railRef.current?.getBoundingClientRect();
    setShown(currentIndex);
  }, [shown, currentIndex]);

  const style = { '--pf-rail-fill': fillRatio(shown, total) } as CSSProperties;

  return (
    <nav aria-label={ariaLabel} className="pf-rail-nav">
      <p className="pf-journey-sr">{compactLabel}</p>
      {/* `ol` parce que l'ordre porte le sens. */}
      <ol className="pf-rail" ref={railRef} style={style}>
        {steps.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
          const content = (
            <>
              <span aria-hidden="true">{index + 1}</span>
              <span className="pf-journey-sr">{step.label}</span>
            </>
          );
          return (
            <li
              className="pf-rail-step"
              data-state={state}
              key={step.id}
              {...(state === 'current' ? { 'aria-current': 'step' as const } : {})}
            >
              {state === 'done' ? (
                <Link className="pf-rail-node" href={step.href} title={step.label}>
                  {content}
                </Link>
              ) : (
                <span className="pf-rail-node" title={step.label}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

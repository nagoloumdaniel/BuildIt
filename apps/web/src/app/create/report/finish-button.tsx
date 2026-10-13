'use client';

import { type ReactElement, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { Spinner } from '../../../components/ui/loading';
import { useMessages } from '../../../lib/i18n/provider';

/** Le temps de la finalisation : assez pour lire qu'il se passe quelque chose. */
export const FINISH_DELAY_MS = 1500;

export interface FinishButtonProps {
  /** Ce que « Terminer » fait vraiment, appelé une seule fois après le délai. */
  readonly onFinish: () => void;
  readonly delayMs?: number;
}

/**
 * « Terminer » : le seul geste de sortie du rapport, en orange parce que
 * c'est l'action qui reste à faire.
 *
 * Le bouton passe d'abord en « Finalisation… » le temps de `delayMs`, puis
 * appelle `onFinish` (brouillon remis à zéro, retour à l'accueil). Le délai
 * n'est pas décoratif : il dit que le projet est rangé avant que l'écran
 * change, plutôt qu'un saut sec qui laisserait croire à un clic perdu. Un
 * second clic pendant la finalisation ne relance rien.
 */
export function FinishButton({
  onFinish,
  delayMs = FINISH_DELAY_MS,
}: FinishButtonProps): ReactElement {
  const o = useMessages().output.report;
  const [finishing, setFinishing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  function finish(): void {
    if (finishing) {
      return;
    }
    setFinishing(true);
    timer.current = setTimeout(onFinish, delayMs);
  }

  return (
    <button
      aria-busy={finishing}
      className="pf-btn pf-btn-primary"
      disabled={finishing}
      onClick={finish}
      type="button"
    >
      {finishing ? <Spinner size="sm" /> : <Icon name="check" />}
      {finishing ? o.finishing : o.finish}
    </button>
  );
}

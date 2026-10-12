'use client';

import type { ReactElement } from 'react';
import { Icon } from './icon';

/**
 * « Voir toutes les options » / « Revenir aux recommandations » : **un**
 * bouton, deux états, et il se replie.
 *
 * Trois écrans portaient leur propre version de ce geste, et deux ne savaient
 * que déplier : une fois les seize architectures affichées, plus moyen de
 * revenir aux trois recommandées. Ici l'état est explicite (`aria-expanded`),
 * le chevron dit le sens — vers le bas pour déplier, vers le haut pour replier
 * — et le libellé change avec lui.
 *
 * Il est mis en valeur sans crier : contour accentué et chevron, pas un
 * deuxième bouton principal qui disputerait « Continuer ».
 */

export interface DisclosureButtonProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** Le libellé replié : « Voir toutes les options (12) ». */
  readonly moreLabel: string;
  /** Le libellé déplié : « Revenir aux recommandations ». */
  readonly lessLabel: string;
  /** L'id de la zone que le bouton déplie, pour `aria-controls`. */
  readonly controls?: string;
  readonly className?: string;
}

export function DisclosureButton({
  expanded,
  onToggle,
  moreLabel,
  lessLabel,
  controls,
  className,
}: DisclosureButtonProps): ReactElement {
  return (
    <button
      aria-expanded={expanded}
      className={`pf-btn pf-disclosure${className === undefined ? '' : ` ${className}`}`}
      onClick={onToggle}
      type="button"
      {...(controls === undefined ? {} : { 'aria-controls': controls })}
    >
      <span className="pf-disclosure-chevron" aria-hidden="true">
        <Icon name="chevronDown" size={16} />
      </span>
      {expanded ? lessLabel : moreLabel}
    </button>
  );
}

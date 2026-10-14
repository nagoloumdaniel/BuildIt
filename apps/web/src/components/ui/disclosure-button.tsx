'use client';

import type { ReactElement } from 'react';
import { Icon } from './icon';

/**
 * « Télécharger le ZIP ou installer » / « Masquer l'export » : **un** bouton,
 * deux états, et le panneau se replie.
 *
 * Le Stack Builder portait ce geste pour déplier sa longue traîne ; il ne la
 * cache plus (tout le catalogue est affiché, l'étoile marque les
 * recommandations). Le seul appelant est le panneau d'export d'une carte de
 * projet, où le geste reste utile : l'export est une action, pas une liste.
 *
 * L'état est explicite (`aria-expanded`), le chevron dit le sens — vers le bas
 * pour ouvrir, vers le haut pour fermer — et le libellé change avec lui. Mis en
 * valeur sans crier : contour accentué et chevron, pas un deuxième bouton
 * principal qui disputerait l'action de la carte.
 */

export interface DisclosureButtonProps {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  /** Le libellé replié : « Télécharger le ZIP ou installer ». */
  readonly moreLabel: string;
  /** Le libellé déplié : « Masquer l'export ». */
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

import type { ReactElement } from 'react';
import { categoryIcon } from './category-icon';
import { Icon } from './icon';
import { hasBrand, TechIcon } from './tech-icon';

/**
 * L'icône d'une technologie, **toujours présente** : le logo de la marque
 * quand le sprite la connaît, l'icône de la catégorie sinon.
 *
 * Une grille où un tiers des cases est vide se lit moins bien qu'une grille
 * pleine : c'est la même raison qui a fait donner un monogramme aux entrées
 * sans marque dans les cartes de projet. Ici la couleur est celle du parent
 * (`currentColor`), donc l'orange des cartes du Stack Builder et des puces.
 */

export interface StackIconProps {
  /** L'identifiant du catalogue : `next`, `tailwind`, `postgres`… */
  readonly id: string;
  /** Le nom lisible, quand il vaut mieux que la marque pour l'accessible. */
  readonly label?: string | undefined;
  /** La catégorie du catalogue, qui décide de l'icône de repli. */
  readonly category?: string | undefined;
  readonly size?: number;
}

export function StackIcon({ id, label, category, size = 16 }: StackIconProps): ReactElement {
  return hasBrand(id) ? (
    <TechIcon id={id} size={size} {...(label === undefined ? {} : { name: label })} />
  ) : (
    <Icon name={categoryIcon(category ?? '')} size={size} />
  );
}

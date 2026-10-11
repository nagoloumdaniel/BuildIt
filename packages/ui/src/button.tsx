import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';
import { joinClassNames } from './class-names.js';

/** Variantes du bouton : la classe de base `pf-btn` est toujours présente. */
export type ButtonVariant = 'default' | 'primary' | 'ghost';

const BUTTON_BASE_CLASS = 'pf-btn';

const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: '',
  primary: 'pf-btn-primary',
  ghost: 'pf-btn-ghost',
};

/**
 * La classe d'un bouton, sans rendre de `<button>`.
 *
 * Next interdit à `@buildit/ui` de connaître `next/link` : le lien stylé
 * en bouton (`<Link className=...>`) prend donc la classe ici, et le composant
 * reste sans dépendance de framework.
 */
export function buttonClassName(variant: ButtonVariant = 'default', className?: string): string {
  return joinClassNames(BUTTON_BASE_CLASS, BUTTON_VARIANT_CLASS[variant], className);
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  readonly variant?: ButtonVariant;
  readonly className?: string;
  readonly children?: ReactNode;
};

/**
 * Le bouton du dépôt : `pf-btn` plus sa variante. Il ne porte aucune logique —
 * pas d'état, pas d'appel, pas de libellé par défaut. `type="button"` est le
 * défaut, comme dans les écrans : un bouton dans un `<form>` ne doit pas
 * soumettre par surprise.
 */
export function Button({
  variant = 'default',
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button className={buttonClassName(variant, className)} type={type} {...rest}>
      {children}
    </button>
  );
}

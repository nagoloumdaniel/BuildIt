import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bouton de base.
 *
 * Les variantes se déclarent par une prop `variant`, pas par une collection de
 * booléens : `<Button primary large outlined />` autorise des combinaisons qui
 * n'ont pas de sens, et chaque nouvelle variante en multiplie le nombre.
 */
type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-foreground text-background hover:opacity-90',
  secondary: 'border border-border bg-muted hover:bg-border/40',
  ghost: 'hover:bg-muted',
};

export function Button({
  className,
  variant = 'primary',
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-md px-4 font-medium text-sm transition',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

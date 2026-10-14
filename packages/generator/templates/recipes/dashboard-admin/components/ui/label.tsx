import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

export function Label({ className, htmlFor, ...props }: ComponentProps<'label'>) {
  // biome-ignore lint/a11y/noLabelWithoutControl: composant générique le contrôle est associé par `htmlFor`, fourni à chaque usage.
  return <label htmlFor={htmlFor} className={cn('font-medium text-sm', className)} {...props} />;
}

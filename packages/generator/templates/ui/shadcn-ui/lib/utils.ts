import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne des classes Tailwind en laissant la dernière gagner.
 *
 * `clsx` gère les conditions, `tailwind-merge` résout les conflits : sans lui,
 * `px-2 px-4` laisserait les deux classes et le résultat dépendrait de l'ordre
 * dans la feuille de style.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

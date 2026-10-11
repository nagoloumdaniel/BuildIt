/**
 * Assemblage des classes `pf-*`.
 *
 * Un composant partagé doit rendre **exactement** les mêmes classes que le
 * balisage dupliqué qu'il remplace : c'est la seule chose qui garantisse que la
 * direction artistique (8A) ne bouge pas au passage. D'où cette petite fonction
 * plutôt qu'un `clsx` de plus : elle ne fait que joindre, sans dédoublonner ni
 * réordonner, et ignore les fragments vides pour ne pas produire `pf-btn `.
 */
export function joinClassNames(...parts: readonly (string | undefined)[]): string {
  return parts.filter((part): part is string => part !== undefined && part !== '').join(' ');
}

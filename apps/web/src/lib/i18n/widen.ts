/**
 * Les littéraux élargis.
 *
 * Chaque fichier de dictionnaire déclare le français `as const` : c'est ce
 * qui rend les **clés** exhaustives, donc ce qui fait échouer la compilation
 * quand une entrée est ajoutée d'un côté et pas de l'autre. Mais `as const`
 * fige aussi chaque valeur en type littéral (`'Retour'`), et l'anglais serait
 * alors refusé pour la seule raison qu'il n'est pas le français.
 *
 * `Widen` garde la forme et libère les feuilles. Les fonctions traversent
 * telles quelles : `(n: number) => string` doit rester appelable, pas devenir
 * une chaîne.
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R
    : { [K in keyof T]: Widen<T[K]> };

/**
 * Le double de `next/font/google` pour Vitest.
 *
 * `next/font/google` n'est pas un module exécutable : Next le remplace à la
 * compilation par un chargeur qui télécharge la police et engendre les
 * variables CSS. Hors de Next — sous Vitest — l'import résout le fichier
 * d'origine, qui appelle ce chargeur et lève « Inter is not a function ».
 * Tout test qui monte le `layout` (le test du Toaster, par exemple) tombait
 * donc à l'import, sans rien prouver de l'écran.
 *
 * Ce fichier est le **seul** endroit où le nom des polices est simulé. Il
 * reproduit le contrat utilisé par `layout.tsx` — `variable` pour les variables
 * CSS, `className` pour la classe — et rien de plus. Un composant qui se
 * mettrait à lire autre chose de la police échouerait ici plutôt que de passer
 * en silence.
 *
 * Il n'est branché que par `vitest.config.ts` : Next ne le voit jamais, et le
 * site continue de servir les vraies polices auto-hébergées.
 */

export interface LoadedFont {
  readonly className: string;
  readonly variable: string;
  readonly style: { readonly fontFamily: string };
}

function loaded(variable: string, family: string): LoadedFont {
  return {
    className: `font-${family.toLowerCase().replaceAll('_', '-')}`,
    variable,
    style: { fontFamily: family },
  };
}

/** Chargeur simulé d'Inter — voir le commentaire d'en-tête. */
export function Inter(_options?: unknown): LoadedFont {
  return loaded('--font-pf-sans', 'Inter');
}

/** Chargeur simulé de JetBrains Mono — voir le commentaire d'en-tête. */
export function JetBrains_Mono(_options?: unknown): LoadedFont {
  return loaded('--font-pf-mono', 'JetBrains_Mono');
}

/** Valeurs interpolables dans un message. */
export type MessageParams = Readonly<Record<string, string>>;

/** Remplace les paramètres manquants plutôt que de laisser un marqueur brut. */
const MISSING_PARAM = 'une valeur inattendue';

/**
 * Fabrique le formateur de messages d'un domaine à partir de son catalogue.
 *
 * Un catalogue par domaine, indexé par code : c'est le seul endroit où vivent
 * des phrases destinées à des humains. Traduire le produit un jour ne coûtera
 * que ces fichiers-là.
 *
 * Un paramètre absent est remplacé par une formulation neutre : un message
 * dégradé reste lisible, alors qu'un `{value}` affiché tel quel est un bug
 * visible par l'utilisateur.
 */
export function createMessageFormatter<Code extends string>(
  catalog: Readonly<Record<Code, string>>,
): (code: Code, params: MessageParams) => string {
  return (code, params) =>
    catalog[code].replace(
      /\{([a-zA-Z]+)\}/g,
      (_match, key: string) => params[key] ?? MISSING_PARAM,
    );
}

/**
 * Erreurs de validation du Project Manifest.
 *
 * Chaque problème porte un **code stable**, indépendant de la langue et de la
 * formulation. Les tests assertent sur le code ; reformuler un message ne doit
 * jamais casser la suite de tests, et traduire le produit un jour ne coûtera
 * que ce fichier.
 */

/** Tous les codes que la validation peut produire. */
export const MANIFEST_ISSUE_CODES = [
  'MANIFEST_NOT_AN_OBJECT',
  'MANIFEST_VERSION_MISSING',
  'MANIFEST_VERSION_UNSUPPORTED',
  'MANIFEST_FIELD_REQUIRED',
  'MANIFEST_UNKNOWN_FIELD',
  'MANIFEST_TYPE_MISMATCH',
  'MANIFEST_NAME_INVALID',
  'MANIFEST_TARGETS_EMPTY',
  'MANIFEST_ENUM_UNKNOWN',
  'MANIFEST_SLUG_INVALID',
  'MANIFEST_DUPLICATE_ENTRY',
] as const;

export type ManifestIssueCode = (typeof MANIFEST_ISSUE_CODES)[number];

/** Segment de chemin vers le champ fautif : clé d'objet ou index de tableau. */
export type ManifestPathSegment = string | number;

export interface ManifestIssue {
  /** Code stable, sur lequel portent les tests et les branchements applicatifs. */
  readonly code: ManifestIssueCode;
  /** Chemin du champ fautif, par exemple `['frontend', 'framework']`. */
  readonly path: readonly ManifestPathSegment[];
  /** Message destiné à l'utilisateur. */
  readonly message: string;
  /** Piste de correction, quand une valeur proche existe. */
  readonly hint?: string;
}

/** Valeurs interpolables dans un message. */
export type MessageParams = Readonly<Record<string, string>>;

/**
 * Catalogue des messages, indexé par code.
 *
 * C'est le seul endroit du paquet où vit une phrase destinée à un humain.
 */
const MESSAGES: Readonly<Record<ManifestIssueCode, string>> = {
  MANIFEST_NOT_AN_OBJECT: 'Le manifest doit être un objet JSON, pas {actual}.',
  MANIFEST_VERSION_MISSING:
    "Le champ « manifestVersion » est absent. Ce manifest n'a pas été produit par Project Factory.",
  MANIFEST_VERSION_UNSUPPORTED:
    'Version de manifest non prise en charge : {value}. Cette version de Project Factory lit la version {supported}.',
  MANIFEST_FIELD_REQUIRED: 'Le champ « {field} » est obligatoire.',
  MANIFEST_UNKNOWN_FIELD:
    "Le champ « {field} » n'existe pas dans un manifest. Vérifiez l'orthographe.",
  MANIFEST_TYPE_MISMATCH: 'Le champ « {field} » doit être {expected}, et non {actual}.',
  MANIFEST_NAME_INVALID:
    'Nom de projet invalide : {value}. Attendu un nom de paquet npm — minuscules, chiffres, tirets, 214 caractères au plus.',
  MANIFEST_TARGETS_EMPTY:
    'Aucune cible sélectionnée. Un projet vise au moins une plateforme : {expected}.',
  MANIFEST_ENUM_UNKNOWN: 'Valeur inconnue : {value}. Valeurs acceptées : {expected}.',
  MANIFEST_SLUG_INVALID:
    'Identifiant de technologie invalide : {value}. Attendu des minuscules et des chiffres séparés par des tirets, par exemple « better-auth ».',
  MANIFEST_DUPLICATE_ENTRY: 'La valeur {value} apparaît plusieurs fois.',
};

/** Remplace les paramètres manquants plutôt que de laisser un marqueur brut. */
const MISSING_PARAM = 'une valeur inattendue';

/**
 * Rend le message d'un code, paramètres interpolés.
 *
 * Un paramètre absent est remplacé par une formulation neutre : un message
 * dégradé reste lisible, alors qu'un `{value}` affiché tel quel est un bug
 * visible par l'utilisateur.
 */
export function messageFor(code: ManifestIssueCode, params: MessageParams): string {
  return MESSAGES[code].replace(/\{([a-zA-Z]+)\}/g, (_match, key: string) => {
    return params[key] ?? MISSING_PARAM;
  });
}

/**
 * Distance de Damerau-Levenshtein (variante « optimal string alignment »).
 *
 * Damerau plutôt que Levenshtein parce que la transposition de deux lettres
 * voisines est la faute de frappe la plus courante — « wbe » pour « web ».
 * Levenshtein la facture 2, ce qui la place hors de portée de tout seuil
 * raisonnable ; Damerau la facture 1, ce qui est le comportement attendu.
 *
 * Matrice complète : les valeurs comparées sont des identifiants de quelques
 * caractères, l'optimisation mémoire ne rachèterait pas la perte de lisibilité.
 */
function editDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  const rows = a.length + 1;
  const columns = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_unused, i) =>
    Array.from({ length: columns }, (_empty, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < columns; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        (matrix[i - 1]?.[j] ?? 0) + 1, // suppression
        (matrix[i]?.[j - 1] ?? 0) + 1, // insertion
        (matrix[i - 1]?.[j - 1] ?? 0) + cost, // substitution
      );

      const isTransposition = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      if (isTransposition) {
        best = Math.min(best, (matrix[i - 2]?.[j - 2] ?? 0) + 1);
      }

      const row = matrix[i];
      if (row !== undefined) {
        row[j] = best;
      }
    }
  }

  return matrix[a.length]?.[b.length] ?? 0;
}

/**
 * Seuil de proximité : au-delà d'un tiers de la longueur du candidat, la
 * « suggestion » ajoute du bruit au lieu d'aider.
 */
function toleranceFor(candidate: string): number {
  return Math.max(1, Math.floor(candidate.length / 3));
}

/**
 * Cherche la valeur acceptée la plus proche d'une saisie fautive.
 *
 * §12 demande que le produit explique plutôt que de refuser sèchement — ça
 * commence ici, sur une faute de frappe.
 */
export function suggest(value: string, candidates: readonly string[]): string | undefined {
  const needle = value.toLowerCase();
  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = editDistance(needle, candidate.toLowerCase());
    if (distance <= toleranceFor(candidate) && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
}

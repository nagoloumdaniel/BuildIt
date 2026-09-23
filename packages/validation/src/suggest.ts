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
/**
 * Lecture d'une case de la matrice.
 *
 * Le `?? 0` est imposé par `noUncheckedIndexedAccess` : le compilateur type
 * tout accès indexé comme potentiellement `undefined`. Il est **inatteignable**
 * — tous les indices sont bornés par construction — donc intestable, et c'est
 * la seule raison pour laquelle cette ligne est exclue de la couverture. Le
 * garde-fou est concentré ici plutôt que répété à chaque accès.
 */
/* v8 ignore next 3 */
function cell(matrix: Int32Array, index: number): number {
  return matrix[index] ?? 0;
}

function editDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  // Matrice à plat dans un Int32Array plutôt qu'un tableau de tableaux : avec
  // `noUncheckedIndexedAccess`, un `number[][]` oblige à un `?? 0` sur chaque
  // accès. Ces garde-fous sont inatteignables — les indices sont bornés par
  // construction — mais ils restent du code non couvert que personne ne peut
  // tester. Un Int32Array rend un `number`, donc aucune branche morte.
  const width = b.length + 1;
  const matrix = new Int32Array((a.length + 1) * width);

  for (let j = 0; j <= b.length; j += 1) {
    matrix[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    matrix[i * width] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        cell(matrix, (i - 1) * width + j) + 1, // suppression
        cell(matrix, i * width + j - 1) + 1, // insertion
        cell(matrix, (i - 1) * width + j - 1) + cost, // substitution
      );

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, cell(matrix, (i - 2) * width + j - 2) + 1);
      }

      matrix[i * width + j] = best;
    }
  }

  return cell(matrix, a.length * width + b.length);
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

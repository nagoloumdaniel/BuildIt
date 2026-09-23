import { MANIFEST_KEY_ORDER, type Manifest } from './schema/manifest.js';

/**
 * Forme canonique et sérialisation du manifest.
 *
 * Deux manifests exprimant les mêmes choix doivent produire exactement la même
 * chaîne. Ce n'est pas une coquetterie : c'est ce qui rend vérifiable la
 * promesse du §9 — l'UI et le CLI sont deux façades du même moteur, donc les
 * mêmes choix doivent donner le même manifest, octet pour octet. Sans forme
 * canonique, cette promesse est invérifiable et donc sans valeur.
 */

/** Champs qui sont des ensembles : leur ordre ne porte aucun sens. */
const SET_FIELDS = ['targets', 'apps', 'services', 'quality', 'infra'] as const;

/** Ordre des clés des objets imbriqués, même principe que MANIFEST_KEY_ORDER. */
const NESTED_KEY_ORDER: Readonly<Record<string, readonly string[]>> = {
  frontend: ['framework', 'language', 'styling', 'ui'],
  mobile: ['framework', 'language', 'styling'],
  desktop: ['framework'],
  backend: ['framework', 'language'],
  database: ['engine', 'orm'],
  auth: ['provider'],
  shareLink: ['enabled', 'readOnly'],
};

function orderKeys(value: object, order: readonly string[]): Record<string, unknown> {
  const source = value as Record<string, unknown>;
  const ordered: Record<string, unknown> = {};
  for (const key of order) {
    if (source[key] !== undefined) {
      ordered[key] = source[key];
    }
  }
  return ordered;
}

/**
 * Met un manifest en forme canonique : ensembles triés, clés dans l'ordre
 * déclaré, champs absents retirés.
 *
 * Idempotente — l'appliquer deux fois donne le même résultat.
 */
export function canonicalizeManifest(manifest: Manifest): Manifest {
  const source = manifest as unknown as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};

  for (const key of MANIFEST_KEY_ORDER) {
    const value = source[key];
    if (value === undefined) {
      continue;
    }

    if ((SET_FIELDS as readonly string[]).includes(key)) {
      canonical[key] = [...(value as string[])].sort();
      continue;
    }

    const nestedOrder = NESTED_KEY_ORDER[key];
    if (nestedOrder !== undefined && typeof value === 'object' && value !== null) {
      canonical[key] = orderKeys(value, nestedOrder);
      continue;
    }

    canonical[key] = value;
  }

  return canonical as unknown as Manifest;
}

/**
 * Sérialise un manifest sous sa forme canonique.
 *
 * Indentation de deux espaces et saut de ligne final : le résultat est destiné
 * à être posé dans un dépôt et relu par des humains, pas seulement transporté.
 */
export function serializeManifest(manifest: Manifest): string {
  return `${JSON.stringify(canonicalizeManifest(manifest), null, 2)}\n`;
}

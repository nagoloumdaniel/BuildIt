/**
 * Version du schéma du Project Manifest (cahier des charges §10).
 *
 * Le manifest est le contrat partagé entre l'UI et le CLI : les deux façades
 * produisent la même structure et le même pipeline la consomme (§9). Le champ
 * de version existe dès la v1 pour que la Phase 2 puisse introduire une
 * migration sans avoir à deviner ce qu'était le format précédent.
 */
export const MANIFEST_VERSION: 1 = 1;

/** Versions de schéma que ce paquet sait lire. */
export type ManifestVersion = typeof MANIFEST_VERSION;

/**
 * Garde de type sur le champ `manifestVersion` d'un manifest.
 *
 * Volontairement strict : la valeur provient de JSON non fiable — un fichier
 * édité à la main, un lien de partage (§20) ou un manifest écrit par une
 * version plus récente de l'outil. Une comparaison stricte refuse d'un seul
 * coup les chaînes numériques, les décimaux, `NaN`, `null` et `undefined`.
 */
export function isSupportedManifestVersion(value: unknown): value is ManifestVersion {
  return value === MANIFEST_VERSION;
}

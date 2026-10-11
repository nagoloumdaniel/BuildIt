/**
 * Project Doctor (§16) — le diagnostic d'un projet généré ou existant.
 *
 * Le paquet ne lit rien : le CLI rassemble les faits (`ProjectFacts`) et ce
 * module juge. Le score est la part des constats satisfaits, et chaque constat
 * dit ce qui a été observé. Aucune correction n'est appliquée ici : un constat
 * porteur d'un `fix` décrit seulement ce qui serait créé ou ajouté — le CLI
 * l'affiche, demande confirmation, puis écrit.
 */

export type { Catalogue } from './checks.js';
export { describeTechnology, runDoctor } from './checks.js';
export type {
  Check,
  CheckStatus,
  Fix,
  ProjectFacts,
  Report,
} from './facts.js';

/**
 * Compatibility Engine — raisonne sur les relations déclarées par le registry.
 *
 * Le registry déclare (`requires`, `compatibleWith`, `conflictsWith`), ce
 * paquet en tire des conclusions : il complète une sélection, détecte les
 * incohérences, et surtout il explique. §12 exige une justification pour chaque
 * refus ; §5 exige qu'une option indisponible soit grisée avec sa raison, pas
 * masquée.
 */

export { CUMULATIVE_CATEGORIES, EXCLUSIVE_CATEGORIES, isExclusive } from './arity.js';
export type {
  CompatibilityCode,
  CompatibilityErrorCode,
  CompatibilityIssue,
  CompatibilityWarningCode,
} from './errors.js';
export {
  COMPATIBILITY_ERROR_CODES,
  COMPATIBILITY_WARNING_CODES,
  messageFor,
  RESTRICTIVE_LICENSES,
} from './errors.js';
export type { Addition, Option, Resolution, Selection } from './resolve.js';
export { optionsFor, resolve } from './resolve.js';
export {
  checkDeclaredConflicts,
  checkDeprecated,
  checkEngines,
  checkExclusiveCategories,
  checkLicenses,
  checkTargets,
} from './rules.js';

/**
 * Registry des technologies base de connaissances du catalogue (§7, §11).
 *
 * Le registry déclare ce qu'est une technologie : sa catégorie, ses cibles, sa
 * licence, ses paquets, ses relations. Il ne raisonne pas dessus décider si
 * deux technologies vont ensemble est le travail du compatibility engine
 * (Phase 4).
 */

export { loadCatalogue } from './catalogue.js';
export type { RegistryIssue, RegistryIssueCode, RegistryPathSegment } from './errors.js';
export { messageFor, REGISTRY_ISSUE_CODES } from './errors.js';
export type { IntegrityCode, IntegrityIssue, IntegritySeverity } from './integrity.js';
export { checkIntegrity, INTEGRITY_CODES } from './integrity.js';
export type { Registry, RegistryQuery } from './load.js';
export { loadRegistry } from './load.js';
export type {
  Category,
  Ecosystem,
  GenerationStatus,
  License,
  LifecycleStatus,
  RegistryEntry,
} from './schema/entry.js';
export {
  CATEGORIES,
  ECOSYSTEMS,
  entrySchema,
  GENERATION_STATUSES,
  LICENSES,
  LIFECYCLE_STATUSES,
  RUNTIME_ECOSYSTEMS,
  UI_ECOSYSTEMS,
} from './schema/entry.js';
export type { AppField, Slot } from './slots.js';
export { SLOTS, slotFor } from './slots.js';
export type { TargetCoverage } from './targets.js';
export { FRAMEWORK_CATEGORIES, targetCoverage, targetsWithoutFramework } from './targets.js';

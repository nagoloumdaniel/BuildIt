/**
 * Registry des technologies — base de connaissances du catalogue (§7, §11).
 *
 * Le registry déclare ce qu'est une technologie : sa catégorie, ses cibles, sa
 * licence, ses paquets, ses relations. Il ne raisonne pas dessus — décider si
 * deux technologies vont ensemble est le travail du compatibility engine
 * (Phase 4).
 */

export type { IntegrityCode, IntegrityIssue, IntegritySeverity } from './integrity.js';
export { checkIntegrity, INTEGRITY_CODES } from './integrity.js';
export type {
  Category,
  GenerationStatus,
  License,
  LifecycleStatus,
  RegistryEntry,
} from './schema/entry.js';
export {
  CATEGORIES,
  entrySchema,
  GENERATION_STATUSES,
  LICENSES,
  LIFECYCLE_STATUSES,
} from './schema/entry.js';

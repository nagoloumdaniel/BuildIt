/**
 * Project Manifest le contrat d'entrée du moteur (cahier des charges §10).
 *
 * L'UI et le CLI produisent tous deux un manifest, et un seul pipeline le
 * consomme (§9). Ce paquet valide sa **forme** ; savoir ce que désigne le slug
 * « next » est le travail du registry, et savoir s'il va avec « prisma » celui
 * du compatibility engine.
 */

export type { ParseResult } from '@buildit/validation';
export type { SkeletonDir, SkeletonStack } from './architecture-skeleton.js';
export { skeletonTree, withoutDuplicateShared } from './architecture-skeleton.js';
export type { ManifestIssue, ManifestIssueCode, ManifestPathSegment } from './errors.js';
export { MANIFEST_ISSUE_CODES, suggest } from './errors.js';
export type { Migration } from './migrate.js';
export { applyMigrations, MIGRATIONS, migrateManifest } from './migrate.js';
export { parseManifest } from './parse.js';
export type { Architecture, Target } from './schema/enums.js';
export { ARCHITECTURES, TARGETS } from './schema/enums.js';
export type {
  Manifest,
  ManifestAuth,
  ManifestBackend,
  ManifestDatabase,
  ManifestDesktop,
  ManifestFrontend,
  ManifestMobile,
  ManifestShareLink,
} from './schema/manifest.js';
export { MANIFEST_KEY_ORDER } from './schema/manifest.js';
export { ENV_NAME_PATTERN, PROJECT_NAME_PATTERN } from './schema/primitives.js';
export { canonicalizeManifest, serializeManifest } from './serialize.js';
export type { SkeletonFile, SkeletonFilesOptions } from './skeleton-files.js';
export { isoDate, skeletonFiles } from './skeleton-files.js';
export { isSupportedManifestVersion, MANIFEST_VERSION } from './version.js';

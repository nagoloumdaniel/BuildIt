import { messageFor } from './errors.js';
import { parseManifest } from './parse.js';
import { fail, type ParseResult } from './result.js';
import type { Manifest } from './schema/manifest.js';
import { MANIFEST_VERSION } from './version.js';

/**
 * Migration d'un manifest d'une version de schéma vers la suivante.
 *
 * La chaîne est vide aujourd'hui : il n'existe qu'une version. Le mécanisme est
 * néanmoins livré et testé, parce que le jour où la V1 ajoutera mobile et
 * desktop au périmètre (§23), des manifests v1 circuleront déjà dans des liens
 * de partage (§20). Inventer la machinerie à ce moment-là, sous contrainte de
 * compatibilité, est la mauvaise façon de s'y prendre.
 */
export interface Migration {
  /** Version d'entrée. */
  readonly from: number;
  /** Version de sortie. Doit être supérieure à `from`. */
  readonly to: number;
  /** Transformation. Reçoit une valeur non fiable, renvoie une valeur non fiable. */
  readonly migrate: (input: unknown) => unknown;
}

/** Migrations enregistrées, appliquées dans l'ordre croissant des versions. */
export const MIGRATIONS: readonly Migration[] = [];

function unsupported(version: unknown): ParseResult<Manifest> {
  return fail([
    {
      code: 'MANIFEST_VERSION_UNSUPPORTED',
      path: ['manifestVersion'],
      message: messageFor('MANIFEST_VERSION_UNSUPPORTED', {
        value: String(version),
        supported: String(MANIFEST_VERSION),
      }),
    },
  ]);
}

function readVersion(input: unknown): number | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return undefined;
  }
  const version = (input as Record<string, unknown>)['manifestVersion'];
  return typeof version === 'number' && Number.isInteger(version) ? version : undefined;
}

/**
 * Applique une chaîne de migrations puis valide le résultat.
 *
 * Exposée séparément de `migrateManifest` pour que les tests puissent injecter
 * des migrations factices : la machinerie doit être prouvée avant qu'il existe
 * une vraie migration à lui confier.
 */
export function applyMigrations(
  input: unknown,
  migrations: readonly Migration[],
): ParseResult<Manifest> {
  const startVersion = readVersion(input);
  if (startVersion === undefined) {
    return parseManifest(input);
  }
  if (startVersion > MANIFEST_VERSION) {
    return unsupported(startVersion);
  }

  const byFrom = new Map(migrations.map((migration) => [migration.from, migration]));
  let current: unknown = input;
  let version = startVersion;

  while (version < MANIFEST_VERSION) {
    const migration = byFrom.get(version);
    if (migration === undefined) {
      return unsupported(startVersion);
    }
    try {
      current = migration.migrate(current);
    } catch {
      // Une migration qui lève est un bug de notre côté, pas une erreur de
      // l'utilisateur. On le lui présente comme un format illisible plutôt que
      // de laisser remonter une exception au travers du CLI ou de l'UI.
      return unsupported(startVersion);
    }
    version = migration.to;
  }

  return parseManifest(current);
}

/** Migre un manifest depuis n'importe quelle version connue vers la version courante. */
export function migrateManifest(input: unknown): ParseResult<Manifest> {
  return applyMigrations(input, MIGRATIONS);
}

import { suggest } from '@project-factory/manifest';
import type { RegistryEntry } from './schema/entry.js';

/**
 * Vérifications portant sur le registry **dans son ensemble**.
 *
 * Une fiche peut être parfaitement valide et le catalogue incohérent : une
 * référence vers une entrée renommée, deux fiches qui se contredisent, un
 * identifiant en double. Le schéma ne peut rien contre ça — il ne voit qu'une
 * fiche à la fois.
 */

export type IntegritySeverity = 'error' | 'warning';

export const INTEGRITY_CODES = [
  'REGISTRY_DUPLICATE_ID',
  'REGISTRY_UNKNOWN_REFERENCE',
  'REGISTRY_SELF_REFERENCE',
  'REGISTRY_CONTRADICTORY_RELATION',
  'REGISTRY_TARGET_MISMATCH',
  'REGISTRY_STALE_ENTRY',
] as const;

export type IntegrityCode = (typeof INTEGRITY_CODES)[number];

export interface IntegrityIssue {
  readonly code: IntegrityCode;
  readonly severity: IntegritySeverity;
  /** Identifiant de la fiche fautive. */
  readonly entryId: string;
  readonly message: string;
  readonly hint?: string;
}

/** Champs dont les valeurs désignent d'autres fiches du registry. */
const RELATION_FIELDS = ['requires', 'compatibleWith', 'conflictsWith'] as const;

type RelationField = (typeof RELATION_FIELDS)[number];

/** Une fiche non revue depuis plus d'un an mérite un rappel, pas un blocage (§7). */
const STALE_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

function relationsOf(entry: RegistryEntry, field: RelationField): readonly string[] {
  return entry[field] ?? [];
}

/**
 * Contrôle l'intégrité du registry et renvoie **tous** les problèmes trouvés.
 *
 * Ne s'arrête pas au premier : un contributeur qui ajoute une fiche veut voir
 * ses trois fautes de frappe d'un coup, pas les découvrir une par une à chaque
 * exécution de la CI.
 */
export function checkIntegrity(entries: readonly RegistryEntry[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];

  const byId = new Map<string, RegistryEntry>();
  const reported = new Set<string>();
  for (const entry of entries) {
    if (byId.has(entry.id)) {
      if (!reported.has(entry.id)) {
        reported.add(entry.id);
        issues.push({
          code: 'REGISTRY_DUPLICATE_ID',
          severity: 'error',
          entryId: entry.id,
          message: `Deux fiches portent l'identifiant « ${entry.id} ».`,
        });
      }
      continue;
    }
    byId.set(entry.id, entry);
  }

  const knownIds = [...byId.keys()];
  const now = Date.now();

  for (const entry of byId.values()) {
    for (const field of RELATION_FIELDS) {
      for (const reference of relationsOf(entry, field)) {
        if (reference === entry.id) {
          issues.push({
            code: 'REGISTRY_SELF_REFERENCE',
            severity: 'error',
            entryId: entry.id,
            message: `La fiche « ${entry.id} » se cite elle-même dans « ${field} ».`,
          });
          continue;
        }

        const referenced = byId.get(reference);
        if (referenced === undefined) {
          // `suggest` vient de @project-factory/manifest : chercher la faute de
          // frappe la plus proche est le même problème ici et là, et deux
          // implémentations finiraient par diverger — l'une corrigée, l'autre pas.
          const hint = suggest(reference, knownIds);
          issues.push({
            code: 'REGISTRY_UNKNOWN_REFERENCE',
            severity: 'error',
            entryId: entry.id,
            message: `La fiche « ${entry.id} » cite « ${reference} » dans « ${field} », qui n'existe pas dans le registry.`,
            ...(hint === undefined ? {} : { hint: `Vouliez-vous dire « ${hint} » ?` }),
          });
          continue;
        }

        // Seul `requires` contraint les cibles : une dépendance obligatoire doit
        // exister sur au moins une plateforme commune. `compatibleWith` ne le
        // contraint pas — Next et Expo cohabitent très bien dans un monorepo
        // web + mobile sans partager de cible.
        if (field === 'requires') {
          const shared = entry.targets.some((target) => referenced.targets.includes(target));
          if (!shared) {
            issues.push({
              code: 'REGISTRY_TARGET_MISMATCH',
              severity: 'error',
              entryId: entry.id,
              message: `La fiche « ${entry.id} » requiert « ${reference} », qui ne couvre aucune de ses cibles.`,
            });
          }
        }
      }
    }

    const compatible = new Set(relationsOf(entry, 'compatibleWith'));
    for (const conflicting of relationsOf(entry, 'conflictsWith')) {
      if (compatible.has(conflicting)) {
        issues.push({
          code: 'REGISTRY_CONTRADICTORY_RELATION',
          severity: 'error',
          entryId: entry.id,
          message: `La fiche « ${entry.id} » déclare « ${conflicting} » à la fois compatible et en conflit.`,
        });
      }
    }

    const reviewedAt = new Date(`${entry.lastReviewedAt}T00:00:00Z`).getTime();
    if (now - reviewedAt > STALE_AFTER_MS) {
      issues.push({
        code: 'REGISTRY_STALE_ENTRY',
        severity: 'warning',
        entryId: entry.id,
        message: `La fiche « ${entry.id} » n'a pas été revue depuis le ${entry.lastReviewedAt}.`,
        hint: 'La politique du §7 prévoit une revue trimestrielle du catalogue.',
      });
    }
  }

  return issues;
}

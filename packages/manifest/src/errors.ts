import { createMessageFormatter, type Issue, type PathSegment } from '@project-factory/validation';

/**
 * Codes et messages de validation du Project Manifest.
 *
 * Le modèle d'erreur lui-même (code stable, chemin, indice) vit dans
 * `@project-factory/validation` : il est partagé avec le registry. Ce fichier
 * ne porte plus que ce qui est propre au manifest — sa liste de codes et son
 * catalogue de phrases.
 */

/** Tous les codes que la validation du manifest peut produire. */
export const MANIFEST_ISSUE_CODES = [
  'MANIFEST_NOT_AN_OBJECT',
  'MANIFEST_VERSION_MISSING',
  'MANIFEST_VERSION_UNSUPPORTED',
  'MANIFEST_FIELD_REQUIRED',
  'MANIFEST_UNKNOWN_FIELD',
  'MANIFEST_TYPE_MISMATCH',
  'MANIFEST_NAME_INVALID',
  'MANIFEST_TARGETS_EMPTY',
  'MANIFEST_ENUM_UNKNOWN',
  'MANIFEST_SLUG_INVALID',
  'MANIFEST_DUPLICATE_ENTRY',
] as const;

export type ManifestIssueCode = (typeof MANIFEST_ISSUE_CODES)[number];

export type ManifestPathSegment = PathSegment;

export type ManifestIssue = Issue<ManifestIssueCode>;

/**
 * Catalogue des messages, indexé par code.
 *
 * C'est le seul endroit du paquet où vit une phrase destinée à un humain.
 */
const MESSAGES: Readonly<Record<ManifestIssueCode, string>> = {
  MANIFEST_NOT_AN_OBJECT: 'Le manifest doit être un objet JSON, pas {actual}.',
  MANIFEST_VERSION_MISSING:
    "Le champ « manifestVersion » est absent. Ce manifest n'a pas été produit par Project Factory.",
  MANIFEST_VERSION_UNSUPPORTED:
    'Version de manifest non prise en charge : {value}. Cette version de Project Factory lit la version {supported}.',
  MANIFEST_FIELD_REQUIRED: 'Le champ « {field} » est obligatoire.',
  MANIFEST_UNKNOWN_FIELD:
    "Le champ « {field} » n'existe pas dans un manifest. Vérifiez l'orthographe.",
  MANIFEST_TYPE_MISMATCH: 'Le champ « {field} » doit être {expected}, et non {actual}.',
  MANIFEST_NAME_INVALID:
    'Nom de projet invalide : {value}. Attendu un nom de paquet npm — minuscules, chiffres, tirets, 214 caractères au plus.',
  MANIFEST_TARGETS_EMPTY:
    'Aucune cible sélectionnée. Un projet vise au moins une plateforme : {expected}.',
  MANIFEST_ENUM_UNKNOWN: 'Valeur inconnue : {value}. Valeurs acceptées : {expected}.',
  MANIFEST_SLUG_INVALID:
    'Identifiant de technologie invalide : {value}. Attendu des minuscules et des chiffres séparés par des tirets, par exemple « better-auth ».',
  MANIFEST_DUPLICATE_ENTRY: 'La valeur {value} apparaît plusieurs fois.',
};

export const messageFor: (
  code: ManifestIssueCode,
  params: Readonly<Record<string, string>>,
) => string = createMessageFormatter(MESSAGES);

export { suggest } from '@project-factory/validation';

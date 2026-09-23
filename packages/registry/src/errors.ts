import { createMessageFormatter, type Issue, type PathSegment } from '@project-factory/validation';

/**
 * Codes et messages de validation du registry.
 *
 * Même modèle que le manifest : un code stable, un chemin, un message français,
 * un indice. Le modèle lui-même vit dans `@project-factory/validation` ; ce
 * fichier ne porte que ce qui est propre au registry.
 */

export const REGISTRY_ISSUE_CODES = [
  'REGISTRY_ENTRY_NOT_AN_OBJECT',
  'REGISTRY_FIELD_REQUIRED',
  'REGISTRY_UNKNOWN_FIELD',
  'REGISTRY_TYPE_MISMATCH',
  'REGISTRY_ID_INVALID',
  'REGISTRY_ENUM_UNKNOWN',
  'REGISTRY_SLUG_INVALID',
  'REGISTRY_ENV_NAME_INVALID',
  'REGISTRY_DATE_INVALID',
  'REGISTRY_TEMPLATE_PATH_INVALID',
  'REGISTRY_URL_INVALID',
  'REGISTRY_NAME_INVALID',
  'REGISTRY_DUPLICATE_VALUE',
  'REGISTRY_CERTIFIED_WITHOUT_TEMPLATE',
  'REGISTRY_DECLARED_WITH_TEMPLATE',
  // Codes d'intégrité — voir integrity.ts
  'REGISTRY_DUPLICATE_ID',
  'REGISTRY_UNKNOWN_REFERENCE',
  'REGISTRY_SELF_REFERENCE',
  'REGISTRY_CONTRADICTORY_RELATION',
  'REGISTRY_TARGET_MISMATCH',
  'REGISTRY_STALE_ENTRY',
] as const;

export type RegistryIssueCode = (typeof REGISTRY_ISSUE_CODES)[number];

export type RegistryIssue = Issue<RegistryIssueCode>;

export type RegistryPathSegment = PathSegment;

const MESSAGES: Readonly<Record<RegistryIssueCode, string>> = {
  REGISTRY_ENTRY_NOT_AN_OBJECT: 'Une fiche doit être un objet JSON, pas {actual}.',
  REGISTRY_FIELD_REQUIRED: 'Le champ « {field} » est obligatoire dans une fiche.',
  REGISTRY_UNKNOWN_FIELD:
    "Le champ « {field} » n'existe pas dans une fiche. Vérifiez l'orthographe.",
  REGISTRY_TYPE_MISMATCH: 'Le champ « {field} » doit être {expected}, et non {actual}.',
  REGISTRY_ID_INVALID:
    'Identifiant de fiche invalide : {value}. Attendu des minuscules et des chiffres séparés par des tirets, par exemple « better-auth ».',
  REGISTRY_ENUM_UNKNOWN: 'Valeur inconnue : {value}. Valeurs acceptées : {expected}.',
  REGISTRY_SLUG_INVALID:
    'Identifiant invalide : {value}. Attendu des minuscules et des chiffres séparés par des tirets.',
  REGISTRY_ENV_NAME_INVALID:
    "Nom de variable d'environnement invalide : {value}. Attendu des majuscules et des tirets bas, par exemple « DATABASE_URL » — un nom seul, jamais une valeur.",
  REGISTRY_DATE_INVALID:
    'Date de revue invalide : {value}. Attendu une date réelle au format AAAA-MM-JJ, pas dans le futur.',
  REGISTRY_TEMPLATE_PATH_INVALID:
    'Chemin de template invalide : {value}. Attendu un chemin en minuscules, par exemple « auth/better-auth ».',
  REGISTRY_URL_INVALID:
    'URL de documentation invalide : {value}. Attendu une adresse http ou https.',
  REGISTRY_NAME_INVALID: 'Libellé invalide : {value}. Attendu 1 à 60 caractères.',
  REGISTRY_DUPLICATE_VALUE: 'La valeur {value} apparaît plusieurs fois dans la même liste.',
  REGISTRY_CERTIFIED_WITHOUT_TEMPLATE:
    "Fiche certifiée sans template : elle promettrait une génération qui n'existe pas. Ajoutez un template, ou passez la fiche en « declared ».",
  REGISTRY_DECLARED_WITH_TEMPLATE:
    'Fiche déclarée avec un template : si le template existe et qu’un test de génération le couvre, passez la fiche en « certified ».',
  REGISTRY_DUPLICATE_ID: 'Deux fiches portent le même identifiant.',
  REGISTRY_UNKNOWN_REFERENCE: 'Référence vers une fiche inexistante.',
  REGISTRY_SELF_REFERENCE: 'Une fiche se cite elle-même.',
  REGISTRY_CONTRADICTORY_RELATION: 'Une fiche est déclarée à la fois compatible et en conflit.',
  REGISTRY_TARGET_MISMATCH: 'Une dépendance ne couvre aucune cible commune.',
  REGISTRY_STALE_ENTRY: 'Fiche non revue depuis plus d’un an.',
};

export const messageFor: (
  code: RegistryIssueCode,
  params: Readonly<Record<string, string>>,
) => string = createMessageFormatter(MESSAGES);

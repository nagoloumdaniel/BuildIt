import { createMessageFormatter, type Issue, type Severity } from '@project-factory/validation';

/**
 * Codes et messages du compatibility engine.
 *
 * §12 exige des « warnings et erreurs avec justification ». Un refus sans
 * explication apprend à l'utilisateur qu'il a tort sans lui dire pourquoi —
 * c'est exactement ce que le §5 cherche à éviter en grisant les options plutôt
 * qu'en les masquant.
 */

export const COMPATIBILITY_ERROR_CODES = [
  'COMPAT_NO_TARGET',
  'COMPAT_UNKNOWN_TECHNOLOGY',
  'COMPAT_EXCLUSIVE_CATEGORY',
  'COMPAT_DECLARED_CONFLICT',
  'COMPAT_TARGET_UNSUPPORTED',
  'COMPAT_CIRCULAR_DEPENDENCY',
  'COMPAT_ENGINE_UNSATISFIABLE',
] as const;

export const COMPATIBILITY_WARNING_CODES = [
  'COMPAT_EXPERIMENTAL_COMBINATION',
  'COMPAT_DEPRECATED_TECHNOLOGY',
  'COMPAT_RESTRICTIVE_LICENSE',
] as const;

export type CompatibilityErrorCode = (typeof COMPATIBILITY_ERROR_CODES)[number];
export type CompatibilityWarningCode = (typeof COMPATIBILITY_WARNING_CODES)[number];
export type CompatibilityCode = CompatibilityErrorCode | CompatibilityWarningCode;

export interface CompatibilityIssue extends Issue<CompatibilityCode> {
  readonly severity: Severity;
}

const MESSAGES: Readonly<Record<CompatibilityCode, string>> = {
  COMPAT_NO_TARGET: 'Aucune plateforme cible sélectionnée. Un projet vise au moins une plateforme.',
  COMPAT_UNKNOWN_TECHNOLOGY: 'Technologie inconnue : {value}. Elle n’existe pas dans le catalogue.',
  COMPAT_EXCLUSIVE_CATEGORY:
    '{first} et {second} remplissent tous deux le rôle « {category} ». Un projet n’en utilise qu’un.',
  COMPAT_DECLARED_CONFLICT: '{first} est incompatible avec {second}.',
  COMPAT_TARGET_UNSUPPORTED:
    '{value} ne fonctionne sur aucune des plateformes choisies. Il vise {supported}, vous avez choisi {selected}.',
  COMPAT_CIRCULAR_DEPENDENCY:
    'Dépendances circulaires dans le catalogue : {value}. C’est un défaut du registry, pas de votre sélection.',
  COMPAT_ENGINE_UNSATISFIABLE:
    '{first} exige {runtime} {firstRange}, {second} exige {runtime} {secondRange}. Aucune version ne satisfait les deux.',
  COMPAT_EXPERIMENTAL_COMBINATION:
    'Combinaison expérimentale : {value} n’est couverte par aucun test de génération. Le projet sera généré, sans garantie qu’il compile.',
  COMPAT_DEPRECATED_TECHNOLOGY:
    '{value} est dépréciée. Elle reste utilisable, mais n’est plus recommandée pour un nouveau projet.',
  COMPAT_RESTRICTIVE_LICENSE:
    '{value} est sous licence {license}, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.',
};

export const messageFor: (
  code: CompatibilityCode,
  params: Readonly<Record<string, string>>,
) => string = createMessageFormatter(MESSAGES);

/**
 * Licences à contrainte de redistribution (§11).
 *
 * Ni un jugement de valeur ni un avis juridique : un signalement, pour que
 * l'utilisateur vérifie avant de livrer. C'est la liste fermée de licences du
 * registry qui rend cette alerte fiable — une licence approximée la rendrait
 * inutile.
 */
export const RESTRICTIVE_LICENSES: readonly string[] = [
  'AGPL-3.0',
  'SSPL-1.0',
  'BSL-1.1',
  'Elastic-2.0',
  'GPL-2.0',
  'GPL-3.0',
];

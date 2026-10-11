/**
 * `@buildit/ui` — les primitives d'interface partagées (Phase 8).
 *
 * Elles ne portent que des classes `pf-*` et un rôle ARIA : ni style propre, ni
 * données, ni logique métier, ni dépendance à Next. Les tokens des deux thèmes
 * vivent dans `apps/web/src/app/globals.css` (direction artistique 8A) et sont
 * la seule source de couleur.
 */

export type { BadgeProps, BadgeTone } from './badge.js';
export { Badge, badgeClassName } from './badge.js';
export type { ButtonProps, ButtonVariant } from './button.js';
export { Button, buttonClassName } from './button.js';
export { joinClassNames } from './class-names.js';
export type { FieldProps } from './field.js';
export { Field } from './field.js';
export type { StatusMessageProps, StatusMessageTone } from './status-message.js';
export { StatusMessage } from './status-message.js';

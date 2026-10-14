import type { ReactElement, ReactNode } from 'react';
import { joinClassNames } from './class-names.js';

/** Tons du message : l'aide (`pf-hint`) ou le refus (`pf-error`). */
export type StatusMessageTone = 'hint' | 'error';

const STATUS_TONE_CLASS: Record<StatusMessageTone, string> = {
  hint: 'pf-hint',
  error: 'pf-error',
};

export type StatusMessageProps = {
  readonly tone?: StatusMessageTone;
  /** Force le rôle ; par défaut, l'erreur est `alert`, l'aide `status`. */
  readonly role?: 'status' | 'alert';
  readonly className?: string;
  readonly children?: ReactNode;
};

/**
 * Une ligne d'état annoncée aux lecteurs d'écran.
 *
 * Le rôle ARIA suit le ton : une aide est une région `status` (polie), une
 * erreur est un `alert` (assertif) c'est précisément ce qu'un `<p>` stylé
 * seul ne dit pas. Les deux rendent les mêmes classes que le balisage manuel.
 */
export function StatusMessage({
  tone = 'hint',
  role,
  className,
  children,
}: StatusMessageProps): ReactElement {
  return (
    <p
      className={joinClassNames(STATUS_TONE_CLASS[tone], className)}
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
    >
      {children}
    </p>
  );
}

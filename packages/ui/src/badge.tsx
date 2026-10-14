import type { ReactElement, ReactNode } from 'react';
import { joinClassNames } from './class-names.js';

/** Tons du badge : la classe de base `pf-badge` est toujours présente. */
export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'danger';

const BADGE_BASE_CLASS = 'pf-badge';

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: '',
  accent: 'pf-badge-accent',
  ok: 'pf-badge-ok',
  danger: 'pf-badge-danger',
};

/** La classe d'un badge, pour un élément qui n'est pas un `<span>`. */
export function badgeClassName(tone: BadgeTone = 'neutral', className?: string): string {
  return joinClassNames(BADGE_BASE_CLASS, BADGE_TONE_CLASS[tone], className);
}

export type BadgeProps = {
  readonly tone?: BadgeTone;
  readonly className?: string;
  readonly children?: ReactNode;
};

/** L'étiquette courte d'un état (« Recommandé », « Connecté », « Lecture seule »). */
export function Badge({ tone = 'neutral', className, children }: BadgeProps): ReactElement {
  return <span className={badgeClassName(tone, className)}>{children}</span>;
}

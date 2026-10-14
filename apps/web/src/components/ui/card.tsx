import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from './icon';

/**
 * Les cartes.
 *
 * Une carte n'est pas un conteneur par défaut : elle délimite **une unité de
 * décision** (un réglage, un résultat, un refus). Du contenu qui n'a pas de
 * frontière propre reste dans le flux de la page c'est ce qui évite la
 * grille de rectangles identiques où plus rien ne hiérarchise.
 *
 * Trois tons seulement, et chacun dit quelque chose :
 * - `plain` : l'information ;
 * - `accent` : la carte qui porte l'action principale de l'écran, une par
 *   écran ;
 * - `danger` / `warn` / `ok` : un état, posé par le résultat, jamais choisi
 *   pour décorer.
 */

export type CardTone = 'plain' | 'accent' | 'ok' | 'warn' | 'danger';

const TONE_CLASS: Readonly<Record<CardTone, string>> = {
  plain: '',
  accent: 'pf-card-accent',
  ok: '',
  warn: '',
  danger: '',
};

const TONE_STYLE: Readonly<Record<CardTone, Record<string, string> | undefined>> = {
  plain: undefined,
  accent: undefined,
  ok: { borderColor: 'var(--pf-ok-line)', background: 'var(--pf-ok-soft)' },
  warn: { borderColor: 'var(--pf-warn-line)', background: 'var(--pf-warn-soft)' },
  danger: { borderColor: 'var(--pf-danger-line)', background: 'var(--pf-danger-soft)' },
};

export interface CardProps {
  readonly tone?: CardTone;
  readonly className?: string;
  readonly children?: ReactNode;
  /** Sans rembourrage : la carte porte elle-même une liste ou un tableau. */
  readonly flush?: boolean;
  readonly id?: string;
}

export function Card({
  tone = 'plain',
  className,
  children,
  flush = false,
  id,
}: CardProps): ReactElement {
  const classes = ['pf-card', TONE_CLASS[tone], flush ? '' : 'pf-card-pad', className ?? '']
    .filter((part) => part !== '')
    .join(' ');
  return (
    <section className={classes} id={id} style={TONE_STYLE[tone]}>
      {children}
    </section>
  );
}

export interface CardHeadProps {
  /** L'étiquette de donnée au-dessus du titre : courte, en chasse fixe. */
  readonly eyebrow?: ReactNode;
  readonly icon?: IconName;
  readonly title: ReactNode;
  readonly note?: ReactNode;
  /** Les gestes de la carte, alignés à droite du titre. */
  readonly actions?: ReactNode;
}

/**
 * L'en-tête d'une carte : icône, étiquette, titre, note, gestes.
 *
 * L'icône est à gauche du titre et non au-dessus : elle appartient à la même
 * ligne de lecture que lui, et la carte ne gagne pas une rangée vide.
 */
export function CardHead({ eyebrow, icon, title, note, actions }: CardHeadProps): ReactElement {
  return (
    <div className="pf-card-head">
      <div className="min-w-0">
        {eyebrow === undefined ? null : <p className="pf-eyebrow">{eyebrow}</p>}
        <h2 className="pf-title-sm flex items-center gap-2">
          {icon === undefined ? null : (
            <span style={{ color: 'var(--pf-accent)' }}>
              <Icon name={icon} size={18} />
            </span>
          )}
          {title}
        </h2>
        {note === undefined ? null : <p className="pf-hint mt-1">{note}</p>}
      </div>
      {actions === undefined ? null : (
        <div
          className="pf-card-actions flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-none"
          data-slot="card-actions"
        >
          {actions}
        </div>
      )}
    </div>
  );
}

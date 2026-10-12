'use client';

import type { ReactElement } from 'react';
import { Icon, type IconName } from '../../components/ui/icon';
import { Spinner } from '../../components/ui/loading';

/**
 * La carte qui **est** le geste : l'appuyer ouvre l'explorateur.
 *
 * Avant, la carte portait un bouton « Choisir un dossier » et un lien « Écran
 * d'ouverture » : deux cibles pour une seule intention, dans un cadre qui en
 * suggérait une troisième. Ici la carte entière est le bouton — la cible fait
 * toute sa surface, il n'y a rien à viser, et le reste de l'écran ne porte plus
 * de choix à faire avant de choisir.
 *
 * Elle ne décide de rien : qui ouvre l'explorateur (le serveur en local, le
 * navigateur en hébergé) et ce qu'on en fait ensuite appartiennent à
 * l'appelant. Elle rend un état, et elle le dit pendant qu'il dure.
 */

export interface PickCardProps {
  readonly title: string;
  readonly note: string;
  readonly icon?: IconName;
  /** L'explorateur est ouvert, ou le dossier est en cours de lecture. */
  readonly busy?: boolean;
  /** La phrase de l'attente — elle nomme le travail, jamais « Chargement… ». */
  readonly busyLabel?: string;
  readonly disabled?: boolean;
  readonly onPick: () => void;
  readonly className?: string;
}

export function PickCard({
  title,
  note,
  icon = 'folderOpen',
  busy = false,
  busyLabel,
  disabled = false,
  onPick,
  className,
}: PickCardProps): ReactElement {
  return (
    <button
      aria-busy={busy}
      className={`pf-choice${className === undefined ? '' : ` ${className}`}`}
      disabled={disabled || busy}
      onClick={onPick}
      type="button"
    >
      <span className="pf-choice-name">
        <span aria-hidden="true" style={{ color: 'var(--pf-accent)' }}>
          <Icon name={icon} size={16} />
        </span>
        {title}
      </span>
      <span className="pf-choice-note">{note}</span>
      {busy && busyLabel !== undefined ? (
        <span className="pf-choice-note mt-2 flex items-center gap-2" role="status">
          <Spinner size="sm" />
          {busyLabel}
        </span>
      ) : null}
    </button>
  );
}

import type { ReactElement, ReactNode } from 'react';
import { Icon, type IconName } from './icon';
import { Illustration, type IllustrationName } from './illustration';

/**
 * L'écran vide et l'écran en faute.
 *
 * Un vide est une invitation, pas une excuse : il nomme ce qui manquera
 * toujours tant qu'on n'agit pas, et porte le geste qui le remplit. Une faute
 * dit **ce qui s'est passé** et **quoi faire**, dans la voix de l'outil —
 * jamais « Oups, quelque chose s'est mal passé ».
 *
 * Les deux partagent la même forme parce qu'ils occupent la même place et
 * répondent à la même question : « et maintenant ? ».
 *
 * Le centrage est porté par `.pf-empty-state` (dans `globals.css`) et non par
 * un utilitaire : collé à une interpolation (`text-center${…}`), le nom de
 * classe n'était pas repéré par l'analyseur de Tailwind, la règle n'était
 * jamais engendrée, et le titre restait à gauche d'un bloc centré un
 * désalignement visible sur chaque écran vide.
 */

export type EmptyTone = 'neutral' | 'danger';

export interface EmptyStateProps {
  readonly icon?: IconName;
  /**
   * Un dessin plutôt qu'une pastille d'icône, quand le vide est structurant
   * (aucun projet, aucune donnée, page introuvable). Les deux ne se cumulent
   * pas : une illustration **remplace** la pastille, elle ne s'y ajoute pas.
   */
  readonly illustration?: IllustrationName;
  readonly title: ReactNode;
  readonly body?: ReactNode;
  /** Un bouton, un lien, ou les deux. Jamais plus de deux. */
  readonly actions?: ReactNode;
  readonly tone?: EmptyTone;
  readonly className?: string;
}

export function EmptyState({
  icon = 'compass',
  illustration,
  title,
  body,
  actions,
  tone = 'neutral',
  className,
}: EmptyStateProps): ReactElement {
  const danger = tone === 'danger';
  return (
    <div
      className={`pf-card pf-card-pad pf-empty-state${className === undefined ? '' : ` ${className}`}`}
      data-tone={tone}
      {...(danger
        ? { style: { borderColor: 'var(--pf-danger-line)', background: 'var(--pf-danger-soft)' } }
        : {})}
      role={danger ? 'alert' : undefined}
    >
      {illustration === undefined ? (
        <span
          aria-hidden="true"
          className="mx-auto mb-3 flex items-center justify-center"
          style={{
            background: danger ? 'var(--pf-surface)' : 'var(--pf-accent-soft)',
            border: `1px solid ${danger ? 'var(--pf-danger-line)' : 'var(--pf-accent-line)'}`,
            borderRadius: '999px',
            color: danger ? 'var(--pf-danger)' : 'var(--pf-accent)',
            height: '2.75rem',
            width: '2.75rem',
          }}
        >
          <Icon name={danger ? 'warning' : icon} size={20} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="mx-auto mb-2 flex items-center justify-center"
          style={{ color: danger ? 'var(--pf-danger)' : 'var(--pf-accent)' }}
        >
          <Illustration name={illustration} size={84} />
        </span>
      )}
      <p className="pf-title-sm">{title}</p>
      {body === undefined ? null : (
        <p className="pf-hint mx-auto mt-1" style={{ maxWidth: '46ch' }}>
          {body}
        </p>
      )}
      {actions === undefined ? null : (
        <div className="pf-empty-state-actions mt-4 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export interface IssueListProps {
  readonly issues: readonly string[];
  /** Le titre au-dessus, quand il y a plus d'un refus à lire. */
  readonly title?: ReactNode;
  readonly className?: string;
}

/**
 * Les refus du moteur, tels quels.
 *
 * Ils ne sont pas traduits : ce sont les mêmes phrases que le CLI affiche, et
 * les chercher dans un moteur de recherche doit donner le même résultat
 * depuis les deux interfaces. Ce qui est traduit, c'est le cadre autour.
 *
 * Les phrases **identiques sont regroupées** : le moteur produit souvent le
 * même refus pour deux champs (un nom vide, deux fois), et répéter la phrase
 * entière noie les autres. Le compte est dit en marge plutôt que la répétition
 * et la clé de rendu redevient la phrase, donc unique.
 */
export function IssueList({ issues, title, className }: IssueListProps): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue, (counts.get(issue) ?? 0) + 1);
  }
  return (
    <div className={className} role="alert">
      {title === undefined ? null : <p className="pf-label">{title}</p>}
      <ul className="m-0 list-none space-y-1.5 p-0">
        {[...counts.entries()].map(([issue, count]) => (
          <li className="flex gap-2" key={issue}>
            <span
              aria-hidden="true"
              className="mt-0.5 flex-none"
              style={{ color: 'var(--pf-danger)' }}
            >
              <Icon name="warning" size={14} />
            </span>
            <span className="pf-error">{issue}</span>
            {count > 1 ? (
              <span className="pf-badge flex-none" title={`${count}×`}>
                ×{count}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface NoteListProps {
  readonly notes: readonly string[];
  readonly className?: string;
}

/** Les avertissements : la même forme que les refus, en ton neutre. */
export function NoteList({ notes, className }: NoteListProps): ReactElement | null {
  if (notes.length === 0) {
    return null;
  }
  return (
    <ul
      className={`m-0 list-none space-y-1.5 p-0${className === undefined ? '' : ` ${className}`}`}
    >
      {notes.map((note) => (
        <li className="flex gap-2" key={note}>
          <span aria-hidden="true" className="mt-0.5 flex-none" style={{ color: 'var(--pf-warn)' }}>
            <Icon name="info" size={14} />
          </span>
          <span className="pf-hint">{note}</span>
        </li>
      ))}
    </ul>
  );
}

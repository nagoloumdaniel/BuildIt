import type { ReactElement, ReactNode } from 'react';
import { IssueList } from './empty-state';
import { Icon } from './icon';
import { Illustration, type IllustrationName } from './illustration';

/**
 * L'écran en faute, avec sa sortie.
 *
 * Une erreur se raconte en trois temps, toujours dans le même ordre : ce qui
 * s'est passé (le titre), ce que ça change (le corps), et quoi faire
 * maintenant (les gestes). Les refus bruts du moteur viennent ensuite ils ne
 * sont pas traduits, ce sont les mêmes phrases que le CLI affiche.
 *
 * Il n'y a **jamais** de geste destructif ici : réessayer et revenir suffisent.
 * Une erreur n'est pas un moment où l'on demande à l'utilisateur de trancher
 * quelque chose d'irréversible.
 */

export interface ErrorStateProps {
  readonly title: ReactNode;
  readonly body?: ReactNode;
  /** Les refus du moteur, affichés tels quels sous l'explication. */
  readonly issues?: readonly string[];
  /** Au plus deux gestes : réessayer, revenir. */
  readonly actions?: ReactNode;
  readonly illustration?: IllustrationName;
  readonly className?: string;
}

export function ErrorState({
  title,
  body,
  issues,
  actions,
  illustration = 'forge',
  className,
}: ErrorStateProps): ReactElement {
  return (
    <section
      className={`pf-card pf-card-pad${className === undefined ? '' : ` ${className}`}`}
      role="alert"
      style={{ borderColor: 'var(--pf-danger-line)' }}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span aria-hidden="true" className="flex-none" style={{ color: 'var(--pf-danger)' }}>
          <Illustration name={illustration} size={64} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="pf-title-sm flex items-center gap-2">
            <span aria-hidden="true" style={{ color: 'var(--pf-danger)' }}>
              <Icon name="warning" size={16} />
            </span>
            {title}
          </p>
          {body === undefined ? null : <p className="pf-hint mt-1">{body}</p>}
          {issues === undefined || issues.length === 0 ? null : (
            <IssueList className="mt-3" issues={issues} />
          )}
          {actions === undefined ? null : (
            <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </section>
  );
}

import { type ReactElement, type ReactNode, useId } from 'react';

/**
 * Les états de chargement — **aucun squelette**.
 *
 * Un squelette promet une forme avant de la connaître : il fait sauter la
 * page quand la vraie donnée arrive plus haute ou plus courte, et il ment
 * quand la requête échoue. Ici, trois formes seulement, choisies selon ce que
 * l'on sait du travail :
 *
 * | On sait…                   | Forme            |
 * |----------------------------|------------------|
 * | rien, c'est court          | `Dots`           |
 * | rien, c'est long           | `Spinner` + phrase |
 * | le pourcentage réel        | `ProgressBar`    |
 *
 * Et une règle : jamais de pourcentage inventé. `ProgressBar` sans `value`
 * rend une barre **indéterminée**, de la même hauteur et à la même place, donc
 * passer de l'une à l'autre ne déplace rien.
 */

export interface SpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly label?: string;
  readonly className?: string;
}

export function Spinner({ size = 'md', label, className }: SpinnerProps): ReactElement {
  const sizeClass = size === 'sm' ? ' pf-spinner-sm' : size === 'lg' ? ' pf-spinner-lg' : '';
  return (
    <span
      className={`pf-spinner${sizeClass}${className === undefined ? '' : ` ${className}`}`}
      {...(label === undefined
        ? { 'aria-hidden': true }
        : { 'aria-label': label, role: 'img' as const })}
    />
  );
}

/** Trois points qui pulsent : un travail court, à côté d'un libellé. */
export function Dots({ className }: { className?: string }): ReactElement {
  return (
    <span
      aria-hidden="true"
      className={`pf-dots inline-flex items-center gap-1${className === undefined ? '' : ` ${className}`}`}
    >
      <span />
      <span />
      <span />
    </span>
  );
}

export interface ProgressBarProps {
  /** De 0 à 100. Absent : barre indéterminée — on ne connaît pas l'avancement. */
  readonly value?: number | undefined;
  readonly labelledBy?: string;
  readonly label?: string;
  readonly className?: string;
}

export function ProgressBar({
  value,
  labelledBy,
  label,
  className,
}: ProgressBarProps): ReactElement {
  const determinate = typeof value === 'number' && Number.isFinite(value);
  const clamped = determinate ? Math.min(100, Math.max(0, Math.round(value))) : 0;
  const accessibleLabel = labelledBy === undefined ? (label ?? 'Progression') : undefined;
  return (
    <div
      aria-label={accessibleLabel}
      aria-labelledby={labelledBy}
      aria-valuemax={determinate ? 100 : undefined}
      aria-valuemin={determinate ? 0 : undefined}
      aria-valuenow={determinate ? clamped : undefined}
      aria-valuetext={determinate ? `${clamped}%` : undefined}
      className={`pf-bar${determinate ? '' : ' pf-bar-indeterminate'}${className === undefined ? '' : ` ${className}`}`}
      role="progressbar"
    >
      {determinate ? <div className="pf-bar-fill" style={{ width: `${clamped}%` }} /> : null}
    </div>
  );
}

export interface LoadingLineProps {
  /** Ce qui se passe, à la première personne de l'outil : « Lecture des dépôts… ». */
  readonly children: ReactNode;
  readonly size?: 'sm' | 'md';
  readonly className?: string;
}

/**
 * La ligne d'attente : un rotor et une phrase qui **nomme le travail**.
 *
 * « Chargement… » ne dit rien ; « Lecture de vos dépôts GitHub… » dit quoi
 * attendre et combien de temps c'est raisonnable.
 */
export function LoadingLine({ children, size = 'md', className }: LoadingLineProps): ReactElement {
  return (
    <p
      aria-live="polite"
      className={`pf-hint flex items-center gap-2${className === undefined ? '' : ` ${className}`}`}
      role="status"
    >
      <Spinner size={size === 'sm' ? 'sm' : 'md'} />
      {children}
    </p>
  );
}

export interface ProgressPanelProps {
  readonly title: ReactNode;
  /** Le pas en cours, dit en clair : « Réception des objets ». */
  readonly phase?: ReactNode;
  readonly value?: number | undefined;
  /** La mesure brute à droite : « 1 284 / 3 002 objets », « 12,4 Mo ». */
  readonly detail?: ReactNode;
  readonly className?: string;
}

/**
 * Le bloc d'avancement d'une opération longue : titre, pas, barre, mesure.
 *
 * Le pourcentage et la mesure sont en chasse fixe — ce sont des valeurs. Le
 * titre et le pas sont en Inter — ce sont des phrases.
 */
export function ProgressPanel({
  title,
  phase,
  value,
  detail,
  className,
}: ProgressPanelProps): ReactElement {
  const determinate = typeof value === 'number' && Number.isFinite(value);
  const titleId = useId();
  return (
    <section className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="pf-title-sm flex items-center gap-2" id={titleId}>
          <Spinner size="sm" />
          {title}
        </p>
        {determinate ? (
          <span className="pf-mono" style={{ color: 'var(--pf-accent)', fontWeight: 600 }}>
            {Math.min(100, Math.max(0, Math.round(value)))} %
          </span>
        ) : null}
      </div>
      <ProgressBar className="mt-2" labelledBy={titleId} value={value} />
      {phase === undefined && detail === undefined ? null : (
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <p aria-live="polite" className="pf-hint" role="status">
            {phase}
          </p>
          {detail === undefined ? null : <span className="pf-mono pf-hint">{detail}</span>}
        </div>
      )}
    </section>
  );
}

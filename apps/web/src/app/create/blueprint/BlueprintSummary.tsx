import type { ReactElement } from 'react';
import type { BlueprintView } from './summary';

export interface BlueprintSummaryProps {
  readonly view: BlueprintView;
}

/**
 * Le résumé du §6.10 — un composant **pur** : il reçoit sa vue, il ne lit ni le
 * brouillon ni le moteur. Ce qui s'affiche a donc été construit par
 * `blueprintView` à partir du manifest canonique, et rien n'est recomposé ici.
 */
export function BlueprintSummary({ view }: BlueprintSummaryProps): ReactElement {
  return (
    <div>
      <h2 className="pf-title">{view.name}</h2>
      {view.headline === '' ? null : <p className="pf-subtitle">{view.headline}</p>}
      <dl className="pf-grid mt-4">
        {view.rows.map((row) => (
          <div key={row.role} className="pf-card pf-card-pad">
            <dt className="pf-eyebrow">{row.role}</dt>
            <dd className="mt-1">{row.values.map((value) => value.label).join(' · ')}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

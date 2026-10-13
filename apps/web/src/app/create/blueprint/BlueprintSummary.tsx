'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useMessages } from '../../../lib/i18n/provider';
import type { BlueprintView } from './summary';

export interface BlueprintSummaryProps {
  readonly view: BlueprintView;
}

/**
 * Le crayon d'un choix : un lien (il change de page), dessiné en bouton
 * d'icône, nommé « Modifier <choix> » pour qui ne voit pas l'icône.
 */
function EditLink({ href, label }: { href: string; label: string }): ReactElement {
  return (
    <Link
      className="pf-btn pf-btn-ghost pf-btn-icon pf-btn-sm pf-plan-edit"
      href={href}
      aria-label={label}
      title={label}
    >
      <Icon name="pencil" size={14} />
    </Link>
  );
}

/**
 * Le résumé du §6.10 — un composant **pur** : il reçoit sa vue, il ne lit ni le
 * brouillon ni le moteur. Ce qui s'affiche a donc été construit par
 * `blueprintView` à partir du manifest canonique, et rien n'est recomposé ici.
 *
 * Les crayons n'apparaissent que si la vue en porte (`editableBlueprint`) : la
 * page de partage rend la même vue sans eux, puisqu'un lien reçu ne se modifie
 * pas.
 */
export function BlueprintSummary({ view }: BlueprintSummaryProps): ReactElement {
  const t = useMessages().blueprintShare;
  return (
    <div className="min-w-0">
      <div className="pf-plan-name">
        <h2 className="pf-title break-words min-w-0">{view.name}</h2>
        {view.nameEdit === undefined ? null : <EditLink href={view.nameEdit} label={t.editName} />}
      </div>
      {view.headline === '' ? null : <p className="pf-subtitle break-words">{view.headline}</p>}
      {/* Une ligne par rôle, dans une seule carte : l'ordre de lecture et
          l'ordre de tabulation des crayons sont alors le même, de haut en bas.
          Une grille de cartes de hauteurs inégales faisait passer le clavier
          d'un crayon bas à un crayon plus haut dans la colonne voisine. */}
      <dl className="pf-card pf-plan-list mt-4">
        {view.rows.map((row) => (
          <div key={row.key} className="pf-plan-row">
            <dt className="pf-eyebrow pf-plan-role">
              {row.role}
              {row.edit === undefined ? null : (
                <EditLink href={row.edit} label={t.edit(row.role)} />
              )}
            </dt>
            <dd className="pf-plan-cell">
              {row.values.some((value) => value.edit !== undefined) ? (
                <ul className="pf-plan-values">
                  {row.values.map((value) => (
                    <li key={value.id} className="pf-plan-value">
                      <span>{value.label}</span>
                      {value.edit === undefined ? null : (
                        <EditLink href={value.edit} label={t.edit(value.label)} />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="break-words">
                  {row.values.map((value) => value.label).join(' · ')}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

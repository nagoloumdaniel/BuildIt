'use client';

import type { ReactElement } from 'react';
import type { OptionView } from '../../../lib/engine';

export interface CapabilityOptionsProps {
  readonly options: readonly OptionView[];
  /** `undefined` en test de rendu : l'écran fournit toujours un gestionnaire. */
  readonly onToggle?: (id: string) => void;
}

/**
 * Les options d'**une** famille de capacités, telles que le moteur les voit.
 *
 * Une option bloquée est désactivée et porte la raison du moteur (§12) : un
 * bouton grisé sans explication est un cul-de-sac. L'état vient de
 * `OptionView`, il n'est jamais recalculé ici — recopier une règle de
 * compatibilité la ferait diverger du CLI.
 */
export function CapabilityOptions({ options, onToggle }: CapabilityOptionsProps): ReactElement {
  if (options.length === 0) {
    return <p className="pf-hint">Aucune option dans cette famille pour l’instant.</p>;
  }

  return (
    <div className="pf-grid">
      {options.map((option) => {
        const blocked = option.state === 'blocked';
        const selected = option.state === 'selected';
        return (
          <button
            key={option.id}
            type="button"
            className="pf-choice"
            aria-pressed={selected}
            disabled={blocked}
            onClick={() => {
              onToggle?.(option.id);
            }}
          >
            <span className="pf-choice-name">
              {option.label}
              {selected ? <span className="pf-badge pf-badge-accent ml-2">Choisie</span> : null}
            </span>
            <span className="pf-choice-note pf-mono">{option.id}</span>
            {blocked ? (
              <span className="pf-error">
                <span className="pf-badge pf-badge-danger mr-1">Indisponible</span>
                {option.reason}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

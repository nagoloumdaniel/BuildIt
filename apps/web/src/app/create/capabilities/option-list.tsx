'use client';

import type { ReactElement } from 'react';
import { OptionCard } from '../../../components/ui/option-card';
import type { OptionView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';

export interface CapabilityOptionsProps {
  readonly options: readonly OptionView[];
  /** `undefined` en test de rendu : l'écran fournit toujours un gestionnaire. */
  readonly onToggle?: (id: string) => void;
}

/**
 * Les options d'**une** famille de capacités, telles que le moteur les voit.
 *
 * La carte est `OptionCard`, la même que celle du Stack Builder : une option
 * bloquée est grisée, son nom passe au rouge, et la pastille `!` ouvre la
 * raison du moteur (§12), les technologies en cause et leur documentation.
 * L'état vient de `OptionView`, il n'est jamais recalculé ici : recopier une
 * règle de compatibilité la ferait diverger du CLI.
 */
export function CapabilityOptions({ options, onToggle }: CapabilityOptionsProps): ReactElement {
  const t = useMessages();

  if (options.length === 0) {
    return <p className="pf-hint">{t.wizard.capabilities.emptyFamily}</p>;
  }

  return (
    <div className="pf-grid">
      {options.map((option) => (
        <OptionCard
          key={option.id}
          option={option}
          alternatives={
            option.state === 'blocked'
              ? options
                  .filter((item) => item.id !== option.id && item.state === 'available')
                  .slice(0, 3)
              : []
          }
          onToggle={(id) => {
            onToggle?.(id);
          }}
        />
      ))}
    </div>
  );
}

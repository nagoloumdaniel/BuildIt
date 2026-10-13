import type { ReactElement } from 'react';
import { CommandLine } from '../../../components/ui/copy';
import { Icon } from '../../../components/ui/icon';
import { useMessages } from '../../../lib/i18n/provider';
import type { InstallStep } from './install-steps';

export interface InstallGuideProps {
  readonly steps: readonly InstallStep[];
  /** Ce que copie le bouton de copie, pour son nom accessible. */
  readonly what?: string;
  readonly className?: string;
}

/**
 * La marche à suivre après une génération, étape par étape, chacune avec
 * **où** la faire : un repère « Terminal » ou « Éditeur » devant le libellé.
 *
 * Même liste ordonnée que `CommandSteps` (mêmes classes, mêmes numéros en
 * gouttière), mais une étape peut n'avoir aucune commande : renseigner `.env`
 * se fait dans un éditeur, pas dans un terminal, et une commande inventée
 * pour remplir la ligne serait fausse.
 */
export function InstallGuide({ steps, what, className }: InstallGuideProps): ReactElement {
  const labels = useMessages().output.install;
  return (
    <ol className={`pf-steps-list${className === undefined ? '' : ` ${className}`}`}>
      {steps.map((step, index) => (
        <li className="pf-steps-item" key={step.command ?? `${step.where}:${step.label}`}>
          <span aria-hidden="true" className="pf-steps-index">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="pf-install-label">
              <span className="pf-badge pf-mono pf-install-place" data-where={step.where}>
                <Icon name={step.where === 'terminal' ? 'terminal' : 'pencil'} size={12} />
                {step.where === 'terminal' ? labels.terminal : labels.editor}
              </span>
              <span className="min-w-0">{step.label}</span>
            </p>
            {step.detail === undefined ? null : <p className="pf-hint mt-1">{step.detail}</p>}
            {step.command === undefined ? null : (
              <CommandLine
                className="mt-1"
                prompt
                value={step.command}
                {...(what === undefined ? {} : { what })}
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

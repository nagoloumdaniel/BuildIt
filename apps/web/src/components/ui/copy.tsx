'use client';

import { type ReactElement, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import { toast } from '../../lib/toasts';
import { Icon } from './icon';

/**
 * Copier une valeur — commande, chemin, lien.
 *
 * Une commande affichée est une commande qu'on va taper : la sélectionner à la
 * souris dans un `<code>` qui se coupe sur n'importe quel caractère est le
 * geste le plus pénible de l'application. Le bouton est donc posé **sur la
 * valeur**, pas dans une barre d'actions lointaine.
 *
 * Trois règles tenues ici :
 * - le retour est un **échange d'icône** à taille constante (copier → coché) :
 *   rien ne bouge, ni le bouton ni la ligne qui le porte ;
 * - l'échec est dit (le presse-papiers est refusé hors contexte sécurisé, ou
 *   par la politique du navigateur) plutôt qu'avalé — un bouton qui ne fait
 *   rien sans le dire est pire que pas de bouton ;
 * - le minuteur est annulé au démontage : un `setState` après coup fait
 *   japper React et ne sert personne.
 */

/** Le temps pendant lequel le bouton reste « copié ». */
const FEEDBACK_MS = 1_600;

export interface CopyButtonProps {
  readonly value: string;
  /** Ce qui est copié, nommé pour le lecteur d'écran : « Copier la commande ». */
  readonly what?: string;
  readonly className?: string;
}

export function CopyButton({ value, what, className }: CopyButtonProps): ReactElement {
  const t = useMessages();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setDone(false), FEEDBACK_MS);
    } catch {
      toast(t.common.copyFailed, { kind: 'error' });
    }
  }, [t, value]);

  const label = done ? t.common.copied : what === undefined ? t.common.copy : t.a11y.copyWhat(what);

  return (
    <button
      aria-label={label}
      className={`pf-btn pf-btn-ghost pf-btn-sm pf-btn-icon pf-copy${className === undefined ? '' : ` ${className}`}`}
      data-copied={done ? 'true' : 'false'}
      onClick={() => void copy()}
      title={label}
      type="button"
    >
      <Icon name={done ? 'check' : 'copy'} size={14} />
    </button>
  );
}

export interface CommandLineProps {
  /** La valeur, telle qu'elle sera copiée — jamais traduite (§6). */
  readonly value: string;
  readonly what?: string;
  readonly className?: string;
  /** Un préfixe d'invite (`$`) : une commande, pas un chemin. */
  readonly prompt?: boolean;
}

/**
 * Une valeur technique et son bouton de copie, sur une seule ligne alignée.
 *
 * La valeur et le bouton partagent la ligne de base du conteneur : le bouton
 * est centré verticalement sur la **première** ligne de la valeur, pour qu'une
 * commande qui passe à la ligne ne le fasse pas descendre au milieu de nulle
 * part.
 */
export function CommandLine({
  value,
  what,
  className,
  prompt = false,
}: CommandLineProps): ReactElement {
  return (
    <div className={`pf-command${className === undefined ? '' : ` ${className}`}`}>
      {prompt ? (
        <span aria-hidden="true" className="pf-command-prompt">
          $
        </span>
      ) : null}
      <code className="pf-command-text">{value}</code>
      <CopyButton value={value} {...(what === undefined ? {} : { what })} />
    </div>
  );
}

export interface CommandStepsProps {
  readonly steps: readonly { readonly label: ReactNode; readonly command: string }[];
  readonly what?: string;
  readonly className?: string;
}

/**
 * Une marche à suivre : une étape par ligne, son libellé en prose au-dessus de
 * sa commande.
 *
 * C'est une **liste ordonnée** parce que l'ordre compte (on installe avant de
 * lancer), et les numéros sont en chasse fixe dans la gouttière : ils sont des
 * repères de séquence, pas de la décoration — et ils laissent les commandes
 * alignées sur une seule colonne.
 */
export function CommandSteps({ steps, what, className }: CommandStepsProps): ReactElement {
  return (
    <ol className={`pf-steps-list${className === undefined ? '' : ` ${className}`}`}>
      {steps.map((step, index) => (
        <li className="pf-steps-item" key={step.command}>
          <span aria-hidden="true" className="pf-steps-index">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="pf-hint">{step.label}</p>
            <CommandLine
              className="mt-1"
              prompt
              value={step.command}
              {...(what === undefined ? {} : { what })}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

'use client';

import {
  type ReactElement,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Icon, type IconName } from './icon';

/**
 * Un détail qui s'ouvre au clic, au survol **et** au clavier — une « bulle de
 * détails » plutôt qu'une infobulle.
 *
 * Pourquoi pas un `title` ni une infobulle ARIA (`role="tooltip"`) : le panneau
 * porte des **liens** (documentation officielle), et une infobulle ne peut rien
 * contenir d'interactif — elle disparaît dès qu'on la quitte pour cliquer.
 * Le motif retenu est celui du « toggletip » : un bouton qui annonce son état
 * (`aria-expanded`) et contrôle un panneau ordinaire.
 *
 * Trois façons de l'ouvrir, une seule de le garder ouvert :
 * - **survol** (souris) : il s'ouvre, et reste ouvert tant que le pointeur est
 *   sur le bouton ou sur le panneau — on peut aller cliquer un lien ;
 * - **clic**, **Entrée** ou **Espace** (et toucher, où le survol n'existe
 *   pas) : il s'**épingle** ; un second appui, `Échap`, un clic ailleurs ou la
 *   sortie du focus le referme.
 *
 * Il ne s'ouvre **pas** au simple focus : le parcours clavier l'a montré, une
 * bulle ouverte en tabulant insère ses liens dans l'ordre de tabulation de la
 * grille, et la carte suivante arrive après la documentation de la précédente.
 * Ouvrir est un geste ; passer n'en est pas un.
 *
 * Le panneau est un frère du bouton, jamais un enfant : un lien à l'intérieur
 * d'un `<button>` est du HTML invalide, et c'est exactement le piège où tombe
 * une carte d'option cliquable qui voudrait porter sa documentation.
 */

export type InfoTipTone = 'neutral' | 'danger';

export interface InfoTipProps {
  /** Le nom accessible du bouton : « Détails sur Prisma ». */
  readonly label: string;
  readonly children: ReactNode;
  readonly tone?: InfoTipTone;
  readonly icon?: IconName;
  readonly className?: string;
}

/** Le délai avant de refermer au départ du pointeur : le temps d'aller du bouton au panneau. */
const CLOSE_DELAY_MS = 140;

export function InfoTip({
  label,
  children,
  tone = 'neutral',
  icon = 'alertCircle',
  className,
}: InfoTipProps): ReactElement {
  const id = useId();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = pinned || hovered;

  const cancelClose = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const close = useCallback((): void => {
    cancelClose();
    setPinned(false);
    setHovered(false);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  // Un clic ailleurs referme la bulle épinglée : c'est ce qu'on attend d'un
  // panneau ouvert au doigt, où il n'y a pas de « quitter le survol ».
  useEffect(() => {
    if (!pinned) {
      return;
    }
    const onPointer = (event: PointerEvent): void => {
      if (root.current !== null && !root.current.contains(event.target as Node)) {
        setPinned(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [pinned]);

  // Les mêmes gestes sur le bouton **et** sur le panneau : on peut quitter l'un
  // pour l'autre (aller cliquer un lien) sans que la bulle se referme entre
  // les deux. Le délai couvre l'interstice.
  const handlers = {
    onPointerEnter: (event: ReactPointerEvent): void => {
      if (event.pointerType === 'mouse') {
        cancelClose();
        setHovered(true);
      }
    },
    onPointerLeave: (event: ReactPointerEvent): void => {
      if (event.pointerType === 'mouse') {
        cancelClose();
        timer.current = setTimeout(() => setHovered(false), CLOSE_DELAY_MS);
      }
    },
    // Quitter la bulle au clavier la referme : un panneau ouvert qu'on a
    // laissé derrière soi resterait affiché sur la carte suivante.
    onBlur: (event: ReactFocusEvent): void => {
      if (root.current === null || !root.current.contains(event.relatedTarget as Node | null)) {
        setPinned(false);
        setHovered(false);
      }
    },
    onKeyDown: (event: ReactKeyboardEvent): void => {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        close();
        trigger.current?.focus();
      }
    },
  };

  return (
    <div
      className={`pf-tip${className === undefined ? '' : ` ${className}`}`}
      data-open={open ? 'true' : 'false'}
      ref={root}
    >
      <button
        aria-controls={id}
        aria-expanded={open}
        aria-label={label}
        className="pf-tip-trigger"
        data-tone={tone}
        onClick={(event) => {
          // La carte autour est elle-même un bouton : le clic sur la bulle ne
          // doit pas cocher l'option.
          event.stopPropagation();
          setPinned((value) => !value);
        }}
        ref={trigger}
        title={label}
        type="button"
        {...handlers}
      >
        <Icon name={icon} size={16} />
      </button>
      <section aria-label={label} className="pf-tip-panel" hidden={!open} id={id} {...handlers}>
        {children}
      </section>
    </div>
  );
}

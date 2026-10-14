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
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icon';

/**
 * Un détail qui s'ouvre au clic, au survol **et** au clavier une « bulle de
 * détails » plutôt qu'une infobulle.
 *
 * Pourquoi pas un `title` ni une infobulle ARIA (`role="tooltip"`) : le panneau
 * porte des **liens** (documentation officielle), et une infobulle ne peut rien
 * contenir d'interactif elle disparaît dès qu'on la quitte pour cliquer.
 * Le motif retenu est celui du « toggletip » : un bouton qui annonce son état
 * (`aria-expanded`) et contrôle un panneau ordinaire.
 *
 * Trois façons de l'ouvrir, une seule de le garder ouvert :
 * - **survol** (souris) : il s'ouvre, et reste ouvert tant que le pointeur est
 *   sur le bouton ou sur le panneau on peut aller cliquer un lien ;
 * - **clic**, **Entrée** ou **Espace** (et toucher, où le survol n'existe
 *   pas) : il s'**épingle** ; un second appui, `Échap`, un clic ailleurs ou la
 *   sortie du focus le referme.
 *
 * Il ne s'ouvre **pas** au simple focus : le parcours clavier l'a montré, une
 * bulle ouverte en tabulant insère ses liens dans l'ordre de tabulation de la
 * grille, et la carte suivante arrive après la documentation de la précédente.
 * Ouvrir est un geste ; passer n'en est pas un.
 *
 * Ouvert, le panneau est **porté** dans `document.body` (portail) et placé en
 * `position: fixed` sous le bouton : aucun `overflow` ni contexte d'empilement
 * d'une carte ou d'une grille ne peut le couper ou le recouvrir. Fermé, il
 * reste en place, masqué le rendu serveur garde son contenu.
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
  const panel = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const open = pinned || hovered;

  useEffect(() => setMounted(true), []);

  // Le panneau est hors de l'arbre de la carte : `contains` doit regarder les deux.
  const inside = useCallback(
    (node: Node | null): boolean =>
      node !== null &&
      ((root.current?.contains(node) ?? false) || (panel.current?.contains(node) ?? false)),
    [],
  );

  // La place du panneau : sous le bouton, aligné à droite, retourné au-dessus
  // s'il déborde en bas, et toujours dans la fenêtre.
  useLayoutEffect(() => {
    if (!open || !mounted) {
      setPlace(null);
      return;
    }
    const update = (): void => {
      const button = trigger.current?.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (button === undefined) {
        return;
      }
      const width = box?.width ?? 320;
      const height = box?.height ?? 0;
      const margin = 8;
      let left = button.right - width;
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      let top = button.bottom + 6;
      if (top + height > window.innerHeight - margin && button.top - 6 - height > margin) {
        top = button.top - 6 - height;
      }
      setPlace({ top, left });
    };
    update();
    // Une seconde passe, une fois le panneau mesuré dans le portail.
    const frame = requestAnimationFrame(update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, mounted]);

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
      if (!inside(event.target as Node)) {
        setPinned(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [pinned, inside]);

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
      if (!inside(event.relatedTarget as Node | null)) {
        setPinned(false);
        setHovered(false);
      }
    },
    onKeyDown: (event: ReactKeyboardEvent): void => {
      // Le panneau vit en fin de document : Tab y entre depuis le bouton, et
      // en ressort vers le bouton, comme s'il était resté à côté.
      if (event.key === 'Tab' && open && panel.current !== null) {
        const stops = [...panel.current.querySelectorAll<HTMLElement>('a[href], button')];
        const first = stops[0];
        const last = stops[stops.length - 1];
        if (event.target === trigger.current && !event.shiftKey && first !== undefined) {
          event.preventDefault();
          first.focus();
          return;
        }
        if (event.shiftKey && event.target === first) {
          event.preventDefault();
          trigger.current?.focus();
          return;
        }
        if (!event.shiftKey && event.target === last) {
          // Le focus revient au bouton ; la tabulation par défaut continue après lui.
          trigger.current?.focus();
          return;
        }
      }
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
      {open && mounted ? (
        createPortal(
          <section
            aria-label={label}
            className="pf-tip-panel pf-tip-panel-floating"
            data-tone={tone}
            id={id}
            ref={panel}
            style={
              place === null
                ? { visibility: 'hidden', top: 0, left: 0 }
                : { top: place.top, left: place.left }
            }
            {...handlers}
          >
            {children}
          </section>,
          document.body,
        )
      ) : (
        <section aria-label={label} className="pf-tip-panel" hidden id={id}>
          {children}
        </section>
      )}
    </div>
  );
}

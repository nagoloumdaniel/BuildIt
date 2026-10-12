'use client';

import { type ReactElement, useSyncExternalStore } from 'react';
import { Icon, type IconName } from '../components/ui/icon';
import { type ActiveToast, subscribeToasts, toastSnapshot } from '../lib/toasts';

export interface ToastListProps {
  readonly toasts: readonly ActiveToast[];
}

/**
 * Le genre du toast, dit par une forme autant que par une couleur.
 *
 * La pastille colorée ne suffit pas : en niveaux de gris, ou pour un œil qui
 * distingue mal le vert du rouge, c'est l'icône qui porte l'information.
 */
const TOAST_GLYPH: Readonly<Record<ActiveToast['kind'], IconName>> = {
  info: 'info',
  success: 'check',
  error: 'warning',
};

/**
 * La liste des toasts — pure : elle reçoit son état, ne le lit pas. C'est ce qui
 * la rend vérifiable sans DOM (`renderToStaticMarkup`), là où le composant
 * connecté, lui, n'est monté que par React dans le navigateur.
 *
 * `role="status"` pose la région d'annonce dès maintenant : l'accessibilité
 * fine (politesse, libellés, focus) est l'affaire de 8F, mais le rôle ne se
 * rattrape pas après coup sans casser les lecteurs d'écran.
 */
export function ToastList({ toasts }: ToastListProps): ReactElement {
  return (
    <ol role="status" aria-live="polite" aria-atomic="false" className="pf-toasts">
      {toasts.map((toast) => (
        <li key={toast.id} data-kind={toast.kind} className="pf-toast">
          <span aria-hidden="true" className="pf-toast-icon">
            <Icon name={TOAST_GLYPH[toast.kind]} size={15} />
          </span>
          <span className="pf-toast-message">{toast.message}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Le point de branchement : `useSyncExternalStore` plutôt qu'un `useEffect`,
 * parce que le store est un module à état partagé — React lit l'instantané,
 * s'abonne, et se désabonne au démontage. Aucune dépendance, aucun contexte.
 */
export function Toaster(): ReactElement {
  const toasts = useSyncExternalStore(subscribeToasts, toastSnapshot, toastSnapshot);
  return <ToastList toasts={toasts} />;
}

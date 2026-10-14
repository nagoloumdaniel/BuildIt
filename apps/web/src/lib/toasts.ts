export interface ActiveToast {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
}

/**
 * Le store des toasts pur, sans dépendance. Un `setTimeout` par toast suffit :
 * la durée est portée par le toast, pas par une boucle de rendu, et le minuteur
 * est le seul propriétaire de l'expiration.
 */
export const DEFAULT_DURATION_MS = 4_000;

let nextId = 0;
let active: readonly ActiveToast[] = [];
const listeners = new Set<(toasts: readonly ActiveToast[]) => void>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

export function toast(
  message: string,
  options: { kind?: ActiveToast['kind']; durationMs?: number } = {},
): void {
  const id = ++nextId;
  active = [...active, { id, message, kind: options.kind ?? 'info' }];
  emit();
  setTimeout(() => {
    active = active.filter((t) => t.id !== id);
    emit();
  }, options.durationMs ?? DEFAULT_DURATION_MS);
}

/**
 * S'abonner notifie **immédiatement** l'abonné avec l'état courant : un
 * composant monté après coup ne doit pas attendre le prochain toast pour
 * afficher ceux qui sont encore à l'écran. Le désabonnement est idempotent.
 *
 * L'état est rendu par référence et n'est remplacé qu'au changement : c'est ce
 * qui rend le store utilisable tel quel par `useSyncExternalStore`.
 */
export function subscribeToasts(listener: (toasts: readonly ActiveToast[]) => void): () => void {
  listeners.add(listener);
  listener(active);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * L'instantané courant, pour `useSyncExternalStore`. Il rend la **même**
 * référence tant que rien n'a changé : React compare par identité, un tableau
 * recréé à chaque lecture provoquerait une boucle de rendu.
 */
export function toastSnapshot(): readonly ActiveToast[] {
  return active;
}

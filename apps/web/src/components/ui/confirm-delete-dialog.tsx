'use client';

import { type ReactElement, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icon';

/**
 * La popup de confirmation d'une suppression, avec **choix des cibles**.
 *
 * Elle existe comme composant unique parce que deux écrans posent exactement
 * la même question : une carte de projet, et le bouton « Vider la liste ». Le
 * geste est le seul irréversible de l'application il efface des fichiers et
 * des dépôts alors il ne part jamais d'un seul clic, et jamais sans dire
 * **ce qui** va disparaître.
 *
 * Les cibles ne sont pas devinées ici : c'est l'appelant qui n'offre que les
 * plateformes où le projet est réellement présent (un projet téléchargé en ZIP
 * n'a pas de dossier local, un projet sans dépôt n'a pas de GitHub). Le
 * composant ne connaît qu'une liste d'identifiants et deux phrases par cible :
 * `label` (ce qu'on supprime) et `note` (ce que ça coûte).
 *
 * L'élément natif `<dialog>` porte le piège du focus, l'Échap et le retour du
 * focus : `showModal()` fait ce qu'aucune `<div>` ne fait sans une centaine de
 * lignes, et le composant ne réinvente pas une modale.
 *
 * Aucune phrase n'est écrite ici : tout vient de l'appelant, qui les tient de
 * `messages.dashboard.ts`. Un libellé en dur aurait été intraduisible.
 */

/** Les trois endroits où un projet peut exister, et donc être supprimé. */
export type DeleteTargetId = 'site' | 'github' | 'local';

export interface DeleteTarget {
  readonly id: DeleteTargetId;
  /** Ce qu'on supprime, à l'infinitif : « Supprimer le dépôt GitHub ». */
  readonly label: string;
  /** Ce que ça détruit vraiment, en une phrase. */
  readonly note: string;
}

export interface ConfirmDeleteDialogProps {
  readonly title: string;
  readonly description: string;
  /** Seulement les plateformes où le projet est présent, dans l'ordre voulu. */
  readonly targets: readonly DeleteTarget[];
  readonly confirmLabel: string;
  /** Le libellé de l'abandon et celui de la fermeture, fournis par l'appelant. */
  readonly cancelLabel: string;
  readonly closeLabel: string;
  /** Une suppression est partie : tout est désactivé, la popup ne se referme pas. */
  readonly busy: boolean;
  /** Dit pendant `busy`, au lecteur d'écran comme à l'œil. */
  readonly busyLabel: string;
  /** Le refus d'une suppression : affiché avec le ton de l'erreur. */
  readonly error?: string | undefined;
  /**
   * Donné : il **remplace** le formulaire (étape de suivi, « le dépôt est
   * parti, en voulez-vous un nouveau ? ») et le bouton devient « Fermer ». Un
   * suivi qui laisserait les cases à cocher inviterait à supprimer deux fois.
   */
  readonly result?: ReactNode | undefined;
  readonly onConfirm: (ids: readonly DeleteTargetId[]) => void;
  readonly onClose: () => void;
}

export function ConfirmDeleteDialog({
  title,
  description,
  targets,
  confirmLabel,
  cancelLabel,
  closeLabel,
  busy,
  busyLabel,
  error,
  result,
  onConfirm,
  onClose,
}: ConfirmDeleteDialogProps): ReactElement {
  const dialog = useRef<HTMLDialogElement>(null);
  // Un identifiant stable par instance : deux popups montées ensemble (une par
  // carte) ne doivent pas se disputer le même `id` de titre.
  const titleId = useId();
  // Toutes cochées par défaut : la question posée est « supprimer quoi ? », et
  // la réponse la plus courante est « tout ce qui est proposé ». Une case
  // décochée est un retrait explicite, jamais un oubli.
  const [selected, setSelected] = useState<readonly DeleteTargetId[]>(() =>
    targets.map((target) => target.id),
  );

  // `showModal()` ouvre la popup au montage : le composant n'est monté que
  // quand elle est demandée, donc il n'y a pas d'attribut `open` à tenir en
  // parallèle de l'état du parent. `showModal` est aussi ce qui pose le focus
  // dans la popup et rend le reste de la page inerte.
  //
  // La fermeture, elle, se fait par **`close()`** et non par un simple
  // démontage : mesuré dans Chrome, retirer du DOM une boîte ouverte laisse le
  // focus sur `<body>`, alors que `close()` le rend au bouton qui l'a ouverte.
  // Sans ça, un parcours clavier repartait du début du document.
  useEffect(() => {
    const element = dialog.current;
    if (element !== null && !element.open) {
      element.showModal();
    }
    return () => {
      if (element !== null && element.open) {
        element.close();
      }
    };
  }, []);

  const toggle = (id: DeleteTargetId): void => {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  // Au moins une cible, et rien pendant une suppression : confirmer sans rien
  // cocher ne ferait rien, et le bouton grisé le dit plutôt que de laisser
  // croire que le clic a échoué.
  const ready = selected.length > 0 && !busy;

  return (
    // Le clic sur le fond est une **souris** : le clavier a déjà son geste de
    // fermeture, l'Échap, que `onCancel` traite ci-dessous. La règle qui exige
    // un `onKeyDown` ici ne s'applique donc pas.
    // biome-ignore lint/a11y/useKeyWithClickEvents: l'Échap est traité par `onCancel` sur ce même élément.
    <dialog
      aria-busy={busy}
      aria-labelledby={titleId}
      className="pf-dialog"
      onCancel={(event) => {
        // L'Échap est natif ; il ne doit pas fermer pendant une suppression en
        // cours, sans quoi la popup disparaîtrait au milieu d'un effacement.
        event.preventDefault();
        if (!busy) {
          onClose();
        }
      }}
      onClick={(event) => {
        // Le clic sur le fond vise l'élément `<dialog>` lui-même : c'est le
        // seul repère fiable, la boîte étant son unique enfant.
        if (event.target === dialog.current && !busy) {
          onClose();
        }
      }}
      ref={dialog}
    >
      <div className="pf-dialog-box">
        <p className="pf-title-sm flex items-center gap-2" id={titleId}>
          <span aria-hidden="true" style={{ color: 'var(--pf-danger)' }}>
            <Icon name="warning" size={16} />
          </span>
          {title}
        </p>
        <p className="pf-hint mt-1">{description}</p>

        {busy ? (
          <p className="pf-hint mt-3" role="status">
            {busyLabel}
          </p>
        ) : null}

        {error === undefined ? null : (
          <p className="pf-error mt-2" role="status">
            {error}
          </p>
        )}

        {result !== undefined ? (
          <>
            <div className="mt-3">{result}</div>
            <div className="pf-dialog-actions">
              <button className="pf-btn" onClick={onClose} type="button">
                {closeLabel}
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (ready) {
                onConfirm(selected);
              }
            }}
          >
            <ul className="pf-dialog-targets mt-3">
              {targets.map((target) => (
                <li className="pf-dialog-target" key={target.id}>
                  <input
                    checked={selected.includes(target.id)}
                    disabled={busy}
                    id={`pf-delete-${target.id}`}
                    onChange={() => toggle(target.id)}
                    type="checkbox"
                  />
                  <label htmlFor={`pf-delete-${target.id}`}>
                    <span className="pf-dialog-target-label">{target.label}</span>
                    <span className="pf-hint">{target.note}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="pf-dialog-actions">
              <button className="pf-btn pf-btn-danger" disabled={!ready} type="submit">
                <Icon name="trash" size={15} />
                {confirmLabel}
              </button>
              <button
                className="pf-btn pf-btn-ghost"
                disabled={busy}
                onClick={onClose}
                type="button"
              >
                <Icon name="close" size={15} />
                {cancelLabel}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}

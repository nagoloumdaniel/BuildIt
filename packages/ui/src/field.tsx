import type { ReactElement, ReactNode } from 'react';
import { joinClassNames } from './class-names.js';

export type FieldProps = {
  /** L'`id` du contrôle ; il sert de `htmlFor` au label. Explicite, donc stable au rendu serveur. */
  readonly id: string;
  readonly label: ReactNode;
  /** Le contrôle : `input`, `select`, `textarea`, groupe de radios… */
  readonly children?: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  readonly labelClassName?: string;
  readonly hintClassName?: string;
  readonly errorClassName?: string;
  /** `id` de l'aide, à reprendre dans l'`aria-describedby` du contrôle. */
  readonly hintId?: string;
  /** `id` de l'erreur, à reprendre dans l'`aria-describedby` du contrôle. */
  readonly errorId?: string;
};

/**
 * Label + contrôle + aide + erreur, dans l'ordre du balisage des écrans.
 *
 * Le composant ne rend **aucun élément d'enveloppe** (fragment) : il remplace
 * des lignes de JSX sans ajouter un `<div>` à la mise en page, donc sans
 * déplacer un enfant de grille. Les classes de chaque partie sont ajustables
 * (`hintClassName="mt-1"`) parce que les écrans espaçaient déjà ces lignes-là.
 *
 * Il ne porte ni validation, ni valeur, ni état : la règle métier décide de
 * l'erreur, le composant ne fait que la placer.
 */
export function Field({
  id,
  label,
  children,
  hint,
  error,
  labelClassName,
  hintClassName,
  errorClassName,
  hintId,
  errorId,
}: FieldProps): ReactElement {
  return (
    <>
      <label className={joinClassNames('pf-label', labelClassName)} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint == null ? null : (
        <p className={joinClassNames('pf-hint', hintClassName)} id={hintId}>
          {hint}
        </p>
      )}
      {error == null ? null : (
        <p className={joinClassNames('pf-error', errorClassName)} id={errorId} role="alert">
          {error}
        </p>
      )}
    </>
  );
}

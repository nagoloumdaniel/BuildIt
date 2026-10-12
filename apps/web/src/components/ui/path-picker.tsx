'use client';

import { type ReactElement, useEffect, useId, useState } from 'react';
import {
  canOpenNativePickerAction,
  pickerHomeAction,
  pickFileAction,
  pickFolderAction,
} from '../../app/actions-picker';
import { useMessages } from '../../lib/i18n/provider';
import { Icon } from './icon';
import { Spinner } from './loading';

/**
 * Choisir un dossier ou un fichier **de la machine**.
 *
 * Ce composant remplace partout le champ « collez un chemin absolu ». Un
 * chemin tapé à la main est une source d'erreur sans valeur ajoutée : la
 * machine le connaît déjà, et l'explorateur du système le donne juste.
 *
 * Deux modes, décidés par le serveur au montage :
 *
 * - **local** (`pf web`) : aucun champ de saisie. Un bouton ouvre la boîte
 *   native, et le chemin choisi s'affiche en chasse fixe, modifiable d'un
 *   clic. C'est le mode normal.
 * - **hébergé** : l'explorateur serait celui du serveur, pas celui du
 *   visiteur. Le champ de saisie réapparaît, avec la phrase qui dit pourquoi.
 *
 * Tant que le mode n'est pas connu (un aller-retour), le bouton s'affiche
 * **désactivé avec son rotor** plutôt qu'absent : un bouton qui apparaît après
 * coup déplace la mise en page sous le curseur.
 */

export interface PathPickerProps {
  readonly id?: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly kind?: 'folder' | 'file';
  readonly hint?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  /** Le libellé du bouton. Par défaut : « Choisir un dossier ». */
  readonly buttonLabel?: string;
  readonly describedBy?: string;
}

type Mode = 'unknown' | 'native' | 'manual';

export function PathPicker({
  id,
  label,
  value,
  onChange,
  kind = 'folder',
  hint,
  placeholder,
  disabled = false,
  buttonLabel,
  describedBy,
}: PathPickerProps): ReactElement {
  const t = useMessages();
  const generated = useId();
  const fieldId = id ?? `pf-path-${generated}`;
  const hintId = `${fieldId}-hint`;
  const [mode, setMode] = useState<Mode>('unknown');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [home, setHome] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    // Une action serveur qui rejette (réseau coupé, moteur arrêté) ne doit pas
    // laisser le bouton désactivé à vie : on retombe sur la saisie, qui marche
    // toujours, plutôt que sur un écran sans issue.
    void canOpenNativePickerAction()
      .then((can) => {
        if (alive) {
          setMode(can ? 'native' : 'manual');
        }
      })
      .catch(() => {
        if (alive) {
          setMode('manual');
        }
      });
    void pickerHomeAction()
      .then((path) => {
        if (alive) {
          setHome(path);
        }
      })
      .catch(() => {
        // Le dossier de départ est un confort : sans lui, la boîte s'ouvre sur
        // le dernier emplacement du système.
      });
    return () => {
      alive = false;
    };
  }, []);

  async function pick(): Promise<void> {
    setBusy(true);
    setNotice(null);
    const start = value.trim() === '' ? home : value;
    const outcome = await (kind === 'file' ? pickFileAction(start) : pickFolderAction(start));
    setBusy(false);
    if (outcome.ok) {
      onChange(outcome.path);
      return;
    }
    if (outcome.reason === 'cancelled') {
      setNotice(t.picker.cancelled);
      return;
    }
    // Le serveur croyait pouvoir ouvrir une fenêtre et n'a pas pu : on bascule
    // définitivement sur la saisie, plutôt que de proposer un bouton mort.
    setMode('manual');
    setNotice(outcome.reason === 'unsupported' ? t.picker.unsupported : t.picker.failed);
  }

  const defaultButton = kind === 'file' ? t.picker.chooseFile : t.picker.chooseFolder;

  return (
    <div>
      <span className="pf-label" id={`${fieldId}-label`}>
        {label}
      </span>

      {mode === 'manual' ? (
        <input
          aria-describedby={describedBy ?? hintId}
          aria-labelledby={`${fieldId}-label`}
          autoComplete="off"
          className="pf-input pf-mono"
          disabled={disabled}
          id={fieldId}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          value={value}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            aria-describedby={describedBy ?? hintId}
            className="pf-btn"
            disabled={disabled || busy || mode === 'unknown'}
            id={fieldId}
            onClick={() => void pick()}
            type="button"
          >
            {busy ? <Spinner size="sm" /> : <Icon name={kind === 'file' ? 'file' : 'folderOpen'} />}
            {busy ? t.picker.opening : (buttonLabel ?? defaultButton)}
          </button>

          {value === '' ? null : (
            <button
              aria-label={t.picker.clear}
              className="pf-btn pf-btn-ghost pf-btn-sm pf-btn-icon"
              disabled={disabled || busy}
              onClick={() => {
                onChange('');
                setNotice(null);
              }}
              type="button"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      )}

      {/* Le chemin choisi, lisible : c'est la valeur, elle est en chasse fixe
          et elle se coupe proprement sur un écran étroit. */}
      {mode !== 'manual' && value !== '' ? (
        <p className="pf-code mt-2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {value}
        </p>
      ) : null}

      {busy ? (
        <p aria-live="polite" className="pf-hint mt-2" role="status">
          {t.picker.openingHint}
        </p>
      ) : null}

      {notice === null ? null : (
        <p aria-live="polite" className="pf-hint mt-2" role="status">
          {notice}
        </p>
      )}

      {hint === undefined ? null : (
        <p className="pf-hint mt-1" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

'use client';

import { type ReactElement, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useMessages } from '../../lib/i18n/provider';

/**
 * La ligne de partage (§20) : [Créer un lien de partage] [lien en lecture seule] [copier].
 *
 * Partagée par le plan du projet et l'écran Dépôt : un même geste se lit de la
 * même façon partout. Le lien est **contrôlé** par l'écran (qui seul sait
 * encoder son manifest) ; ce composant ne porte que les retours du geste :
 *
 * - « Lien créé » sur le bouton pendant 3 s, pour qu'un second clic sur un
 *   lien identique se voie quand même ;
 * - « Lien copié dans le presse-papiers » sur le bouton de copie pendant 2,5 s,
 *   ou l'échec, dit tel quel : un presse-papiers refusé n'empêche pas le lien
 *   d'exister, il reste sélectionnable dans le champ.
 *
 * Les deux libellés du bouton de création occupent la même case de grille :
 * le bouton garde la largeur du plus long, et le champ voisin ne saute pas
 * quand le libellé change.
 */

const CREATED_FOR_MS = 3000;
const COPIED_FOR_MS = 2500;

type CopyState = 'idle' | 'copied' | 'failed';

export interface ShareLinkRowProps {
  /** Le lien créé, ou `null` tant qu'il ne l'est pas : le champ n'existe pas encore. */
  readonly link: string | null;
  /** Encode le lien ; rend `false` quand il n'a pas pu l'être (brouillon incomplet). */
  readonly onCreate: () => Promise<boolean> | boolean;
  readonly disabled?: boolean;
  /** L'identifiant de la phrase qui dit pourquoi le bouton est grisé (§8). */
  readonly describedBy?: string;
  readonly className?: string;
}

export function ShareLinkRow({
  link,
  onCreate,
  disabled = false,
  describedBy,
  className,
}: ShareLinkRowProps): ReactElement {
  const t = useMessages().blueprintShare;
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(false);
  const [copy, setCopy] = useState<CopyState>('idle');
  const createdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Un retour en attente ne survit pas à l'écran : sinon il écrirait dans un
  // composant démonté.
  useEffect(
    () => () => {
      clearTimeout(createdTimer.current);
      clearTimeout(copyTimer.current);
    },
    [],
  );

  async function create(): Promise<void> {
    setBusy(true);
    try {
      const ok = await onCreate();
      if (!ok) {
        return;
      }
      setCreated(true);
      setCopy('idle');
      clearTimeout(createdTimer.current);
      createdTimer.current = setTimeout(() => setCreated(false), CREATED_FOR_MS);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(): Promise<void> {
    if (link === null) {
      return;
    }
    let next: CopyState;
    try {
      await navigator.clipboard.writeText(link);
      next = 'copied';
    } catch {
      next = 'failed';
    }
    setCopy(next);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopy('idle'), COPIED_FOR_MS);
  }

  return (
    <div className={['pf-share-row', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className="pf-btn pf-share-create"
        disabled={disabled || busy}
        onClick={() => void create()}
        {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
      >
        <span className="pf-share-swap" data-shown={!created}>
          <Icon name="link" />
          {t.create}
        </span>
        <span className="pf-share-swap" data-shown={created} aria-hidden={!created}>
          <Icon name="check" />
          {t.created}
        </span>
      </button>

      {link === null ? null : (
        <div className="pf-share-field">
          <input
            id={inputId}
            className="pf-input pf-mono"
            aria-label={t.linkLabel}
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            type="button"
            className={copy === 'idle' ? 'pf-btn pf-btn-icon' : 'pf-btn'}
            aria-label={copy === 'idle' ? t.copy : undefined}
            aria-controls={inputId}
            onClick={() => void copyLink()}
          >
            {copy === 'idle' ? <Icon name="copy" /> : null}
            {copy === 'copied' ? (
              <>
                <Icon name="check" />
                {t.copied}
              </>
            ) : null}
            {copy === 'failed' ? (
              <>
                <Icon name="warning" />
                {t.copyFailed}
              </>
            ) : null}
          </button>
        </div>
      )}

      {/* Le retour du geste, lu une fois par les lecteurs d'écran. */}
      <p className="pf-sr-only" role="status">
        {created ? t.created : ''}
        {copy === 'copied' ? t.copied : copy === 'failed' ? t.copyFailed : ''}
      </p>
    </div>
  );
}

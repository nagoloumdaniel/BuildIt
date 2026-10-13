'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import { canOpenNativePickerAction } from '../actions-picker';
import { canUseFileInput } from './browser-picker';
import { browserPickMode, type PickMode, pickProjectFolder } from './local-open';
import { handOver } from './picked-store';

/**
 * Choisir un dossier depuis l'accueil, puis **passer la main** à l'écran
 * d'ouverture.
 *
 * C'est tout ce que la carte du menu fait : ouvrir l'explorateur, et dès qu'un
 * dossier est désigné, aller là où l'analyse se lit. Rien ne s'affiche dans la
 * carte — ni détection, ni commande, ni installation : la même information à
 * deux endroits finissait par diverger, et l'accueil se transformait en écran
 * d'ouverture au milieu d'une grille de trois cartes.
 *
 * Le dossier voyage par `picked-store`, pas par l'URL : un chemin absolu n'a
 * rien à faire dans une adresse, et en hébergé il n'existe pas.
 */

export interface PickHandoff {
  /** `null` tant qu'on ne sait pas encore qui peut ouvrir l'explorateur. */
  readonly mode: PickMode | null;
  /** L'explorateur est ouvert ; on attend le dossier. */
  readonly busy: boolean;
  /** La phrase d'une annulation, d'une indisponibilité ou d'un échec. */
  readonly notice: string | null;
  readonly start: () => void;
}

export function usePickHandoff(): PickHandoff {
  const t = useMessages();
  const router = useRouter();
  const [mode, setMode] = useState<PickMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void canOpenNativePickerAction().then((native) => {
      if (alive) {
        setMode(browserPickMode(native));
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const start = useCallback((): void => {
    if (mode === null) {
      return;
    }
    setBusy(true);
    setNotice(null);
    void (async () => {
      const result = await pickProjectFolder(mode);
      setBusy(false);
      if (!result.ok && mode === 'browser' && result.reason === 'failed' && canUseFileInput()) {
        setMode('input');
        setNotice(t.open.fallbackNote);
        return;
      }
      if (!result.ok) {
        setNotice(
          result.reason === 'cancelled'
            ? t.picker.cancelled
            : result.reason === 'unavailable'
              ? t.open.noPickerNote
              : t.picker.failed,
        );
        return;
      }
      handOver(result.target);
      router.push('/open');
    })();
  }, [mode, router, t]);

  return { mode, busy, notice, start };
}

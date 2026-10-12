'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import {
  inspectPickedFolderAction,
  inspectProjectAction,
  installProjectAction,
} from '../actions-node';
import { canOpenNativePickerAction, pickerHomeAction, pickFolderAction } from '../actions-picker';
import type { DialogOutcome } from '../picker/native-dialog';
import { canUseBrowserPicker, pickFolderInBrowser } from './browser-picker';
import { type PickedTarget, targetLabel } from './picked-store';
import type { InstallResultView, ProjectInspectionView } from './project';

/**
 * L'état d'une ouverture de projet local, partagé par les deux écrans qui la
 * proposent : la carte du menu d'accueil (qui ouvre l'explorateur **tout de
 * suite**, puis passe la main à `/open`) et la page `/open` elle-même.
 *
 * Le fil est le même des deux côtés, et c'est le point :
 *   1. appui → l'explorateur **de la machine**, jamais un champ de saisie ;
 *   2. dossier choisi → inspection, avec une barre d'avancement dans la carte,
 *      parce que lire un disque n'est pas instantané ;
 *   3. résultat → nom du projet, gestionnaire, commande d'installation, puis
 *      l'accord explicite avant d'installer.
 *
 * Deux explorateurs, une seule intention. En local (`pf web`), la boîte native
 * s'ouvre côté serveur et rend un chemin absolu : le moteur peut tout faire,
 * installation comprise. En hébergé, le serveur n'est pas sur la machine du
 * visiteur : c'est **son navigateur** qui ouvre l'explorateur (File System
 * Access API) et ne laisse lire que les noms des fichiers — assez pour
 * reconnaître le projet, pas pour l'installer. L'écran le dit à ce
 * moment-là ; il ne propose plus de « saisir un chemin », qui était un
 * cul-de-sac sur une machine qu'on ne voit pas.
 *
 * Une annulation de l'explorateur n'est **pas** une erreur : c'est le
 * `phase: 'cancelled'` avec la phrase calme du dictionnaire, jamais une alerte.
 */

export type LocalOpenPhase =
  | 'idle'
  /** L'explorateur est ouvert ; on attend un dossier. */
  | 'picking'
  /** Le dossier est choisi, l'inspection tourne. */
  | 'inspecting'
  /** Une inspection est disponible (reconnue ou non). */
  | 'ready'
  /** L'utilisateur a fermé la boîte : rien de cassé. */
  | 'cancelled'
  /** Aucun explorateur disponible : ni côté serveur, ni côté navigateur. */
  | 'unavailable'
  /** L'explorateur a échoué pour une autre raison. */
  | 'failed';

/**
 * Qui ouvre l'explorateur.
 *
 * `null` tant que le serveur n'a pas répondu : l'écran n'affiche alors aucun
 * repli, parce qu'il ne sait pas encore s'il y en aura besoin.
 */
export type PickMode = 'native' | 'browser' | 'none';

/** La phase qui suit le retour de la boîte native. */
export function pickOutcomePhase(
  outcome: DialogOutcome,
): 'ready' | 'cancelled' | 'unavailable' | 'failed' {
  if (outcome.ok) {
    return 'ready';
  }
  // « unsupported » est le cas du serveur sans bureau : l'écran le nomme
  // « unavailable » et explique le repli au lieu de parler d'échec.
  return outcome.reason === 'unsupported' ? 'unavailable' : outcome.reason;
}

export type PickResult =
  | { readonly ok: true; readonly target: PickedTarget }
  | { readonly ok: false; readonly reason: 'cancelled' | 'unavailable' | 'failed' };

/**
 * Ouvre le bon explorateur et rend ce qu'il a désigné.
 *
 * C'est la seule fonction qui connaît les deux chemins : la carte du menu et
 * l'écran `/open` l'appellent tous les deux, et aucun des deux ne décide à sa
 * place. `startAt` ne vaut que pour la boîte native — le navigateur choisit
 * lui-même où s'ouvrir.
 */
export async function pickProjectFolder(
  mode: PickMode,
  startAt?: string | undefined,
): Promise<PickResult> {
  if (mode === 'none') {
    return { ok: false, reason: 'unavailable' };
  }
  if (mode === 'browser') {
    const outcome = await pickFolderInBrowser();
    return outcome.ok
      ? { ok: true, target: { kind: 'entries', value: outcome.value } }
      : { ok: false, reason: outcome.reason === 'unsupported' ? 'unavailable' : outcome.reason };
  }
  const outcome = await pickFolderAction(startAt === '' ? undefined : startAt);
  if (outcome.ok) {
    return { ok: true, target: { kind: 'path', path: outcome.path } };
  }
  const phase = pickOutcomePhase(outcome);
  return { ok: false, reason: phase === 'ready' ? 'failed' : phase };
}

export interface LocalOpenController {
  readonly phase: LocalOpenPhase;
  /** Le chemin absolu en local, le nom du dossier en hébergé. Jamais inventé. */
  readonly directory: string;
  readonly inspection: ProjectInspectionView | null;
  readonly installResult: InstallResultView | null;
  readonly ignoreScripts: boolean;
  readonly confirmed: boolean;
  /** L'installation tourne. */
  readonly installing: boolean;
  /** La phrase calme d'une annulation ou d'un échec ; `null` sinon. */
  readonly notice: string | null;
  /** `null` tant qu'on ne sait pas encore qui peut ouvrir l'explorateur. */
  readonly mode: PickMode | null;
  /** Vrai quand BuildIt peut **lancer** l'installation (local seulement). */
  readonly runnable: boolean;
  readonly pick: () => void;
  /** Analyse une cible déjà choisie — celle que la carte du menu a passée. */
  readonly analyse: (target: PickedTarget) => void;
  readonly reanalyse: () => void;
  readonly clear: () => void;
  readonly setIgnoreScripts: (value: boolean) => void;
  readonly setConfirmed: (value: boolean) => void;
  readonly install: () => void;
}

export function useLocalProjectOpen(): LocalOpenController {
  const t = useMessages();
  const [phase, setPhase] = useState<LocalOpenPhase>('idle');
  const [directory, setDirectory] = useState('');
  const [inspection, setInspection] = useState<ProjectInspectionView | null>(null);
  const [installResult, setInstallResult] = useState<InstallResultView | null>(null);
  const [ignoreScripts, setIgnoreScripts] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<PickMode | null>(null);

  // Le dernier dossier choisi sert de point de départ à la boîte suivante, et
  // la dernière cible sert à relancer l'analyse sans rechoisir.
  const startAt = useRef('');
  const target = useRef<PickedTarget | null>(null);

  useEffect(() => {
    let alive = true;
    void canOpenNativePickerAction().then((native) => {
      if (!alive) {
        return;
      }
      setMode(native ? 'native' : canUseBrowserPicker() ? 'browser' : 'none');
      if (!native) {
        return;
      }
      void pickerHomeAction().then((path) => {
        if (alive && startAt.current === '') {
          startAt.current = path;
        }
      });
    });
    return () => {
      alive = false;
    };
  }, []);

  const analyse = useCallback(async (next: PickedTarget): Promise<void> => {
    target.current = next;
    setDirectory(targetLabel(next));
    setInspection(null);
    setInstallResult(null);
    setConfirmed(false);
    setNotice(null);
    setPhase('inspecting');
    const result =
      next.kind === 'path'
        ? await inspectProjectAction(next.path)
        : await inspectPickedFolderAction(next.value);
    setInspection(result);
    setPhase('ready');
  }, []);

  const pick = useCallback((): void => {
    if (mode === null) {
      return;
    }
    setPhase('picking');
    setNotice(null);
    void (async () => {
      const result = await pickProjectFolder(mode, startAt.current);
      if (!result.ok) {
        setPhase(result.reason === 'cancelled' ? 'cancelled' : result.reason);
        setNotice(
          result.reason === 'cancelled'
            ? t.picker.cancelled
            : result.reason === 'unavailable'
              ? t.open.noPickerNote
              : t.picker.failed,
        );
        return;
      }
      if (result.target.kind === 'path') {
        startAt.current = result.target.path;
      }
      await analyse(result.target);
    })();
  }, [analyse, mode, t]);

  const install = useCallback((): void => {
    const current = target.current;
    // L'installation ne vaut que pour un dossier du disque de **cette**
    // machine : en hébergé, il n'y a rien à lancer et le bouton n'existe pas.
    if (current === null || current.kind !== 'path') {
      return;
    }
    setInstalling(true);
    void (async () => {
      const result = await installProjectAction({ directory: current.path, ignoreScripts });
      setInstallResult(result);
      setInstalling(false);
    })();
  }, [ignoreScripts]);

  const clear = useCallback((): void => {
    target.current = null;
    setDirectory('');
    setInspection(null);
    setInstallResult(null);
    setConfirmed(false);
    setNotice(null);
    setPhase('idle');
  }, []);

  const reanalyse = useCallback((): void => {
    const current = target.current;
    if (current !== null) {
      void analyse(current);
    }
  }, [analyse]);

  return {
    phase,
    directory,
    inspection,
    installResult,
    ignoreScripts,
    confirmed,
    installing,
    notice,
    mode,
    runnable: mode === 'native',
    pick,
    analyse: (next: PickedTarget) => void analyse(next),
    reanalyse,
    clear,
    setIgnoreScripts,
    setConfirmed,
    install,
  };
}

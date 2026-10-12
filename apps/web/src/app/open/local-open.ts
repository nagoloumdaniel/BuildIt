'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import { inspectProjectAction, installProjectAction } from '../actions-node';
import { canOpenNativePickerAction, pickerHomeAction, pickFolderAction } from '../actions-picker';
import type { DialogOutcome } from '../picker/native-dialog';
import type { InstallResultView, ProjectInspectionView } from './project';

/**
 * L'état d'une ouverture de projet local, partagé par les deux écrans qui la
 * proposent : la carte du menu d'accueil (qui ouvre l'explorateur **tout de
 * suite**) et la page `/open` (qui laisse choisir le dossier puis relancer
 * l'analyse).
 *
 * Le fil est le même des deux côtés, et c'est le point :
 *   1. appui → `pickFolderAction()` : l'explorateur de la machine, aucun champ
 *      de saisie en local ;
 *   2. dossier choisi → `inspectProjectAction()` : une barre d'avancement dans
 *      la carte, parce que lire un disque n'est pas instantané ;
 *   3. résultat → nom du projet, gestionnaire, commande d'installation, puis
 *      l'accord explicite avant d'installer.
 *
 * Une annulation de l'explorateur n'est **pas** une erreur : c'est le
 * `phase: 'cancelled'` avec la phrase calme du dictionnaire, jamais une alerte.
 */

export type LocalOpenPhase =
  | 'idle'
  /** L'explorateur natif est ouvert ; on attend un dossier. */
  | 'picking'
  /** Le dossier est choisi, l'inspection tourne. */
  | 'inspecting'
  /** Une inspection est disponible (reconnue ou non). */
  | 'ready'
  /** L'utilisateur a fermé la boîte : rien de cassé. */
  | 'cancelled'
  /** Pas de bureau à qui parler (serveur distant, session sans écran). */
  | 'unavailable'
  /** L'explorateur a échoué pour une autre raison. */
  | 'failed';

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

export interface LocalOpenController {
  readonly phase: LocalOpenPhase;
  readonly directory: string;
  readonly inspection: ProjectInspectionView | null;
  readonly installResult: InstallResultView | null;
  readonly ignoreScripts: boolean;
  readonly confirmed: boolean;
  /** L'installation tourne. */
  readonly installing: boolean;
  /** La phrase calme d'une annulation ou d'un échec ; `null` sinon. */
  readonly notice: string | null;
  /** `null` tant que le serveur n'a pas dit si l'explorateur peut s'ouvrir. */
  readonly canPick: boolean | null;
  readonly pick: () => void;
  readonly analyse: (directory: string) => void;
  readonly clear: () => void;
  readonly setIgnoreScripts: (value: boolean) => void;
  readonly setConfirmed: (value: boolean) => void;
  readonly install: () => void;
}

export function useLocalProjectOpen(initialDirectory = ''): LocalOpenController {
  const t = useMessages();
  const [phase, setPhase] = useState<LocalOpenPhase>('idle');
  const [directory, setDirectory] = useState(initialDirectory);
  const [inspection, setInspection] = useState<ProjectInspectionView | null>(null);
  const [installResult, setInstallResult] = useState<InstallResultView | null>(null);
  const [ignoreScripts, setIgnoreScripts] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [canPick, setCanPick] = useState<boolean | null>(null);

  // Le dernier dossier choisi sert de point de départ à la boîte suivante.
  const startAt = useRef(initialDirectory);

  useEffect(() => {
    let alive = true;
    void canOpenNativePickerAction().then((can) => {
      if (alive) {
        setCanPick(can);
      }
    });
    void pickerHomeAction().then((path) => {
      if (alive && startAt.current === '') {
        startAt.current = path;
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const analyse = useCallback(async (target: string): Promise<void> => {
    setDirectory(target);
    setInspection(null);
    setInstallResult(null);
    setConfirmed(false);
    setNotice(null);
    if (target === '') {
      setPhase('idle');
      return;
    }
    setPhase('inspecting');
    const result = await inspectProjectAction(target);
    setInspection(result);
    setPhase('ready');
  }, []);

  const pick = useCallback((): void => {
    setPhase('picking');
    setNotice(null);
    void (async () => {
      const outcome = await pickFolderAction(startAt.current === '' ? undefined : startAt.current);
      const next = pickOutcomePhase(outcome);
      if (next === 'cancelled') {
        setPhase('cancelled');
        setNotice(t.picker.cancelled);
        return;
      }
      if (next === 'unavailable') {
        setPhase('unavailable');
        // Sans cette phrase, la carte grandirait pour ne rien dire : la sonde
        // de capacité a pu répondre « oui » et la boîte échouer quand même
        // (politique Windows, session sans bureau).
        setNotice(t.open.hostedNote);
        return;
      }
      if (next === 'failed' || !outcome.ok) {
        setPhase('failed');
        setNotice(t.picker.failed);
        return;
      }
      startAt.current = outcome.path;
      await analyse(outcome.path);
    })();
  }, [analyse, t]);

  const install = useCallback((): void => {
    if (directory === '') {
      return;
    }
    setInstalling(true);
    void (async () => {
      const result = await installProjectAction({ directory, ignoreScripts });
      setInstallResult(result);
      setInstalling(false);
    })();
  }, [directory, ignoreScripts]);

  const clear = useCallback((): void => {
    setDirectory('');
    setInspection(null);
    setInstallResult(null);
    setConfirmed(false);
    setNotice(null);
    setPhase('idle');
  }, []);

  return {
    phase,
    directory,
    inspection,
    installResult,
    ignoreScripts,
    confirmed,
    installing,
    notice,
    canPick,
    pick,
    analyse: (target: string) => void analyse(target),
    clear,
    setIgnoreScripts,
    setConfirmed,
    install,
  };
}

'use client';

import type { SkeletonFile } from '@buildit/manifest';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import {
  applyBaseFilesAction,
  inspectPickedFolderAction,
  inspectProjectAction,
  installProjectAction,
  planBaseFilesAction,
} from '../actions-node';
import { canOpenNativePickerAction, pickerHomeAction, pickFolderAction } from '../actions-picker';
import type { DialogOutcome } from '../picker/native-dialog';
import {
  baseFilesFor,
  dirsOfPaths,
  dirsToProbe,
  missingBaseFiles,
  type ProjectShape,
  projectShape,
} from './base-files';
import {
  dirExistsInHandle,
  downloadMissing,
  missingInHandle,
  writeMissingToHandle,
} from './base-files-browser';
import {
  type BrowserPickOutcome,
  canUseBrowserPicker,
  canUseFileInput,
  deviceIsMobileWithoutFolder,
  pickFolderInBrowser,
  pickFolderWithInput,
  pickProjectFiles,
} from './browser-picker';
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
export type PickMode = 'native' | 'browser' | 'input' | 'mobile' | 'none';

/** Sur mobile : l'archive du projet, ou quelques fichiers de sa racine. */
export type MobileSource = 'zip' | 'files';

/**
 * Qui ouvre l'explorateur, dans l'ordre : la boîte native (local), la File
 * System Access API (Chromium), puis `<input webkitdirectory>` — que Firefox
 * et Safari comprennent. `none` ne reste que pour un navigateur sans aucun
 * moyen de choisir un dossier (mobile, surtout).
 */
export function choosePickMode(
  native: boolean,
  browser: boolean,
  input: boolean,
  mobile = false,
): PickMode {
  if (native) return 'native';
  // iOS, Android : `webkitdirectory` est là mais n'ouvre pas de dossier.
  if (mobile) return 'mobile';
  if (browser) return 'browser';
  return input ? 'input' : 'none';
}

/** Le mode du navigateur courant, côté hébergé. */
export function browserPickMode(native: boolean): PickMode {
  return choosePickMode(
    native,
    canUseBrowserPicker(),
    canUseFileInput(),
    deviceIsMobileWithoutFolder(),
  );
}

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
  | {
      readonly ok: false;
      readonly reason: 'cancelled' | 'unavailable' | 'failed';
      readonly detail?: 'zip';
    };

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
  source: MobileSource = 'zip',
): Promise<PickResult> {
  if (mode === 'none') {
    return { ok: false, reason: 'unavailable' };
  }
  if (mode === 'browser' || mode === 'input' || mode === 'mobile') {
    const outcome: BrowserPickOutcome =
      mode === 'browser'
        ? await pickFolderInBrowser()
        : mode === 'input'
          ? await pickFolderWithInput()
          : await pickProjectFiles(source);
    if (outcome.ok) {
      return {
        ok: true,
        target: { kind: 'entries', value: outcome.value, access: outcome.access },
      };
    }
    const reason = outcome.reason === 'unsupported' ? 'unavailable' : outcome.reason;
    return outcome.detail === undefined
      ? { ok: false, reason }
      : { ok: false, reason, detail: outcome.detail };
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
  /** Mobile : choisir l'archive `.zip` du projet. */
  readonly pickZip: () => void;
  /** Mobile : choisir quelques fichiers de la racine. */
  readonly pickFiles: () => void;
  /** Analyse une cible déjà choisie — celle que la carte du menu a passée. */
  readonly analyse: (target: PickedTarget) => void;
  readonly reanalyse: () => void;
  readonly clear: () => void;
  readonly setIgnoreScripts: (value: boolean) => void;
  readonly setConfirmed: (value: boolean) => void;
  readonly install: () => void;
  /** Les fichiers de base manquants du dossier choisi ; `null` avant calcul. */
  readonly base: BaseFilesView | null;
  readonly baseBusy: boolean;
  readonly baseResult: BaseFilesResult | null;
  readonly applyBase: () => void;
}

/** Ce que l'écran sait des fichiers de base du dossier. */
export interface BaseFilesView {
  readonly shape: ProjectShape;
  readonly missing: readonly SkeletonFile[];
  /** `disk` : le serveur local écrit ; `handle` : le navigateur écrit ; `zip` : archive. */
  readonly delivery: 'disk' | 'handle' | 'zip';
}

export type BaseFilesResult =
  | { readonly kind: 'written'; readonly count: number }
  | { readonly kind: 'zip'; readonly count: number }
  | { readonly kind: 'failed'; readonly detail: string };

/** Les fichiers de base d'une cible : calcul pur pour le navigateur, action en local. */
export async function baseFilesOf(target: PickedTarget): Promise<BaseFilesView | null> {
  if (target.kind === 'path') {
    const plan = await planBaseFilesAction(target.path);
    return plan.ok ? { ...plan.value, delivery: 'disk' } : null;
  }
  const shape = projectShape({
    folder: target.value.name,
    files: target.value.names,
    dirs: target.value.dirs ?? [],
    packageJson: target.value.packageJson,
    manifest: target.value.manifest,
  });
  if (target.access.kind === 'handle') {
    const handle = target.access.handle;
    const existing = new Set<string>();
    for (const dir of dirsToProbe(shape)) {
      if (await dirExistsInHandle(handle, dir)) existing.add(dir);
    }
    const wanted = baseFilesFor(shape, { existsDir: (dir) => existing.has(dir) });
    return {
      shape,
      missing: await missingInHandle(target.access.handle, wanted),
      delivery: 'handle',
    };
  }
  const present = new Set(target.access.paths);
  const presentDirs = dirsOfPaths(target.access.paths);
  const wanted = baseFilesFor(shape, { existsDir: (dir) => presentDirs.has(dir) });
  return {
    shape,
    missing: missingBaseFiles(wanted, (path) => present.has(path)),
    delivery: 'zip',
  };
}

/**
 * Écrit (ou archive) les fichiers de base manquants d'une cible. Jamais
 * d'écrasement : le serveur écrit en `wx`, la poignée saute ce qui existe.
 */
export async function applyBaseTo(
  current: PickedTarget,
  base: BaseFilesView,
  deniedLabel: string,
): Promise<BaseFilesResult> {
  if (current.kind === 'path') {
    const result = await applyBaseFilesAction(current.path);
    return result.ok
      ? { kind: 'written', count: result.written.length }
      : { kind: 'failed', detail: result.issues.join(' ') };
  }
  if (current.access.kind === 'handle') {
    const result = await writeMissingToHandle(current.access.handle, base.missing);
    return result.ok
      ? { kind: 'written', count: result.written.length }
      : {
          kind: 'failed',
          detail: result.reason === 'denied' ? deniedLabel : (result.detail ?? ''),
        };
  }
  downloadMissing(current.value.name, base.missing);
  return { kind: 'zip', count: base.missing.length };
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
  const [base, setBase] = useState<BaseFilesView | null>(null);
  const [baseBusy, setBaseBusy] = useState(false);
  const [baseResult, setBaseResult] = useState<BaseFilesResult | null>(null);

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
      setMode(browserPickMode(native));
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

  const analyse = useCallback(
    async (next: PickedTarget): Promise<void> => {
      target.current = next;
      setDirectory(targetLabel(next));
      setInspection(null);
      setInstallResult(null);
      setConfirmed(false);
      setNotice(null);
      setBase(null);
      setBaseResult(null);
      setPhase('inspecting');
      // Seuls les noms et deux petits textes partent au serveur — jamais la
      // poignée du dossier, qui ne se sérialise pas.
      const picked =
        next.kind === 'path'
          ? undefined
          : {
              name: next.value.name,
              names: next.value.names,
              ...(next.value.packageJson === undefined
                ? {}
                : { packageJson: next.value.packageJson }),
            };
      let result: ProjectInspectionView;
      try {
        result =
          picked === undefined
            ? await inspectProjectAction(next.kind === 'path' ? next.path : '')
            : await inspectPickedFolderAction(picked);
      } catch {
        // Réseau coupé, déploiement remplacé : dit, jamais une analyse sans fin.
        result = { ok: false, issues: [t.open.inspectFailed] };
      }
      setInspection(result);
      setPhase('ready');
      try {
        setBase(await baseFilesOf(next));
      } catch {
        setBase(null);
      }
    },
    [t],
  );

  const pickFrom = useCallback(
    (source: MobileSource): void => {
      if (mode === null) {
        return;
      }
      setPhase('picking');
      setNotice(null);
      void (async () => {
        const result = await pickProjectFolder(mode, startAt.current, source);
        if (!result.ok && mode === 'browser' && result.reason === 'failed' && canUseFileInput()) {
          // L'API refusée (Brave, politique, dossier protégé) : le prochain
          // appui passe par le sélecteur universel du navigateur.
          setMode('input');
          setPhase('failed');
          setNotice(t.open.fallbackNote);
          return;
        }
        if (!result.ok) {
          setPhase(result.reason === 'cancelled' ? 'cancelled' : result.reason);
          setNotice(
            result.reason === 'cancelled'
              ? t.picker.cancelled
              : result.detail === 'zip'
                ? t.open.zipUnreadable
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
    },
    [analyse, mode, t],
  );
  const pick = useCallback((): void => pickFrom('zip'), [pickFrom]);
  const pickFiles = useCallback((): void => pickFrom('files'), [pickFrom]);

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

  const applyBase = useCallback((): void => {
    const current = target.current;
    if (current === null || base === null || base.missing.length === 0) {
      return;
    }
    setBaseBusy(true);
    setBaseResult(null);
    void (async () => {
      try {
        setBaseResult(await applyBaseTo(current, base, t.open.baseDenied));
        if (current.kind === 'path' || current.access.kind === 'handle') {
          setBase(await baseFilesOf(current));
        }
      } catch (error) {
        setBaseResult({ kind: 'failed', detail: String(error) });
      } finally {
        setBaseBusy(false);
      }
    })();
  }, [base, t]);

  const clear = useCallback((): void => {
    target.current = null;
    setBase(null);
    setBaseResult(null);
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
    pickZip: pick,
    pickFiles,
    analyse: (next: PickedTarget) => void analyse(next),
    reanalyse,
    clear,
    setIgnoreScripts,
    setConfirmed,
    install,
    base,
    baseBusy,
    baseResult,
    applyBase,
  };
}

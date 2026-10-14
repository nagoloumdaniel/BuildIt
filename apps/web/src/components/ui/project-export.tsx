'use client';

import type { Manifest } from '@buildit/manifest';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import {
  checkOutputDestinationAction,
  type GenerationView,
  generateFilesAction,
  generateZipAction,
  openProjectFolderAction,
} from '../../app/actions';
import { installProjectAction } from '../../app/actions-node';
import { canOpenNativePickerAction, pickFolderAction } from '../../app/actions-picker';
import type { OpenFolderRefusal } from '../../app/create/generate/open-folder';
import { targetDirectory } from '../../app/create/generate/steps';
import {
  type GenerateDone,
  type GenerateProgress,
  type GenerateStreamFailure,
  streamGeneration,
} from '../../app/create/generate/stream-client';
import { InstallGuide } from '../../app/create/report/install-guide';
import { installSteps } from '../../app/create/report/install-steps';
import { BaseFilesSection } from '../../app/open/base-files-section';
import type { DirectoryHandle } from '../../app/open/browser-picker';
import { PickCard } from '../../app/open/pick-card';
import { canWriteInBrowser, pickWritableFolder, writeProject } from '../../lib/browser-write';
import { downloadZip } from '../../lib/download-zip';
import { useLocale, useMessages } from '../../lib/i18n/provider';
import { formatBytes } from '../../lib/projects';
import { CommandLine } from './copy';
import { IssueList } from './empty-state';
import { Icon } from './icon';
import { LoadingLine, ProgressBar, Spinner } from './loading';

/**
 * Sortir un projet de BuildIt : en archive ZIP, ou écrit dans un dossier de la
 * machine, dépendances installées ou non.
 *
 * Le composant ne connaît qu'un **manifest** : il sert à l'écran de génération
 * (étape 11) comme à la liste des projets déjà générés, où l'on veut refaire
 * une archive ou écrire le même projet ailleurs. Il ne mémorise rien lui-même :
 * chaque sortie réussie est rendue à l'appelant (`onGenerated`), qui décide de
 * la garder (rapport, liste des projets).
 *
 * Deux sorties, deux gestes distincts, jamais deux boutons jumeaux :
 * - **ZIP** : une Server Action écrit le projet dans un répertoire temporaire
 *   isolé, l'archive, et le navigateur la télécharge. Marche partout.
 * - **Dossier** : local seulement. L'explorateur de la machine donne le
 *   dossier parent (jamais un champ où taper un chemin), le serveur vérifie
 *   `parent/<nom>`, puis la route `/api/generate` écrit et installe en
 *   poussant chaque passage réel.
 *
 * L'avancement tient sur **une** ligne d'état au-dessus d'**une** barre. La
 * barre n'est déterminée que lorsqu'il y a une vraie mesure : ni le moteur ni
 * un gestionnaire de paquets ne publient de pourcentage, elle est donc
 * indéterminée pendant le travail et pleine quand il est fini.
 */

export interface ProjectExportProps {
  readonly manifest: Manifest;
  /** Le nom du projet : celui du dossier écrit et de l'archive téléchargée. */
  readonly projectName: string;
  /** Appelé à chaque sortie réussie, archive comme dossier. */
  readonly onGenerated?: (result: GenerationView) => void;
  /**
   * Ouvre directement les deux sorties, sans le bouton « Générer le projet ».
   * Utile là où le geste de générer a déjà été fait (liste des projets).
   */
  readonly initiallyOpen?: boolean;
  /**
   * Ce que la marche à suivre doit connaître quand le navigateur a écrit le
   * projet sans installer : Docker et les variables d'environnement ajoutent
   * des étapes. Absent, la marche à suivre s'en tient au socle.
   */
  readonly install?: { readonly docker: boolean; readonly envVarNames: readonly string[] };
  /**
   * Créer le dépôt GitHub du projet sous ce nom, après l'écriture en dossier.
   * Absent : aucune connexion GitHub demandée, le processus reste inchangé.
   */
  readonly github?: { readonly name: string };
}

type Stage =
  | { readonly kind: 'closed' }
  | { readonly kind: 'choose'; readonly notice?: string }
  | { readonly kind: 'zipping' }
  | { readonly kind: 'zipped'; readonly zipBase64: string }
  | { readonly kind: 'zipFailed'; readonly issues: readonly string[] }
  /** Hébergé : le navigateur écrit lui-même dans le dossier choisi. */
  | { readonly kind: 'browserWriting'; readonly written: number; readonly total: number }
  | {
      readonly kind: 'browserDone';
      readonly directory: string;
      readonly written: number;
      /** Le dossier du projet écrit, pour y compléter les fichiers de base. */
      readonly handle?: DirectoryHandle;
    }
  | {
      readonly kind: 'browserFailed';
      readonly message: string;
      readonly issues: readonly string[];
      readonly directory?: string;
    }
  | {
      readonly kind: 'destination';
      readonly parent: string;
      readonly directory: string;
      readonly checking: boolean;
      readonly issues: readonly string[];
    }
  | {
      readonly kind: 'running';
      readonly install: boolean;
      readonly progress: GenerateProgress | null;
      readonly writtenDirectory?: string;
    }
  | { readonly kind: 'finished'; readonly result: GenerateDone; readonly retrying: boolean }
  | {
      readonly kind: 'lost';
      readonly failure: GenerateStreamFailure;
      readonly writtenDirectory?: string;
    };

/** Le résultat de la route, sous la forme que le rapport et la liste connaissent. */
export function toGenerationView(done: GenerateDone): GenerationView {
  return {
    ok: done.ok,
    directory: done.directory,
    files: done.files,
    bytes: done.bytes,
    warnings: done.warnings,
    steps: done.steps,
    issues: done.issues,
    ...(done.installRequested ? { installed: done.installed } : {}),
    ...(done.repositoryUrl === undefined ? {} : { repositoryUrl: done.repositoryUrl }),
    ...(done.githubIssues === undefined || done.githubIssues.length === 0
      ? {}
      : { githubIssues: done.githubIssues }),
  };
}

export interface OutputProgressProps {
  /** L'opération en cours, dite en clair : « Écriture des fichiers… ». */
  readonly status: string;
  readonly tone: 'running' | 'ok' | 'error';
  /** De 0 à 100, seulement quand il existe une vraie mesure. */
  readonly value?: number;
  /** Le dossier réellement écrit. Absent tant qu'aucun fichier n'existe. */
  readonly directory?: string;
  /**
   * Comment montrer ce dossier :
   * - `copy` (défaut) : le chemin à copier, pendant le travail ou après un échec ;
   * - `open` : écrit par le serveur local, un bouton l'ouvre dans l'explorateur ;
   * - `text` : écrit par le navigateur, son nom seul (aucun moyen de l'ouvrir).
   */
  readonly directoryMode?: 'copy' | 'open' | 'text';
}

export interface ProjectFolderProps {
  readonly directory: string;
  /** Vrai seulement pour un dossier écrit par le serveur local (inscrit au registre). */
  readonly openable: boolean;
  readonly className?: string;
}

type FolderState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'opening' }
  | { readonly kind: 'refused'; readonly reason: OpenFolderRefusal };

/**
 * Le dossier d'un projet écrit. En local, un bouton l'ouvre dans
 * l'explorateur de la machine : c'est le geste attendu après une génération,
 * plus utile qu'un chemin à copier. Le chemin reste visible à côté, en petite
 * chasse fixe, pour savoir où il est. Écrit par le navigateur, le dossier n'a
 * que son nom : aucune page web ne peut ouvrir l'explorateur.
 */
export function ProjectFolder({
  directory,
  openable,
  className,
}: ProjectFolderProps): ReactElement {
  const o = useMessages().output;
  const [state, setState] = useState<FolderState>({ kind: 'idle' });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  async function open(): Promise<void> {
    setState({ kind: 'opening' });
    let next: FolderState;
    try {
      const outcome = await openProjectFolderAction(directory);
      next = outcome.ok ? { kind: 'idle' } : { kind: 'refused', reason: outcome.reason };
    } catch {
      next = { kind: 'refused', reason: 'failed' };
    }
    if (alive.current) {
      setState(next);
    }
  }

  if (!openable) {
    return (
      <p className={`pf-output-folder${className === undefined ? '' : ` ${className}`}`}>
        <span className="pf-hint">{o.folderWrittenIn}</span>
        <span className="pf-mono pf-output-folder-path">{directory}</span>
      </p>
    );
  }
  const opening = state.kind === 'opening';
  return (
    <div className={className}>
      <div className="pf-output-folder">
        <button
          aria-label={o.openFolderLabel(directory)}
          className="pf-btn"
          disabled={opening}
          onClick={() => void open()}
          type="button"
        >
          {opening ? <Spinner size="sm" /> : <Icon name="folderOpen" />}
          {opening ? o.openingFolder : o.openFolder}
        </button>
        <span className="pf-mono pf-output-folder-path">{directory}</span>
      </div>
      {state.kind === 'refused' ? (
        <p className="pf-hint mt-2" role="alert">
          {o.openFolderRefusals[state.reason]}
        </p>
      ) : null}
    </div>
  );
}

/**
 * L'avancement unique : une ligne d'état, une barre, et sous la barre le seul
 * dossier écrit quand il existe. Pas de liste d'étapes : elle répétait la
 * ligne d'état sans rien dire de plus.
 */
export function OutputProgress({
  status,
  tone,
  value,
  directory,
  directoryMode = 'copy',
}: OutputProgressProps): ReactElement {
  const { t } = useLocale();
  const o = t.output;
  return (
    <div className="pf-output-progress">
      <p
        className="pf-output-status"
        data-tone={tone}
        {...(tone === 'error' ? { role: 'alert' } : { role: 'status', 'aria-live': 'polite' })}
      >
        {tone === 'running' ? (
          <Spinner size="sm" />
        ) : (
          <span aria-hidden="true" className="pf-output-status-icon">
            <Icon name={tone === 'ok' ? 'checkCircle' : 'warning'} size={16} />
          </span>
        )}
        <span className="min-w-0">{status}</span>
      </p>
      {tone === 'error' ? null : (
        <ProgressBar className="mt-2" label={o.progressLabel} value={value} />
      )}
      {directory === undefined || directory === '' ? null : directoryMode !== 'copy' ? (
        <ProjectFolder className="mt-3" directory={directory} openable={directoryMode === 'open'} />
      ) : (
        <div className="mt-3">
          <p className="pf-hint">{o.writtenIn}</p>
          <CommandLine className="mt-1" value={directory} what={o.writtenWhat} />
        </div>
      )}
    </div>
  );
}

export function ProjectExport({
  manifest,
  projectName,
  onGenerated,
  initiallyOpen = false,
  install,
  github,
}: ProjectExportProps): ReactElement {
  const { t, locale } = useLocale();
  const o = t.output;
  const [stage, setStage] = useState<Stage>(
    initiallyOpen ? { kind: 'choose' } : { kind: 'closed' },
  );
  const [picking, setPicking] = useState(false);
  /** `null` tant que le serveur n'a pas dit s'il est sur la machine de l'utilisateur. */
  const [local, setLocal] = useState<boolean | null>(null);
  /** Le navigateur sait-il écrire dans un dossier ? Lu après hydratation. */
  const [browserWrite, setBrowserWrite] = useState(false);
  const following = useRef<AbortController | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setBrowserWrite(canWriteInBrowser());
    void canOpenNativePickerAction()
      .then((can) => {
        if (alive.current) {
          setLocal(can);
        }
      })
      .catch(() => {
        // Le serveur n'a pas répondu : on laisse le geste possible plutôt que
        // d'afficher une explication « hébergé » fausse. S'il échoue, il le
        // dira à l'endroit du geste.
        if (alive.current) {
          setLocal(true);
        }
      });
    return () => {
      alive.current = false;
      // L'écran quitté arrête le suivi, pas l'écriture : la route va au bout.
      following.current?.abort();
    };
  }, []);

  const succeed = useCallback(
    (result: GenerationView) => {
      onGenerated?.(result);
    },
    [onGenerated],
  );

  async function runZip(): Promise<void> {
    setStage({ kind: 'zipping' });
    try {
      const result = await generateZipAction(manifest);
      if (!alive.current) {
        return;
      }
      if (!result.ok || result.zipBase64 === undefined) {
        setStage({ kind: 'zipFailed', issues: result.issues });
        return;
      }
      downloadZip(result.zipBase64, projectName);
      setStage({ kind: 'zipped', zipBase64: result.zipBase64 });
      succeed(result);
    } catch {
      if (alive.current) {
        setStage({ kind: 'zipFailed', issues: [] });
      }
    }
  }

  /**
   * La sortie dossier **en hébergé** : l'explorateur et l'écriture passent par
   * le navigateur (File System Access API), le serveur ne fait que générer.
   * Pas d'installation : aucune page web ne lance de programme sur la machine.
   */
  async function writeFromBrowser(): Promise<void> {
    setPicking(true);
    const picked = await pickWritableFolder();
    if (!alive.current) {
      return;
    }
    setPicking(false);
    if (!picked.ok) {
      setStage({
        kind: 'choose',
        notice: picked.reason === 'cancelled' ? o.pickCancelled : o.pickFailed,
      });
      return;
    }
    setStage({ kind: 'browserWriting', written: 0, total: 0 });
    try {
      const generated = await generateFilesAction(manifest);
      if (!alive.current) {
        return;
      }
      if (!generated.ok) {
        setStage({ kind: 'browserFailed', message: o.fatal, issues: generated.issues });
        return;
      }
      const outcome = await writeProject(
        picked.handle,
        projectName,
        generated.files,
        (written, total) => {
          if (alive.current) {
            setStage({ kind: 'browserWriting', written, total });
          }
        },
      );
      if (!alive.current) {
        return;
      }
      if (!outcome.ok) {
        setStage({
          kind: 'browserFailed',
          message:
            outcome.reason === 'taken'
              ? o.browserTaken
              : outcome.written === 0
                ? o.browserDenied
                : o.browserFailed,
          issues: [],
          ...(outcome.written > 0 ? { directory: outcome.directory } : {}),
        });
        return;
      }
      const project = await picked.handle
        .getDirectoryHandle(projectName)
        .then((handle) => handle as unknown as DirectoryHandle)
        .catch(() => undefined);
      setStage({
        kind: 'browserDone',
        directory: outcome.directory,
        written: outcome.written,
        ...(project === undefined ? {} : { handle: project }),
      });
      succeed({
        ok: true,
        directory: '',
        files: generated.files.map((file) => file.path),
        bytes: generated.bytes,
        warnings: generated.warnings,
        steps: ['plan', 'write'],
        issues: [],
      });
    } catch {
      if (alive.current) {
        setStage({ kind: 'browserFailed', message: o.fatal, issues: [] });
      }
    }
  }

  async function check(parent: string): Promise<void> {
    setStage({
      kind: 'destination',
      parent,
      directory: targetDirectory(parent, projectName),
      checking: true,
      issues: [],
    });
    try {
      const checked = await checkOutputDestinationAction(parent, projectName);
      if (!alive.current) {
        return;
      }
      setStage({
        kind: 'destination',
        parent,
        directory:
          checked.directory === '' ? targetDirectory(parent, projectName) : checked.directory,
        checking: false,
        issues: checked.issues,
      });
    } catch {
      if (alive.current) {
        setStage({
          kind: 'destination',
          parent,
          directory: targetDirectory(parent, projectName),
          checking: false,
          issues: [o.fatal],
        });
      }
    }
  }

  async function pick(): Promise<void> {
    setPicking(true);
    try {
      const outcome = await pickFolderAction();
      if (!alive.current) {
        return;
      }
      if (outcome.ok) {
        await check(outcome.path);
        return;
      }
      if (outcome.reason === 'cancelled') {
        // Fermer l'explorateur ne défait rien : un dossier déjà choisi, un
        // résultat déjà affiché restent à l'écran.
        setStage((previous) =>
          previous.kind === 'choose' ? { kind: 'choose', notice: o.pickCancelled } : previous,
        );
        return;
      }
      setStage({ kind: 'choose', notice: o.pickFailed });
    } catch {
      if (alive.current) {
        setStage({ kind: 'choose', notice: o.pickFailed });
      }
    } finally {
      if (alive.current) {
        setPicking(false);
      }
    }
  }

  async function write(parent: string, install: boolean): Promise<void> {
    following.current?.abort();
    const controller = new AbortController();
    following.current = controller;
    let writtenDirectory: string | undefined;
    setStage({ kind: 'running', install, progress: null });

    const outcome = await streamGeneration(
      { manifest, parent, install, ...(github === undefined ? {} : { github }) },
      {
        signal: controller.signal,
        onProgress: (progress) => {
          if (progress.phase === 'written') {
            writtenDirectory = progress.directory;
          }
          if (alive.current) {
            setStage({
              kind: 'running',
              install,
              progress,
              ...(writtenDirectory === undefined ? {} : { writtenDirectory }),
            });
          }
        },
      },
    );
    if (!alive.current || outcome.kind === 'cancelled') {
      return;
    }
    if (outcome.kind === 'failed') {
      setStage({
        kind: 'lost',
        failure: outcome.failure,
        ...(writtenDirectory === undefined ? {} : { writtenDirectory }),
      });
      return;
    }
    setStage({ kind: 'finished', result: outcome.result, retrying: false });
    // Le projet est sur le disque dès que `ok` est vrai, installation réussie
    // ou non : il a sa place dans le rapport et dans la liste des projets.
    if (outcome.result.ok) {
      succeed(toGenerationView(outcome.result));
    }
  }

  async function retryInstall(result: GenerateDone): Promise<void> {
    setStage({ kind: 'finished', result, retrying: true });
    let next: GenerateDone;
    try {
      const outcome = await installProjectAction({ directory: result.directory });
      next = {
        ...result,
        installed: outcome.ok,
        installIssues: outcome.issues,
        ...(outcome.command === '' ? {} : { installCommand: outcome.command }),
        steps:
          outcome.ok && !result.steps.includes('install')
            ? [...result.steps, 'install']
            : result.steps,
      };
    } catch {
      next = { ...result, installed: false, installIssues: [o.fatal] };
    }
    if (!alive.current) {
      return;
    }
    setStage({ kind: 'finished', result: next, retrying: false });
    if (next.installed) {
      succeed(toGenerationView(next));
    }
  }

  const otherOutput = (
    <button
      className="pf-btn pf-btn-ghost"
      onClick={() => setStage({ kind: 'choose' })}
      type="button"
    >
      <Icon name="arrowLeft" />
      {o.otherOutput}
    </button>
  );
  const changeFolder = (
    <button className="pf-btn" disabled={picking} onClick={() => void pick()} type="button">
      {picking ? <Spinner size="sm" /> : <Icon name="folderOpen" />}
      {o.changeFolder}
    </button>
  );

  if (stage.kind === 'closed') {
    return (
      <div>
        <button
          className="pf-btn pf-btn-primary pf-btn-lg"
          onClick={() => setStage({ kind: 'choose' })}
          type="button"
        >
          <Icon name="hammer" />
          {o.start}
        </button>
        <p className="pf-hint mt-2">{o.startHint}</p>
      </div>
    );
  }

  if (stage.kind === 'choose') {
    return (
      <div>
        <fieldset className="pf-output-fieldset">
          <legend className="pf-label">{o.choicesLabel}</legend>
          <div className="pf-output-choices mt-1">
            <PickCard
              icon="download"
              note={o.zipNote}
              onPick={() => void runZip()}
              title={o.zipTitle}
            />
            <PickCard
              busy={picking}
              busyLabel={o.folderOpening}
              disabled={local === null || (local === false && !browserWrite)}
              icon="folderOpen"
              note={local === false ? o.browserNote : o.folderNote}
              onPick={() => void (local === false ? writeFromBrowser() : pick())}
              title={o.folderTitle}
            />
          </div>
        </fieldset>
        {local === false && !browserWrite ? (
          <div className="pf-callout pf-callout-steel mt-3">
            <p className="pf-output-callout-title">{o.folderHostedTitle}</p>
            <p className="mt-1">{o.folderHostedBody}</p>
            <CommandLine className="mt-2" prompt value="pf web" what={o.folderHostedWhat} />
          </div>
        ) : null}
        {stage.notice === undefined ? null : (
          <p aria-live="polite" className="pf-hint mt-2" role="status">
            {stage.notice}
          </p>
        )}
      </div>
    );
  }

  if (stage.kind === 'browserWriting') {
    return (
      <OutputProgress
        status={
          stage.total === 0 ? o.browserPreparing : o.browserWriting(stage.written, stage.total)
        }
        tone="running"
        {...(stage.total === 0 ? {} : { value: Math.round((stage.written / stage.total) * 100) })}
      />
    );
  }

  if (stage.kind === 'browserDone') {
    return (
      <div>
        <OutputProgress
          directory={stage.directory}
          directoryMode="text"
          status={o.browserDone(stage.written)}
          tone="ok"
          value={100}
        />
        <section className="pf-callout pf-callout-steel mt-3">
          <p className="pf-output-callout-title">{o.installTitle}</p>
          <p className="mt-1">{o.installHint}</p>
          <InstallGuide
            className="mt-2"
            steps={installSteps(
              {
                directory: '',
                folderName: stage.directory,
                docker: install?.docker ?? false,
                envVarNames: install?.envVarNames ?? [],
              },
              t,
            )}
            what={o.installWhat}
          />
        </section>
        {stage.handle === undefined ? null : (
          <BaseFilesSection source={{ kind: 'handle', handle: stage.handle }} />
        )}
      </div>
    );
  }

  if (stage.kind === 'browserFailed') {
    return (
      <div>
        <OutputProgress
          status={stage.message}
          tone="error"
          {...(stage.directory === undefined ? {} : { directory: stage.directory })}
        />
        <IssueList className="mt-2" issues={stage.issues} />
        <button className="pf-btn mt-3" onClick={() => setStage({ kind: 'choose' })} type="button">
          <Icon name="refresh" size={15} />
          {t.common.retry}
        </button>
      </div>
    );
  }

  if (stage.kind === 'zipping') {
    return <OutputProgress status={o.zipping} tone="running" />;
  }

  if (stage.kind === 'zipped') {
    return (
      <div>
        <OutputProgress status={o.zipReady} tone="ok" value={100} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="pf-btn"
            onClick={() => downloadZip(stage.zipBase64, projectName)}
            type="button"
          >
            <Icon name="download" />
            {o.downloadAgain}
          </button>
          {otherOutput}
        </div>
      </div>
    );
  }

  if (stage.kind === 'zipFailed') {
    return (
      <div>
        <OutputProgress status={o.zipFailed} tone="error" />
        <IssueList className="mt-3" issues={stage.issues} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="pf-btn" onClick={() => void runZip()} type="button">
            <Icon name="refresh" />
            {o.retry}
          </button>
          {otherOutput}
        </div>
      </div>
    );
  }

  if (stage.kind === 'destination') {
    const blocked = stage.checking || stage.issues.length > 0;
    return (
      <section className="pf-card pf-card-pad">
        <p className="pf-label">{o.destinationLabel}</p>
        <CommandLine className="mt-1" value={stage.directory} what={o.destinationWhat} />
        {stage.checking ? (
          <LoadingLine className="mt-3" size="sm">
            {o.destinationChecking}
          </LoadingLine>
        ) : null}
        {stage.issues.length === 0 ? (
          <p className="pf-hint mt-3">{o.installNote}</p>
        ) : (
          <div className="mt-3">
            <p className="pf-output-status" data-tone="error" role="alert">
              <span aria-hidden="true" className="pf-output-status-icon">
                <Icon name="warning" size={16} />
              </span>
              <span className="min-w-0">{o.destinationRefused}</span>
            </p>
            <IssueList className="mt-2" issues={stage.issues} />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="pf-btn pf-btn-primary"
            disabled={blocked}
            onClick={() => void write(stage.parent, true)}
            type="button"
          >
            <Icon name="package" />
            {o.generateAndInstall}
          </button>
          <button
            className="pf-btn"
            disabled={blocked}
            onClick={() => void write(stage.parent, false)}
            type="button"
          >
            <Icon name="hammer" />
            {o.generateOnly}
          </button>
          {changeFolder}
          {otherOutput}
        </div>
        <p className="pf-hint mt-3">{o.destinationHint}</p>
      </section>
    );
  }

  if (stage.kind === 'running') {
    const progress = stage.progress;
    const status =
      progress === null || progress.phase === 'writing'
        ? o.writing
        : progress.phase === 'written'
          ? o.written(progress.files, formatBytes(progress.bytes, locale))
          : progress.command === undefined
            ? o.installingUnknown
            : o.installing(progress.command);
    return (
      <OutputProgress
        status={status}
        tone="running"
        {...(stage.writtenDirectory === undefined ? {} : { directory: stage.writtenDirectory })}
      />
    );
  }

  if (stage.kind === 'lost') {
    return (
      <div>
        <OutputProgress
          status={
            stage.failure.reason === 'timeout' ? o.lostTimeout(stage.failure.seconds) : o.lost
          }
          tone="error"
          {...(stage.writtenDirectory === undefined ? {} : { directory: stage.writtenDirectory })}
        />
        <p className="pf-hint mt-2">{o.lostHint}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {changeFolder}
          {otherOutput}
        </div>
      </div>
    );
  }

  // `finished` : refus, succès, ou projet écrit dont l'installation a échoué.
  const result = stage.result;
  if (!result.ok) {
    return (
      <div>
        <OutputProgress status={o.refused} tone="error" />
        <IssueList className="mt-3" issues={result.issues} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {changeFolder}
          {otherOutput}
        </div>
      </div>
    );
  }

  if (stage.retrying) {
    return (
      <OutputProgress directory={result.directory} status={o.retryingInstall} tone="running" />
    );
  }

  if (result.installRequested && !result.installed) {
    return (
      <div>
        <OutputProgress
          directory={result.directory}
          directoryMode="open"
          status={o.installFailed}
          tone="error"
        />
        <IssueList className="mt-3" issues={result.installIssues} />
        <BaseFilesSection source={{ kind: 'path', path: result.directory }} />
        <p className="pf-hint mt-3">{o.installFailedHint}</p>
        {result.installCommand === undefined ? null : (
          <p className="pf-hint mt-1">{o.manualWhere}</p>
        )}
        {result.installCommand === undefined ? null : (
          <CommandLine
            className="mt-2"
            prompt
            value={result.installCommand}
            what={o.manualCommandWhat}
          />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="pf-btn pf-btn-primary"
            onClick={() => void retryInstall(result)}
            type="button"
          >
            <Icon name="refresh" />
            {o.retryInstall}
          </button>
          {otherOutput}
        </div>
      </div>
    );
  }

  return (
    <div>
      <OutputProgress
        directory={result.directory}
        directoryMode="open"
        status={result.installed ? o.doneInstalled : o.done}
        tone="ok"
        value={100}
      />
      <BaseFilesSection source={{ kind: 'path', path: result.directory }} />
      <div className="mt-4 flex flex-wrap items-center gap-2">{otherOutput}</div>
    </div>
  );
}

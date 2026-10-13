'use client';

import { type ReactElement, useEffect, useRef, useState } from 'react';
import { canWriteInBrowser, pickWritableFolder } from '../../lib/browser-write';
import { useMessages } from '../../lib/i18n/provider';
import {
  cloneDestinationModeAction,
  clonePreviewAction,
  githubRepositoriesAction,
} from '../actions-node';
import type { RepositoryView } from '../github/repositories';
import type { DirectoryHandle } from '../open/browser-picker';
import { type CloneStreamFailure, streamClone } from './client';
import type { CloneDestinationMode, ClonePreviewView, CloneResultView } from './clone';
import {
  checkHostedCopy,
  copyToFolder,
  downloadRepositoryZip,
  type HostedFailure,
  type HostedProgress,
  saveBlob,
} from './hosted-client';
import type { HostedPlanView } from './hosted-protocol';
import type { HostedOutcome, HostedStatus } from './hosted-view';
import type { CloneProgress } from './progress';
import { type CloneRunStatus, type CloneTab, CloneView } from './view';

/**
 * Écran 22 — Clone Project (§6.22) : le branchement des Server Actions.
 *
 * Une Server Action rend son résultat d'un seul coup — un clone de 200 Mo y
 * passerait des minutes derrière un rotor. Le clone passe donc par
 * `POST /api/clone`, dont on lit le flux d'avancement (`clone/client.ts`), et
 * l'écran montre la phase réelle de git. La vérification, elle, reste une
 * Server Action : elle ne fait que lire un dossier, et son résultat est
 * immédiat.
 *
 * La destination suit l'environnement, décidé par le **serveur** :
 * - en local, un dossier parent absolu choisi dans l'explorateur de la
 *   machine, et le clone y crée le sous-dossier du dépôt ;
 * - en hébergé, le serveur n'a ni `git` ni le disque de l'utilisateur : le
 *   dépôt GitHub est copié depuis son archive (`/api/clone-archive`), et le
 *   navigateur écrit les fichiers dans un dossier choisi dans l'explorateur
 *   de Windows, ou télécharge le ZIP quand il ne sait pas écrire.
 */
export default function ClonePage(): ReactElement {
  const t = useMessages();
  const [tab, setTab] = useState<CloneTab>('mine');
  const [destinationMode, setDestinationMode] = useState<CloneDestinationMode>('parent');
  const [connected, setConnected] = useState(false);
  const [repositories, setRepositories] = useState<readonly RepositoryView[]>([]);
  const [repositoriesLoading, setRepositoriesLoading] = useState(true);
  const [repositoryIssues, setRepositoryIssues] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const [link, setLink] = useState('');
  const [folder, setFolder] = useState('');
  const [parent, setParent] = useState('');
  const [install, setInstall] = useState(false);
  const [ignoreScripts, setIgnoreScripts] = useState(true);
  const [preview, setPreview] = useState<ClonePreviewView | null>(null);
  const [result, setResult] = useState<CloneResultView | null>(null);
  const [status, setStatus] = useState<CloneRunStatus>('idle');
  const [progress, setProgress] = useState<CloneProgress | null>(null);
  const [failure, setFailure] = useState<CloneStreamFailure | null>(null);
  const abort = useRef<AbortController | null>(null);
  // La copie hébergée : son propre état, parce qu'elle ne raconte pas la même
  // chose qu'un `git clone` (des fichiers écrits, pas des objets reçus).
  const [canWrite, setCanWrite] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<HostedPlanView | null>(null);
  const [hostedStatus, setHostedStatus] = useState<HostedStatus>('idle');
  const [hostedProgress, setHostedProgress] = useState<HostedProgress | null>(null);
  const [hostedOutcome, setHostedOutcome] = useState<HostedOutcome | null>(null);
  const [hostedFailure, setHostedFailure] = useState<HostedFailure | null>(null);
  const [partial, setPartial] = useState<{ written: number; directory: string } | null>(null);

  useEffect(() => {
    let alive = true;
    // Le navigateur ne se connaît qu'une fois monté : au rendu serveur, on ne
    // sait pas encore s'il écrit dans un dossier, et le bouton attend.
    setCanWrite(canWriteInBrowser());
    void cloneDestinationModeAction()
      .then((mode) => {
        if (alive) {
          setDestinationMode(mode);
        }
      })
      .catch(() => undefined);
    void githubRepositoriesAction()
      .then((list) => {
        if (!alive) {
          return;
        }
        setConnected(list.connected);
        setRepositories(list.repositories);
        setRepositoryIssues(list.issues);
      })
      .catch(() => {
        if (alive) {
          setRepositoryIssues([t.errors.offline]);
        }
      })
      .finally(() => {
        // Le chargement se termine toujours : une liste qui n'arrive pas ne
        // doit pas laisser un rotor tourner sans fin.
        if (alive) {
          setRepositoriesLoading(false);
        }
      });
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [t.errors.offline]);

  /** Remet l'écran à zéro sans toucher à ce qui décrit la demande. */
  function resetRun(): void {
    setPreview(null);
    setResult(null);
    setFailure(null);
    setProgress(null);
    setStatus('idle');
    resetHosted();
  }

  /** La copie hébergée revient à zéro : le lien ou le dossier a changé. */
  function resetHosted(): void {
    setPlan(null);
    setHostedStatus('idle');
    setHostedProgress(null);
    setHostedOutcome(null);
    setHostedFailure(null);
    setPartial(null);
  }

  async function checkHosted(): Promise<void> {
    resetHosted();
    setHostedStatus('checking');
    const view = await checkHostedCopy(link, folder);
    if (view === undefined) {
      setHostedStatus('unavailable');
      return;
    }
    setPlan(view);
    // Le nom proposé par le serveur (celui du dépôt) devient visible : c'est
    // lui qui sera créé, l'utilisateur doit le voir avant de choisir.
    if (folder.trim() === '' && view.folder !== '') {
      setFolder(view.folder);
    }
    setHostedStatus('idle');
  }

  function startHosted(): AbortController {
    setHostedOutcome(null);
    setHostedFailure(null);
    setHostedProgress(null);
    setPartial(null);
    const controller = new AbortController();
    abort.current = controller;
    return controller;
  }

  async function copyHosted(): Promise<void> {
    if (plan === null || !plan.ok) {
      return;
    }
    // L'explorateur d'abord, dans le geste même : un navigateur refuse de
    // l'ouvrir après une attente réseau.
    const picked = await pickWritableFolder();
    if (!picked.ok) {
      if (picked.reason === 'unsupported') {
        setCanWrite(false);
      } else if (picked.reason === 'failed') {
        setHostedFailure({ code: 'picker' });
        setHostedStatus('failed');
      }
      return;
    }
    const controller = startHosted();
    setHostedStatus('copying');
    try {
      const outcome = await copyToFolder(
        { link, folder: plan.folder, parent: picked.handle, onProgress: setHostedProgress },
        { signal: controller.signal },
      );
      if (outcome.kind === 'done') {
        const handle = await picked.handle
          .getDirectoryHandle(plan.folder)
          .then((dir) => dir as unknown as DirectoryHandle)
          .catch(() => undefined);
        setHostedOutcome({
          kind: 'folder',
          result: outcome.result,
          ...(handle === undefined ? {} : { handle }),
        });
        setHostedStatus('done');
        return;
      }
      setPartial({ written: outcome.written, directory: outcome.directory });
      if (outcome.kind === 'cancelled') {
        setHostedStatus('cancelled');
        return;
      }
      setHostedFailure(
        outcome.failure.code === 'taken'
          ? { code: 'taken', detail: outcome.directory }
          : outcome.failure,
      );
      setHostedStatus('failed');
    } finally {
      abort.current = null;
    }
  }

  async function downloadHosted(): Promise<void> {
    if (plan === null || !plan.ok) {
      return;
    }
    const controller = startHosted();
    setHostedStatus('zipping');
    try {
      const outcome = await downloadRepositoryZip(
        link,
        plan.folder,
        (received) => setHostedProgress({ phase: 'downloading', received }),
        { signal: controller.signal },
      );
      if (outcome.kind === 'done') {
        saveBlob(outcome.blob, outcome.fileName);
        setHostedOutcome({ kind: 'zip', fileName: outcome.fileName, bytes: outcome.bytes });
        setHostedStatus('done');
        return;
      }
      if (outcome.kind === 'cancelled') {
        setHostedStatus('cancelled');
        return;
      }
      setHostedFailure(outcome.failure);
      setHostedStatus('failed');
    } finally {
      abort.current = null;
    }
  }

  async function check(nextParent?: string): Promise<void> {
    const chosen = nextParent ?? parent;
    setStatus('checking');
    setResult(null);
    setFailure(null);
    try {
      const view = await clonePreviewAction(
        link,
        folder,
        destinationMode === 'parent' ? chosen : undefined,
      );
      setPreview(view);
      setStatus('idle');
    } catch {
      // Une Server Action qui ne répond pas laissait l'écran sur
      // « Vérification… » : on le dit, et rien n'a été cloné.
      setStatus('unavailable');
    }
  }

  async function clone(): Promise<void> {
    setResult(null);
    setFailure(null);
    setProgress(null);
    setStatus('cloning');
    const controller = new AbortController();
    abort.current = controller;

    try {
      const outcome = await streamClone(
        {
          link,
          folder,
          install,
          ignoreScripts,
          ...(destinationMode === 'parent' ? { parent } : {}),
        },
        {
          signal: controller.signal,
          onProgress: setProgress,
        },
      );

      if (outcome.kind === 'done') {
        // La phase finale ne s'invente pas : elle vient du résultat. Un refus
        // du moteur garde la phase atteinte, qui dit où ça s'est arrêté.
        if (outcome.result.ok) {
          setProgress({ phase: 'done', percent: 100 });
        }
        setResult(outcome.result);
        setStatus('done');
        return;
      }
      if (outcome.kind === 'cancelled') {
        setStatus('cancelled');
        return;
      }
      setFailure(outcome.failure);
      setStatus('failed');
    } catch {
      setFailure({ reason: 'network' });
      setStatus('failed');
    } finally {
      abort.current = null;
    }
  }

  return (
    <CloneView
      tab={tab}
      onTab={setTab}
      destinationMode={destinationMode}
      hosted={{
        canWrite,
        plan,
        status: hostedStatus,
        progress: hostedProgress,
        outcome: hostedOutcome,
        failure: hostedFailure,
        partial,
        onCheck: () => void checkHosted(),
        onCopy: () => void copyHosted(),
        onDownload: () => void downloadHosted(),
        onCancel: () => abort.current?.abort(),
      }}
      connected={connected}
      repositories={repositories}
      repositoriesLoading={repositoriesLoading}
      repositoryIssues={repositoryIssues}
      query={query}
      onQuery={setQuery}
      link={link}
      onLink={(value) => {
        setLink(value);
        setPreview(null);
        setResult(null);
        resetHosted();
      }}
      folder={folder}
      onFolder={(value) => {
        setFolder(value);
        setPreview(null);
        setResult(null);
        resetHosted();
      }}
      parent={parent}
      onParent={(value) => {
        setParent(value);
        setPreview(null);
        setResult(null);
        // Choisir, c'est demander : l'explorateur vient de rendre un dossier,
        // et le geste « choisir un autre dossier » doit enchaîner sur la
        // vérification, pas laisser l'utilisateur recliquer sur « Vérifier ».
        if (destinationMode === 'parent' && value.trim() !== '') {
          void check(value);
        }
      }}
      install={install}
      onInstall={setInstall}
      ignoreScripts={ignoreScripts}
      onIgnoreScripts={setIgnoreScripts}
      preview={preview}
      result={result}
      status={status}
      progress={progress}
      failure={failure}
      onPreview={() => void check()}
      onClone={() => void clone()}
      onCancel={() => abort.current?.abort()}
      onPick={(repository) => {
        setLink(repository.cloneUrl);
        setFolder(repository.name);
        resetRun();
        setTab('link');
      }}
    />
  );
}

'use client';

import { type ReactElement, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import { workspaceRootAction } from '../actions';
import {
  cloneDestinationModeAction,
  clonePreviewAction,
  githubRepositoriesAction,
} from '../actions-node';
import type { RepositoryView } from '../github/repositories';
import { type CloneStreamFailure, streamClone } from './client';
import type { CloneDestinationMode, ClonePreviewView, CloneResultView } from './clone';
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
 * - en hébergé, un dossier relatif à la racine de travail, et rien d'autre.
 */
export default function ClonePage(): ReactElement {
  const t = useMessages();
  const [tab, setTab] = useState<CloneTab>('mine');
  const [destinationMode, setDestinationMode] = useState<CloneDestinationMode>('parent');
  const [root, setRoot] = useState('');
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

  useEffect(() => {
    let alive = true;
    void workspaceRootAction()
      .then((value) => {
        if (alive) {
          setRoot(value);
        }
      })
      .catch(() => undefined);
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
      root={root}
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
      }}
      folder={folder}
      onFolder={(value) => {
        setFolder(value);
        setPreview(null);
        setResult(null);
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

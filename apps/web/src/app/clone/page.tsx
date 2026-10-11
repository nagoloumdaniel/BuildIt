'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { workspaceRootAction } from '../actions';
import { clonePreviewAction, cloneProjectAction, githubRepositoriesAction } from '../actions-node';
import type { RepositoryView } from '../github/repositories';
import type { ClonePreviewView, CloneResultView } from './clone';
import { type CloneTab, CloneView } from './view';

/** Écran 22 — Clone Project (§6.22) : le branchement des Server Actions. */
export default function ClonePage(): ReactElement {
  const [tab, setTab] = useState<CloneTab>('mine');
  const [root, setRoot] = useState('');
  const [connected, setConnected] = useState(false);
  const [repositories, setRepositories] = useState<readonly RepositoryView[]>([]);
  const [repositoryIssues, setRepositoryIssues] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const [link, setLink] = useState('');
  const [folder, setFolder] = useState('');
  const [install, setInstall] = useState(false);
  const [ignoreScripts, setIgnoreScripts] = useState(true);
  const [preview, setPreview] = useState<ClonePreviewView | null>(null);
  const [result, setResult] = useState<CloneResultView | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void workspaceRootAction().then((value) => {
      if (alive) {
        setRoot(value);
      }
    });
    void githubRepositoriesAction().then((list) => {
      if (!alive) {
        return;
      }
      setConnected(list.connected);
      setRepositories(list.repositories);
      setRepositoryIssues(list.issues);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function check(): Promise<void> {
    setBusy(true);
    setResult(null);
    setPreview(await clonePreviewAction(link, folder));
    setBusy(false);
  }

  async function clone(): Promise<void> {
    setBusy(true);
    setResult(await cloneProjectAction({ link, folder, install, ignoreScripts }));
    setBusy(false);
  }

  return (
    <CloneView
      tab={tab}
      onTab={setTab}
      root={root}
      connected={connected}
      repositories={repositories}
      repositoryIssues={repositoryIssues}
      query={query}
      onQuery={setQuery}
      link={link}
      onLink={(value) => {
        setLink(value);
        setPreview(null);
      }}
      folder={folder}
      onFolder={(value) => {
        setFolder(value);
        setPreview(null);
      }}
      install={install}
      onInstall={setInstall}
      ignoreScripts={ignoreScripts}
      onIgnoreScripts={setIgnoreScripts}
      preview={preview}
      result={result}
      busy={busy}
      onPreview={() => void check()}
      onClone={() => void clone()}
      onPick={(repository) => {
        setLink(repository.cloneUrl);
        setFolder(repository.name);
        setPreview(null);
        setTab('link');
      }}
    />
  );
}

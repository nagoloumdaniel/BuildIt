'use client';

import { type ReactElement, useState } from 'react';
import { inspectProjectAction, installProjectAction } from '../actions-node';
import type { InstallResultView, ProjectInspectionView } from './project';
import { OpenView } from './view';

/** Écran 23 — Open Local Project (§6.23) : le branchement des Server Actions. */
export default function OpenPage(): ReactElement {
  const [directory, setDirectory] = useState('');
  const [inspection, setInspection] = useState<ProjectInspectionView | null>(null);
  const [installResult, setInstallResult] = useState<InstallResultView | null>(null);
  const [ignoreScripts, setIgnoreScripts] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function inspect(): Promise<void> {
    setBusy(true);
    setInstallResult(null);
    setConfirmed(false);
    setInspection(await inspectProjectAction(directory));
    setBusy(false);
  }

  async function runInstall(): Promise<void> {
    setBusy(true);
    setInstallResult(await installProjectAction({ directory, ignoreScripts }));
    setBusy(false);
  }

  return (
    <OpenView
      directory={directory}
      onDirectory={(value) => {
        setDirectory(value);
        setInspection(null);
        setInstallResult(null);
      }}
      inspection={inspection}
      installResult={installResult}
      ignoreScripts={ignoreScripts}
      onIgnoreScripts={setIgnoreScripts}
      confirmed={confirmed}
      onConfirmed={setConfirmed}
      busy={busy}
      onInspect={() => void inspect()}
      onInstall={() => void runInstall()}
    />
  );
}

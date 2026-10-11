'use client';

import { type ReactElement, useEffect, useState } from 'react';
import {
  githubDisconnectAction,
  githubPermissionsAction,
  githubStartDeviceAction,
  githubStatusAction,
  githubWaitDeviceAction,
} from '../actions-node';
import type { DeviceStartView, PermissionView } from './device';
import type { GithubStatusView } from './session';
import { GithubView } from './view';

/**
 * Écran 21 — GitHub Connection (§6.21, §20bis) : le branchement des Server
 * Actions. La vue, elle, est dans `view.tsx`.
 *
 * Elle est pure pour une raison technique : un `page.tsx` Next ne peut exporter
 * que `default` — le type engendré par Next le vérifie —, donc tout composant
 * testable vit à côté, pas dedans.
 */
export default function GithubPage(): ReactElement {
  const [status, setStatus] = useState<GithubStatusView | null>(null);
  const [permissions, setPermissions] = useState<readonly PermissionView[]>([]);
  const [device, setDevice] = useState<DeviceStartView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    void Promise.all([githubStatusAction(), githubPermissionsAction()]).then(
      ([nextStatus, nextPermissions]) => {
        if (!alive) {
          return;
        }
        setStatus(nextStatus);
        setPermissions(nextPermissions);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  async function connect(): Promise<void> {
    setBusy(true);
    setMessage(undefined);
    const started = await githubStartDeviceAction();
    if (!started.ok) {
      setMessage(started.issues.join(' '));
      setBusy(false);
      return;
    }
    setDevice(started.value);
    const next = await githubWaitDeviceAction(started.value.id);
    setDevice(null);
    setStatus(next);
    setMessage(next.connected ? `Connecté : ${next.login}.` : next.issues.join(' '));
    setBusy(false);
  }

  async function disconnect(): Promise<void> {
    setBusy(true);
    const next = await githubDisconnectAction();
    setStatus(next);
    setMessage('Compte GitHub déconnecté : le jeton a été retiré du trousseau.');
    setBusy(false);
  }

  return (
    <GithubView
      status={status}
      permissions={permissions}
      device={device}
      busy={busy}
      message={message}
      onConnect={() => void connect()}
      onDisconnect={() => void disconnect()}
    />
  );
}

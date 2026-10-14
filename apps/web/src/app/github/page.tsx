'use client';

import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import {
  githubConnectionModeAction,
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
 * Écran 21 GitHub Connection (§6.21, §20bis) : le branchement des Server
 * Actions. La vue, elle, est dans `view.tsx`.
 *
 * Elle est pure pour une raison technique : un `page.tsx` Next ne peut exporter
 * que `default` le type engendré par Next le vérifie —, donc tout composant
 * testable vit à côté, pas dedans.
 */
export default function GithubPage(): ReactElement {
  const t = useMessages();
  const [status, setStatus] = useState<GithubStatusView | null>(null);
  const [permissions, setPermissions] = useState<readonly PermissionView[]>([]);
  const [device, setDevice] = useState<DeviceStartView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<'redirect' | 'device' | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  /**
   * Le numéro de la connexion en cours.
   *
   * `githubWaitDeviceAction` attend la saisie sur github.com : elle peut rendre
   * la main après que l'utilisateur a annulé. Sans ce compteur, la réponse
   * tardive réafficherait un état que l'écran venait de quitter.
   */
  const run = useRef(0);

  /**
   * Le numéro de la lecture d'état. Le bouton « Réessayer » rappelle `load` :
   * une réponse tardive de la lecture précédente ne doit pas écraser l'écran.
   */
  const readId = useRef(0);
  const load = useCallback((): void => {
    const ticket = readId.current + 1;
    readId.current = ticket;
    setLoadFailed(false);
    void Promise.all([
      githubStatusAction(),
      githubPermissionsAction(),
      githubConnectionModeAction(),
    ])
      .then(([nextStatus, nextPermissions, nextMode]) => {
        if (readId.current !== ticket) {
          return;
        }
        setStatus(nextStatus);
        setPermissions(nextPermissions);
        setMode(nextMode);
      })
      .catch(() => {
        // Le serveur ne répond pas : l'écran propose de reprendre, il ne reste
        // pas sur un indicateur qui tourne indéfiniment.
        if (readId.current === ticket) {
          setLoadFailed(true);
        }
      });
  }, []);

  useEffect(() => {
    load();
    return () => {
      // La lecture en vol devient obsolète : elle ne touchera plus l'écran.
      readId.current += 1;
    };
  }, [load]);

  // Le retour du flux de redirection (`github/callback`) arrive ici par
  // l'adresse, pas par un état que ce composant aurait gardé l'écran a été
  // rechargé entre-temps. `connected=1` : le statut ci-dessus le confirmera
  // déjà. `error=...` : il faut le traduire, une seule fois.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error !== null) {
      setMessage(t.account.callbackError(error));
    }
    if (error !== null || params.has('connected')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [t]);

  async function connect(): Promise<void> {
    const ticket = run.current + 1;
    run.current = ticket;
    setBusy(true);
    setMessage(undefined);
    setDevice(null);
    const started = await githubStartDeviceAction();
    if (ticket !== run.current) {
      return;
    }
    if (!started.ok) {
      setMessage(started.issues.join(' '));
      setBusy(false);
      return;
    }
    setDevice(started.value);
    const next = await githubWaitDeviceAction(started.value.id);
    if (ticket !== run.current) {
      return;
    }
    setDevice(null);
    setStatus(next);
    setMessage(next.connected ? t.account.connectedAs(next.login ?? '') : next.issues.join(' '));
    setBusy(false);
  }

  /** Renonce à l'attente : github.com peut encore répondre, l'écran l'ignore. */
  function cancel(): void {
    run.current += 1;
    setDevice(null);
    setBusy(false);
    setMessage(t.account.cancelled);
  }

  async function disconnect(): Promise<void> {
    setBusy(true);
    const next = await githubDisconnectAction();
    setStatus(next);
    setMessage(next.issues.length > 0 ? next.issues.join(' ') : t.account.disconnected);
    setBusy(false);
  }

  return (
    <GithubView
      busy={busy}
      device={device}
      loadFailed={loadFailed}
      message={message}
      mode={mode}
      onCancel={cancel}
      onConnect={() => void connect()}
      onDisconnect={() => void disconnect()}
      onReload={load}
      permissions={permissions}
      status={status}
    />
  );
}

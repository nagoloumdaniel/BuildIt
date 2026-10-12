'use client';

import { Badge, Button, StatusMessage } from '@buildit/ui';
import type { ReactElement } from 'react';
import { ScreenShell } from '../../components/wizard/shell';
import type { DeviceStartView, PermissionView } from './device';
import type { GithubStatusView } from './session';

/**
 * La vue de l'écran 21 — GitHub Connection (§6.21, §20bis).
 *
 * Pure : elle reçoit son état et ses gestes. Un `page.tsx` Next ne peut
 * exporter que `default` (le type engendré le vérifie), donc la vue vit ici et
 * le branchement des Server Actions vit dans `page.tsx`.
 *
 * Rien de sensible ne la traverse : un identifiant de compte, des permissions,
 * et **où** le jeton est rangé — jamais le jeton.
 */

/** Traduction des codes d'erreur que `github/callback` écrit dans `?error=`. */
export const CALLBACK_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  not_configured:
    'La connexion GitHub n’est pas configurée sur ce déploiement : PF_GITHUB_CLIENT_ID, PF_GITHUB_CLIENT_SECRET ou SESSION_SECRET manque.',
  denied: 'Connexion refusée sur github.com : rien n’a été connecté.',
  state:
    'La réponse de GitHub ne correspond à aucune connexion en cours : relancez-la depuis cet écran.',
  exchange: 'GitHub a refusé l’échange du code d’autorisation : relancez la connexion.',
  store: 'Le jeton n’a pas pu être enregistré : relancez la connexion.',
  unknown: 'La connexion a échoué pour une raison inconnue : relancez-la.',
};

export interface GithubViewProps {
  readonly status: GithubStatusView | null;
  readonly permissions: readonly PermissionView[];
  readonly device: DeviceStartView | null;
  readonly busy: boolean;
  readonly message?: string | undefined;
  /** `null` tant que l'écran n'a pas encore demandé le flux à proposer. */
  readonly mode: 'redirect' | 'device' | null;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}

export function GithubView({
  status,
  permissions,
  device,
  busy,
  message,
  mode,
  onConnect,
  onDisconnect,
}: GithubViewProps): ReactElement {
  const connected = status?.connected === true;
  return (
    <ScreenShell
      title="Compte GitHub"
      description={
        mode === 'redirect'
          ? 'La connexion ouvre github.com : choisissez votre compte, acceptez les permissions, vous revenez ici connecté. Aucun mot de passe ne transite par BuildIt.'
          : 'La connexion se fait par un code à saisir sur github.com : aucun mot de passe ne transite par BuildIt, et le jeton reste dans le trousseau de cette machine.'
      }
    >
      {message === undefined || message === '' ? null : (
        <StatusMessage className="mb-3">{message}</StatusMessage>
      )}

      <section className="pf-card pf-card-pad">
        <p className="pf-eyebrow">Connexion</p>
        {status === null ? (
          <p className="pf-hint mt-2">Lecture de l’état de la connexion…</p>
        ) : connected ? (
          <>
            <p className="pf-title mt-2">
              {status.login}
              <Badge tone="ok" className="ml-2">
                Connecté
              </Badge>
            </p>
            <p className="pf-hint mt-1">
              Permissions accordées :{' '}
              {status.scopes.length === 0
                ? 'celles du jeton à grain fin'
                : status.scopes.join(', ')}
              .
            </p>
            <p className="pf-hint">
              Jeton rangé dans : {status.store}. Il ne quitte pas cette machine.
            </p>
            <div className="mt-3">
              <Button disabled={busy} onClick={onDisconnect}>
                Se déconnecter
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="pf-hint mt-2">Aucun compte GitHub connecté.</p>
            {mode === 'redirect' ? (
              <div className="mt-3">
                <a className="pf-btn pf-btn-primary" href="/github/authorize">
                  Se connecter à GitHub
                </a>
                <p className="pf-hint mt-2">
                  Ouvre github.com dans cet onglet : choisissez votre compte, acceptez les
                  permissions, vous revenez ici connecté.
                </p>
              </div>
            ) : device === null ? (
              <div className="mt-3 flex items-center gap-3">
                <Button
                  disabled={busy || mode === null || !status.deviceFlowAvailable}
                  onClick={onConnect}
                  variant="primary"
                >
                  Se connecter à GitHub
                </Button>
                {busy ? <span className="pf-hint">En attente de GitHub…</span> : null}
              </div>
            ) : (
              <div className="mt-3">
                <p className="pf-hint">Ouvrez la page GitHub et saisissez ce code :</p>
                <p className="pf-mono mt-1 text-accent">{device.userCode}</p>
                <p className="pf-hint mt-1">
                  Adresse :{' '}
                  <a href={device.verificationUri} target="_blank" rel="noreferrer">
                    {device.verificationUri}
                  </a>
                </p>
                <p className="pf-hint mt-1">En attente de votre accord sur github.com…</p>
              </div>
            )}
            {status.issues.map((issue) => (
              <p key={issue} className="pf-hint mt-2">
                {issue}
              </p>
            ))}
          </>
        )}
      </section>

      <section className="pf-card pf-card-pad mt-3">
        <p className="pf-eyebrow">Permissions demandées</p>
        <ul className="mt-2">
          {permissions.map((permission) => (
            <li key={permission.scope} className="pf-hint">
              <span className="pf-mono">{permission.scope}</span> — {permission.reason}
            </li>
          ))}
        </ul>
        <p className="pf-hint mt-2">
          Elles ne servent qu’aux actions que vous déclenchez : lister et cloner vos dépôts, créer
          le dépôt d’un projet, gérer ses collaborateurs. Aucune valeur secrète n’est affichée ni
          conservée ailleurs que dans le trousseau.
        </p>
      </section>
    </ScreenShell>
  );
}

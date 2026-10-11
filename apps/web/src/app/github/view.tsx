'use client';

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

export interface GithubViewProps {
  readonly status: GithubStatusView | null;
  readonly permissions: readonly PermissionView[];
  readonly device: DeviceStartView | null;
  readonly busy: boolean;
  readonly message?: string | undefined;
  readonly onConnect: () => void;
  readonly onDisconnect: () => void;
}

export function GithubView({
  status,
  permissions,
  device,
  busy,
  message,
  onConnect,
  onDisconnect,
}: GithubViewProps): ReactElement {
  const connected = status?.connected === true;
  return (
    <ScreenShell
      title="Compte GitHub"
      description="La connexion se fait par un code à saisir sur github.com : aucun mot de passe ne transite par Project Factory, et le jeton reste dans le trousseau de cette machine."
    >
      {message === undefined || message === '' ? null : (
        <p className="pf-hint mb-3" role="status">
          {message}
        </p>
      )}

      <section className="pf-card pf-card-pad">
        <p className="pf-eyebrow">Connexion</p>
        {status === null ? (
          <p className="pf-hint mt-2">Lecture de l’état de la connexion…</p>
        ) : connected ? (
          <>
            <p className="pf-title mt-2">
              {status.login}
              <span className="pf-badge pf-badge-ok ml-2">Connecté</span>
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
              <button type="button" className="pf-btn" disabled={busy} onClick={onDisconnect}>
                Se déconnecter
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pf-hint mt-2">Aucun compte GitHub connecté.</p>
            {device === null ? (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="pf-btn pf-btn-primary"
                  disabled={busy || !status.deviceFlowAvailable}
                  onClick={onConnect}
                >
                  Se connecter à GitHub
                </button>
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

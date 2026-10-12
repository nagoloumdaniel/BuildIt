'use client';

import { Badge, Button, StatusMessage } from '@buildit/ui';
import type { ReactElement } from 'react';
import { Card, CardHead } from '../../components/ui/card';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine, ProgressBar } from '../../components/ui/loading';
import { ScreenShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
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
 * et **où** le jeton est rangé — jamais le jeton. Aucun texte n'est écrit ici :
 * tout passe par `useMessages()`, et les seules valeurs brutes affichées telles
 * quelles sont celles du moteur (les refus) et les identifiants techniques
 * (permissions, code, URL).
 */

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
  /**
   * Sort de l'attente du code : sans lui, un utilisateur qui renonce sur
   * github.com resterait bloqué sur un indicateur qui ne finit jamais.
   */
  readonly onCancel?: (() => void) | undefined;
  /** La lecture initiale a échoué : l'écran propose la reprise, pas un constat. */
  readonly loadFailed?: boolean;
  readonly onReload?: (() => void) | undefined;
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
  onCancel,
  loadFailed = false,
  onReload,
}: GithubViewProps): ReactElement {
  const t = useMessages();
  const connected = status?.connected === true;
  const issues = status?.issues ?? [];
  const deviceFlowAvailable = status?.deviceFlowAvailable === true;
  const grantList =
    status === null || status.scopes.length === 0
      ? t.account.fineGrainedScopes
      : status.scopes.join(', ');

  return (
    <ScreenShell
      title={t.account.title}
      description={
        mode === 'redirect' ? t.account.descriptionRedirect : t.account.descriptionDevice
      }
    >
      {message === undefined || message === '' ? null : (
        <StatusMessage className="mb-3">{message}</StatusMessage>
      )}

      {loadFailed ? (
        <ErrorState
          title={t.account.loadFailedTitle}
          body={t.account.loadFailedBody}
          actions={
            <>
              {onReload === undefined ? null : (
                <Button disabled={busy} onClick={onReload} variant="primary">
                  <Icon name="refresh" />
                  {t.common.retry}
                </Button>
              )}
              <a className="pf-btn" href="/">
                <Icon name="home" />
                {t.common.backHome}
              </a>
            </>
          }
        />
      ) : status === null ? (
        <Card>
          <LoadingLine>{t.account.readingStatus}</LoadingLine>
        </Card>
      ) : connected ? (
        <Card>
          <CardHead
            eyebrow={t.account.connection}
            icon="github"
            title={
              <>
                {status.login}
                <Badge className="ml-2" tone="ok">
                  {t.account.connected}
                </Badge>
              </>
            }
          />
          <p className="pf-hint mt-2">{t.account.grantedScopes(grantList)}</p>
          <p className="pf-hint">{t.account.tokenStore(status.store)}</p>
          <div className="mt-3">
            <Button disabled={busy} onClick={onDisconnect}>
              <Icon name="key" />
              {t.account.disconnect}
            </Button>
          </div>
        </Card>
      ) : issues.length > 0 ? (
        <ErrorState
          title={t.account.connectionIssueTitle}
          body={t.account.connectionIssueBody}
          issues={issues}
          actions={
            <>
              {mode === 'redirect' ? (
                <a className="pf-btn pf-btn-primary" href="/github/authorize">
                  <Icon name="github" />
                  {t.account.connect}
                </a>
              ) : (
                <Button
                  disabled={busy || mode === null || !deviceFlowAvailable}
                  onClick={onConnect}
                  variant="primary"
                >
                  <Icon name="refresh" />
                  {t.account.retryConnection}
                </Button>
              )}
              <a className="pf-btn" href="/">
                <Icon name="home" />
                {t.common.backHome}
              </a>
            </>
          }
        />
      ) : (
        <Card>
          <CardHead
            eyebrow={t.account.connection}
            icon="github"
            title={t.account.notConnectedTitle}
          />
          <p className="pf-hint mt-2">{t.account.notConnected}</p>

          {mode === 'redirect' ? (
            <div className="mt-3">
              <a className="pf-btn pf-btn-primary" href="/github/authorize">
                <Icon name="github" />
                {t.account.connect}
              </a>
              <p className="pf-hint mt-2">{t.account.connectHintRedirect}</p>
            </div>
          ) : device !== null ? (
            <div className="mt-3">
              <p className="pf-eyebrow">{t.account.deviceTitle}</p>
              <p className="pf-hint mt-1">{t.account.deviceInstruction}</p>
              <p className="pf-mono mt-1 text-accent">{device.userCode}</p>
              <p className="pf-hint mt-1">
                {t.account.deviceAddress}{' '}
                <a href={device.verificationUri} rel="noreferrer" target="_blank">
                  {device.verificationUri}
                </a>
              </p>
              <LoadingLine className="mt-2">{t.account.deviceWaiting}</LoadingLine>
              <ProgressBar className="mt-2" />
              {onCancel === undefined ? null : (
                <div className="mt-3">
                  <Button disabled={!busy} onClick={onCancel}>
                    <Icon name="close" />
                    {t.account.cancelWaiting}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={busy || mode === null || !deviceFlowAvailable}
                  onClick={onConnect}
                  variant="primary"
                >
                  <Icon name="github" />
                  {t.account.connect}
                </Button>
                {busy ? <LoadingLine size="sm">{t.account.contactingGithub}</LoadingLine> : null}
              </div>
              {!deviceFlowAvailable ? (
                <StatusMessage className="mt-2" tone="error">
                  {t.account.deviceUnavailable}
                </StatusMessage>
              ) : null}
            </div>
          )}
        </Card>
      )}

      <Card className="mt-3">
        <CardHead
          icon="shield"
          note={t.account.permissionsNote}
          title={t.account.permissionsTitle}
        />
        {permissions.length === 0 ? (
          <p className="pf-hint mt-2">{t.account.permissionsEmpty}</p>
        ) : (
          <ul className="mt-3 list-none space-y-1.5 p-0">
            {permissions.map((permission) => (
              <li className="pf-hint flex items-start gap-2" key={permission.scope}>
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex-none"
                  style={{ color: 'var(--pf-accent)' }}
                >
                  <Icon name="key" size={14} />
                </span>
                <span>
                  <span className="pf-mono">{permission.scope}</span> —{' '}
                  {t.account.permissionReason(permission.scope, permission.reason)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </ScreenShell>
  );
}

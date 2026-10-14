'use client';

import { Badge, Button, Field, StatusMessage } from '@buildit/ui';
import { type ReactElement, useState } from 'react';
import { Card, CardHead } from '../../components/ui/card';
import { IssueList } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine } from '../../components/ui/loading';
import { PathPicker } from '../../components/ui/path-picker';
import { ScreenShell } from '../../components/wizard/shell';
import type { Messages } from '../../lib/i18n/messages';
import { useMessages } from '../../lib/i18n/provider';
import { ShareLinkRow } from '../share/link-row';
import type { AccessView, RepositoryStatusView, RoleView } from './sharing';

/**
 * La vue de l'écran 24 Repository & Sharing (§6.24, §20bis).
 *
 * Règle structurante : **le partage n'existe que via un dépôt GitHub**. Sans
 * dépôt, le bouton « Partager le projet » est grisé et dit pourquoi ; c'est le
 * même refus que celui du serveur, pas une reformulation d'écran.
 *
 * Tous les textes viennent du dictionnaire. Ne restent affichés tels quels que
 * ce qui n'est pas traduisible : le contenu du moteur (les refus), les
 * identifiants GitHub (noms de dépôts, URLs, slugs de rôle) et le contenu du
 * brouillon.
 */

export interface SharePanelProps {
  readonly link: string | null;
  /** Pourquoi le lien ne peut pas être créé `null` quand le brouillon est prêt. */
  readonly blocked: string | null;
  /** Encode le lien ; `false` quand il n'a pas pu l'être. La copie vit dans `ShareLinkRow`. */
  readonly onCreate: () => Promise<boolean> | boolean;
}

export interface RepoViewProps {
  readonly directory: string;
  readonly onDirectory: (value: string) => void;
  readonly status: RepositoryStatusView | null;
  readonly access: AccessView | null;
  readonly roles: readonly RoleView[];
  readonly role: string;
  readonly onRole: (value: string) => void;
  readonly username: string;
  readonly onUsername: (value: string) => void;
  readonly name: string;
  readonly onName: (value: string) => void;
  readonly isPrivate: boolean;
  readonly onIsPrivate: (value: boolean) => void;
  readonly description: string;
  readonly onDescription: (value: string) => void;
  readonly busy: boolean;
  readonly message?: string | undefined;
  /** Ce que fait l'opération en cours un indicateur nomme toujours son travail. */
  readonly pendingLabel?: string | null;
  /** Le lien de configuration en lecture seule (§20), quand l'écran le propose. */
  readonly share?: SharePanelProps | undefined;
  readonly onInspect: () => void;
  readonly onCreate: () => void;
  readonly onInvite: () => void;
  readonly onRemove: (login: string) => void;
  /** Supprime du disque le dossier inspecté, après confirmation dans la vue. */
  readonly onDeleteFromDisk: () => void;
  /** Repart d'un brouillon vierge (le plan du projet est effacé). */
  readonly onResetDraft: () => void;
}

/** Les libellés de rôle du dictionnaire ; un slug inconnu garde celui du serveur. */
function roleText(
  values: Readonly<Record<string, string>>,
  role: string,
  fallback: string,
): string {
  return values[role] ?? fallback;
}

function visibilityLabel(visibility: RepositoryStatusView['visibility'], t: Messages): string {
  switch (visibility) {
    case 'private':
      return t.repo.visibilityPrivate;
    case 'public':
      return t.repo.visibilityPublic;
    default:
      return t.repo.visibilityUnknown;
  }
}

/** Pourquoi « Partager le projet » est grisé `undefined` quand il est actif. */
export function shareBlocker(status: RepositoryStatusView | null, t: Messages): string | undefined {
  if (status === null || !status.ok) {
    return t.repo.blockers.readFirst;
  }
  return status.github ? undefined : t.repo.blockers.shareNoRepo;
}

/** Pourquoi « Créer le dépôt » est grisé. */
export function createBlocker(
  status: RepositoryStatusView | null,
  name: string,
  busy: boolean,
  t: Messages,
): string | undefined {
  if (busy) {
    return t.repo.blockers.busy;
  }
  if (status === null || !status.ok) {
    return t.repo.blockers.readFirst;
  }
  if (status.github) {
    return t.repo.blockers.alreadyRepo;
  }
  return name.trim() === '' ? t.repo.blockers.nameMissing : undefined;
}

/** Pourquoi « Partager le projet » (l'invitation) est grisé. */
export function inviteBlocker(
  status: RepositoryStatusView | null,
  username: string,
  busy: boolean,
  t: Messages,
): string | undefined {
  const share = shareBlocker(status, t);
  if (share !== undefined) {
    return share;
  }
  if (busy) {
    return t.repo.blockers.busy;
  }
  return username.trim() === '' ? t.repo.blockers.usernameMissing : undefined;
}

export function RepoView(props: RepoViewProps): ReactElement {
  const t = useMessages();
  const {
    directory,
    status,
    access,
    roles,
    role,
    username,
    name,
    isPrivate,
    description,
    busy,
    message,
    pendingLabel,
    share,
  } = props;
  const shareBlockerReason = shareBlocker(status, t);
  const create = createBlocker(status, name, busy, t);
  const invite = inviteBlocker(status, username, busy, t);
  const selectedRole = roles.find((item) => item.role === role);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <ScreenShell description={t.repo.description} icon="link" title={t.repo.title}>
      {message === undefined || message === '' ? null : (
        <StatusMessage className="mb-3">{message}</StatusMessage>
      )}
      {pendingLabel === undefined || pendingLabel === null ? null : (
        <LoadingLine className="mb-3">{pendingLabel}</LoadingLine>
      )}

      <Card>
        <PathPicker
          disabled={busy}
          hint={t.repo.directoryHint}
          id="pf-repo-directory"
          kind="folder"
          label={t.repo.directoryLabel}
          onChange={props.onDirectory}
          placeholder={t.repo.directoryPlaceholder}
          value={directory}
        />
        <Button className="mt-3" disabled={busy} onClick={props.onInspect} variant="primary">
          <Icon name="search" />
          {t.repo.inspect}
        </Button>
      </Card>

      {status === null ? null : !status.ok ? (
        <ErrorState
          actions={
            <>
              <Button disabled={busy} onClick={props.onInspect} variant="primary">
                <Icon name="refresh" />
                {t.common.retry}
              </Button>
              <a className="pf-btn" href="/">
                <Icon name="home" />
                {t.common.backHome}
              </a>
            </>
          }
          body={t.repo.readFailedBody}
          className="mt-3"
          issues={status.issues}
          title={t.repo.readFailedTitle}
        />
      ) : (
        <Card className="mt-3">
          <p className="pf-eyebrow flex items-center gap-2">
            <Icon name="gitBranch" size={14} />
            {t.repo.repositoryEyebrow}
          </p>

          {status.github ? (
            <>
              <p className="pf-title-sm mt-1 flex flex-wrap items-center gap-2">
                <a href={status.url} rel="noreferrer" target="_blank">
                  {status.url}
                </a>
                <Badge className="ml-2">{visibilityLabel(status.visibility, t)}</Badge>
              </p>
              <StatusMessage className="mt-1">
                {t.repo.localRepo(status.origin ?? '', visibilityLabel(status.visibility, t))}
              </StatusMessage>
            </>
          ) : (
            <>
              <StatusMessage className="mt-1">
                {status.isRepository ? t.repo.noOrigin : t.repo.notRepository}
              </StatusMessage>

              <Field id="pf-repo-name" label={t.repo.nameLabel} labelClassName="mt-4">
                <input
                  autoComplete="off"
                  className="pf-input pf-mono"
                  id="pf-repo-name"
                  onChange={(event) => props.onName(event.target.value)}
                  placeholder={status.proposedName}
                  spellCheck={false}
                  value={name}
                />
              </Field>

              <fieldset className="mt-4">
                <legend className="pf-label">{t.repo.visibilityLegend}</legend>
                <div className="pf-grid">
                  <button
                    aria-pressed={isPrivate}
                    className="pf-choice"
                    onClick={() => props.onIsPrivate(true)}
                    type="button"
                  >
                    <span className="pf-choice-name">
                      <Icon name="lock" size={14} />
                      {t.repo.privateChoice}
                    </span>
                    <span className="pf-choice-note">{t.repo.privateNote}</span>
                  </button>
                  <button
                    aria-pressed={!isPrivate}
                    className="pf-choice"
                    onClick={() => props.onIsPrivate(false)}
                    type="button"
                  >
                    <span className="pf-choice-name">
                      <Icon name="globe" size={14} />
                      {t.repo.publicChoice}
                    </span>
                    <span className="pf-choice-note">{t.repo.publicNote}</span>
                  </button>
                </div>
              </fieldset>

              <Field id="pf-repo-description" label={t.repo.descriptionLabel} labelClassName="mt-4">
                <input
                  autoComplete="off"
                  className="pf-input"
                  id="pf-repo-description"
                  onChange={(event) => props.onDescription(event.target.value)}
                  value={description}
                />
              </Field>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button disabled={create !== undefined} onClick={props.onCreate} variant="primary">
                  <Icon name="gitBranch" />
                  {t.repo.createRepo}
                </Button>
                {create === undefined ? null : <StatusMessage>{create}</StatusMessage>}
              </div>
            </>
          )}

          {/* Le dossier inspecté peut être effacé du disque. La confirmation
              reste dans la carte : on voit encore le dossier qu'on s'apprête à
              effacer, et le geste ne part jamais d'un seul clic. */}
          <div className="pf-card-progress">
            {confirmingDelete ? (
              <div role="alert">
                <p className="pf-title-sm flex items-center gap-2">
                  <span aria-hidden="true" style={{ color: 'var(--pf-danger)' }}>
                    <Icon name="warning" size={16} />
                  </span>
                  {t.repo.deleteConfirmTitle}
                </p>
                <p className="pf-hint mt-1">{t.repo.deleteConfirmBody}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="pf-btn pf-btn-danger"
                    disabled={busy}
                    onClick={() => {
                      setConfirmingDelete(false);
                      props.onDeleteFromDisk();
                    }}
                    type="button"
                  >
                    <Icon name="trash" size={14} />
                    {t.repo.deleteConfirmAction}
                  </button>
                  <button
                    className="pf-btn pf-btn-ghost"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                    type="button"
                  >
                    <Icon name="close" size={14} />
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="pf-btn pf-btn-danger"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
                type="button"
              >
                <Icon name="trash" size={14} />
                {t.repo.deleteFromDisk}
              </button>
            )}
          </div>
        </Card>
      )}

      <Card className="mt-3">
        <p className="pf-eyebrow flex items-center gap-2">
          <Icon name="users" size={14} />
          {t.repo.shareSection}
        </p>

        {shareBlockerReason === undefined ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button disabled variant="primary">
              <Icon name="users" />
              {t.repo.shareProject}
            </Button>
            <StatusMessage>{shareBlockerReason}</StatusMessage>
          </div>
        )}

        {shareBlockerReason === undefined ? (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span>
                <Field id="pf-repo-username" label={t.repo.usernameLabel}>
                  <input
                    autoComplete="off"
                    className="pf-input"
                    id="pf-repo-username"
                    onChange={(event) => props.onUsername(event.target.value)}
                    placeholder={t.repo.usernamePlaceholder}
                    spellCheck={false}
                    value={username}
                  />
                </Field>
              </span>
              <span>
                <Field id="pf-repo-role" label={t.repo.roleLabel}>
                  <select
                    className="pf-input"
                    disabled={roles.length === 0}
                    id="pf-repo-role"
                    onChange={(event) => props.onRole(event.target.value)}
                    value={role}
                  >
                    {roles.length === 0 ? (
                      <option value={role}>{t.repo.rolesLoading}</option>
                    ) : (
                      roles.map((item) => (
                        <option key={item.role} value={item.role}>
                          {roleText(t.repo.roleNames, item.role, item.label)} ({item.role})
                        </option>
                      ))
                    )}
                  </select>
                </Field>
              </span>
              <Button disabled={invite !== undefined} onClick={props.onInvite} variant="primary">
                <Icon name="users" />
                {t.repo.shareProject}
              </Button>
              {invite === undefined ? null : <StatusMessage>{invite}</StatusMessage>}
            </div>
            {selectedRole === undefined ? null : (
              <StatusMessage className="mt-2">
                {roleText(t.repo.roleNotes, selectedRole.role, selectedRole.note)}
              </StatusMessage>
            )}

            {access === null ? null : (
              <div className="mt-4">
                <p className="pf-label">{t.repo.collaborators}</p>
                {access.collaborators.length === 0 ? (
                  <StatusMessage>{t.repo.noCollaborators}</StatusMessage>
                ) : (
                  <ul className="pf-rows mt-1">
                    {access.collaborators.map((person) => (
                      <li className="pf-row-item flex-wrap" key={person.login}>
                        <span className="pf-mono">{person.login}</span>
                        <Badge>{person.role}</Badge>
                        <Button
                          disabled={busy}
                          onClick={() => props.onRemove(person.login)}
                          variant="ghost"
                        >
                          <Icon name="trash" size={14} />
                          {t.repo.remove}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {access.invitations.length === 0 ? null : (
                  <>
                    <p className="pf-label mt-4">{t.repo.invitations}</p>
                    <ul className="pf-rows mt-1">
                      {access.invitations.map((person) => (
                        <li className="pf-row-item flex-wrap" key={person.login}>
                          <span className="pf-mono">{person.login}</span>
                          <Badge>{person.role}</Badge>
                          <Button
                            disabled={busy}
                            onClick={() => props.onRemove(person.login)}
                            variant="ghost"
                          >
                            <Icon name="close" size={14} />
                            {t.repo.cancelInvite}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <IssueList className="mt-2" issues={access.issues} title={t.repo.issuesTitle} />
              </div>
            )}
          </>
        ) : null}
      </Card>

      {share === undefined ? null : (
        <Card className="mt-3">
          <CardHead icon="link" title={t.repo.shareLinkTitle} />
          {share.blocked === null ? null : (
            <>
              <div id="pf-repo-share-blocked">
                <StatusMessage className="mt-2" tone="error">
                  {share.blocked}
                </StatusMessage>
              </div>
              <div className="mt-2">
                <a className="pf-btn" href="/create/blueprint">
                  <Icon name="arrowRight" />
                  {t.repo.shareLinkResume}
                </a>
              </div>
            </>
          )}
          <ShareLinkRow
            className="mt-3"
            disabled={share.blocked !== null}
            link={share.link}
            onCreate={share.onCreate}
            {...(share.blocked === null ? {} : { describedBy: 'pf-repo-share-blocked' })}
          />

          {/* Le brouillon se reprend depuis zéro : un plan vierge, pas de lien
              déjà encodé à côté. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={props.onResetDraft} variant="ghost">
              <Icon name="trash" size={14} />
              {t.repo.resetDraft}
            </Button>
          </div>
        </Card>
      )}
    </ScreenShell>
  );
}

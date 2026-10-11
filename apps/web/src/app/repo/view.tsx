'use client';

import type { ReactElement } from 'react';
import { ScreenShell } from '../../components/wizard/shell';
import type { AccessView, RepositoryStatusView, RoleView } from './sharing';

/**
 * La vue de l'écran 24 — Repository & Sharing (§6.24, §20bis).
 *
 * Règle structurante : **le partage n'existe que via un dépôt GitHub**. Sans
 * dépôt, le bouton « Partager le projet » est grisé et dit pourquoi ; c'est le
 * même refus que celui du serveur, pas une reformulation d'écran.
 */

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
  readonly onInspect: () => void;
  readonly onCreate: () => void;
  readonly onInvite: () => void;
  readonly onRemove: (login: string) => void;
}

/** Pourquoi « Partager le projet » est grisé — `undefined` quand il est actif. */
export function shareBlocker(status: RepositoryStatusView | null): string | undefined {
  if (status === null || !status.ok) {
    return 'Lisez d’abord l’état du dépôt.';
  }
  return status.github
    ? undefined
    : 'Le partage passe par un dépôt GitHub : créez-le d’abord. Seul le lien de configuration en lecture seule restera possible (Phase 9).';
}

/** Pourquoi « Créer le dépôt » est grisé. */
export function createBlocker(
  status: RepositoryStatusView | null,
  name: string,
  busy: boolean,
): string | undefined {
  if (busy) {
    return 'Une opération est en cours.';
  }
  if (status === null || !status.ok) {
    return 'Lisez d’abord l’état du dépôt.';
  }
  if (status.github) {
    return 'Ce projet a déjà un dépôt GitHub.';
  }
  return name.trim() === '' ? 'Choisissez un nom de dépôt.' : undefined;
}

/** Pourquoi « Partager le projet » (l'invitation) est grisé. */
export function inviteBlocker(
  status: RepositoryStatusView | null,
  username: string,
  busy: boolean,
): string | undefined {
  const share = shareBlocker(status);
  if (share !== undefined) {
    return share;
  }
  if (busy) {
    return 'Une opération est en cours.';
  }
  return username.trim() === '' ? 'Indiquez un nom d’utilisateur GitHub.' : undefined;
}

function visibilityLabel(visibility: RepositoryStatusView['visibility']): string {
  switch (visibility) {
    case 'private':
      return 'privé';
    case 'public':
      return 'public';
    default:
      return 'visibilité inconnue';
  }
}

export function RepoView(props: RepoViewProps): ReactElement {
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
  } = props;
  const share = shareBlocker(status);
  const create = createBlocker(status, name, busy);
  const invite = inviteBlocker(status, username, busy);
  const selectedRole = roles.find((item) => item.role === role);

  return (
    <ScreenShell
      title="Dépôt & partage"
      description="L’état du dépôt GitHub du projet, sa création si besoin, et les accès : les droits sont ceux de GitHub, Project Factory n’a pas de comptes."
    >
      {message === undefined || message === '' ? null : (
        <p className="pf-hint mb-3" role="status">
          {message}
        </p>
      )}

      <section className="pf-card pf-card-pad">
        <label className="pf-label" htmlFor="pf-repo-directory">
          Dossier du projet
        </label>
        <input
          id="pf-repo-directory"
          className="pf-input pf-mono"
          autoComplete="off"
          spellCheck={false}
          placeholder="C:\projets\mon-projet"
          value={directory}
          onChange={(event) => props.onDirectory(event.target.value)}
        />
        <button
          type="button"
          className="pf-btn pf-btn-primary mt-3"
          disabled={busy}
          onClick={props.onInspect}
        >
          Lire l’état du dépôt
        </button>
      </section>

      {status === null ? null : (
        <section className="pf-card pf-card-pad mt-3">
          <p className="pf-eyebrow">Dépôt</p>
          {status.issues.map((issue) => (
            <p key={issue} className="pf-error mt-1">
              {issue}
            </p>
          ))}

          {status.ok && status.github ? (
            <>
              <p className="mt-1">
                <a href={status.url} target="_blank" rel="noreferrer">
                  {status.url}
                </a>
                <span className="pf-badge ml-2">{visibilityLabel(status.visibility)}</span>
              </p>
              <p className="pf-hint mt-1">
                Dépôt local : {status.origin}. Le lien est copiable et le dépôt est{' '}
                {status.visibility === 'private' ? 'privé' : 'accessible'}.
              </p>
            </>
          ) : null}

          {status.ok && !status.github ? (
            <>
              <p className="pf-hint mt-1">
                {status.isRepository
                  ? 'Ce dépôt Git n’a pas d’origine GitHub : le partage passe par GitHub.'
                  : 'Ce projet n’est pas encore un dépôt Git : le premier commit sera créé avant la création du dépôt.'}
              </p>
              <label className="pf-label mt-4" htmlFor="pf-repo-name">
                Nom du dépôt
              </label>
              <input
                id="pf-repo-name"
                className="pf-input pf-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder={status.proposedName}
                value={name}
                onChange={(event) => props.onName(event.target.value)}
              />

              <fieldset className="mt-4">
                <legend className="pf-label">Visibilité</legend>
                <div className="pf-grid">
                  <button
                    type="button"
                    className="pf-choice"
                    aria-pressed={isPrivate}
                    onClick={() => props.onIsPrivate(true)}
                  >
                    <span className="pf-choice-name">Privé</span>
                    <span className="pf-choice-note">
                      Recommandé : seuls les collaborateurs invités y accèdent.
                    </span>
                  </button>
                  <button
                    type="button"
                    className="pf-choice"
                    aria-pressed={!isPrivate}
                    onClick={() => props.onIsPrivate(false)}
                  >
                    <span className="pf-choice-name">Public</span>
                    <span className="pf-choice-note">Visible par tout le monde sur GitHub.</span>
                  </button>
                </div>
              </fieldset>

              <label className="pf-label mt-4" htmlFor="pf-repo-description">
                Description (facultative)
              </label>
              <input
                id="pf-repo-description"
                className="pf-input"
                autoComplete="off"
                value={description}
                onChange={(event) => props.onDescription(event.target.value)}
              />

              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="pf-btn pf-btn-primary"
                  disabled={create !== undefined}
                  onClick={props.onCreate}
                >
                  Créer le dépôt et pousser le code
                </button>
                {create === undefined ? null : (
                  <span className="pf-hint" role="status">
                    {create}
                  </span>
                )}
              </div>
            </>
          ) : null}
        </section>
      )}

      <section className="pf-card pf-card-pad mt-3">
        <p className="pf-eyebrow">Partager le projet</p>
        {share === undefined ? null : (
          <div className="mt-2 flex items-center gap-3">
            <button type="button" className="pf-btn pf-btn-primary" disabled>
              Partager le projet
            </button>
            <span className="pf-hint" role="status">
              {share}
            </span>
          </div>
        )}

        {share === undefined ? (
          <>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <span>
                <label className="pf-label" htmlFor="pf-repo-username">
                  Nom d’utilisateur GitHub
                </label>
                <input
                  id="pf-repo-username"
                  className="pf-input"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="octocat"
                  value={username}
                  onChange={(event) => props.onUsername(event.target.value)}
                />
              </span>
              <span>
                <label className="pf-label" htmlFor="pf-repo-role">
                  Rôle
                </label>
                <select
                  id="pf-repo-role"
                  className="pf-input"
                  value={role}
                  onChange={(event) => props.onRole(event.target.value)}
                >
                  {roles.map((item) => (
                    <option key={item.role} value={item.role}>
                      {item.label} ({item.role})
                    </option>
                  ))}
                </select>
              </span>
              <button
                type="button"
                className="pf-btn pf-btn-primary"
                disabled={invite !== undefined}
                onClick={props.onInvite}
              >
                Partager le projet
              </button>
              {invite === undefined ? null : (
                <span className="pf-hint" role="status">
                  {invite}
                </span>
              )}
            </div>
            {selectedRole === undefined ? null : (
              <p className="pf-hint mt-2">{selectedRole.note}</p>
            )}

            {access === null ? null : (
              <div className="mt-4">
                <p className="pf-label">Collaborateurs</p>
                {access.collaborators.length === 0 ? (
                  <p className="pf-hint">Personne d’autre n’a accès à ce dépôt.</p>
                ) : (
                  <ul className="mt-1">
                    {access.collaborators.map((person) => (
                      <li key={person.login} className="flex items-center gap-3">
                        <span className="pf-mono">{person.login}</span>
                        <span className="pf-badge">{person.role}</span>
                        <button
                          type="button"
                          className="pf-btn pf-btn-ghost"
                          disabled={busy}
                          onClick={() => props.onRemove(person.login)}
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {access.invitations.length === 0 ? null : (
                  <>
                    <p className="pf-label mt-4">Invitations en attente</p>
                    <ul className="mt-1">
                      {access.invitations.map((person) => (
                        <li key={person.login} className="flex items-center gap-3">
                          <span className="pf-mono">{person.login}</span>
                          <span className="pf-badge">{person.role}</span>
                          <button
                            type="button"
                            className="pf-btn pf-btn-ghost"
                            disabled={busy}
                            onClick={() => props.onRemove(person.login)}
                          >
                            Annuler
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {access.issues.map((issue) => (
                  <p key={issue} className="pf-hint mt-2">
                    {issue}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </ScreenShell>
  );
}

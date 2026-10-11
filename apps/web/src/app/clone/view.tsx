'use client';

import type { ReactElement } from 'react';
import { ScreenShell } from '../../components/wizard/shell';
import type { RepositoryView } from '../github/repositories';
import type { ClonePreviewView, CloneResultView } from './clone';

/**
 * La vue de l'écran 22 — Clone Project (§6.22, §18bis).
 *
 * Deux onglets : *Mes dépôts* (le compte connecté) et *Depuis un lien*. Le
 * dossier de destination est relatif à la racine de travail du serveur — un
 * chemin absolu n'est pas accepté — et un clone n'écrase jamais rien : le
 * bloquant est vérifié avant, puis revérifié par `packages/git`.
 */

export type CloneTab = 'mine' | 'link';

export interface CloneViewProps {
  readonly tab: CloneTab;
  readonly onTab: (tab: CloneTab) => void;
  readonly root: string;
  readonly connected: boolean;
  readonly repositories: readonly RepositoryView[];
  readonly repositoryIssues: readonly string[];
  readonly query: string;
  readonly onQuery: (value: string) => void;
  readonly link: string;
  readonly onLink: (value: string) => void;
  readonly folder: string;
  readonly onFolder: (value: string) => void;
  readonly install: boolean;
  readonly onInstall: (value: boolean) => void;
  readonly ignoreScripts: boolean;
  readonly onIgnoreScripts: (value: boolean) => void;
  readonly preview: ClonePreviewView | null;
  readonly result: CloneResultView | null;
  readonly busy: boolean;
  readonly onPreview: () => void;
  readonly onClone: () => void;
  readonly onPick: (repository: RepositoryView) => void;
}

/** Ce qui reste bloquant juste avant de cloner — `undefined` quand on peut y aller. */
export function cloneBlocker(preview: ClonePreviewView | null, busy: boolean): string | undefined {
  if (busy) {
    return 'Une opération est en cours.';
  }
  if (preview === null) {
    return 'Vérifiez d’abord le lien et le dossier de destination.';
  }
  return preview.ok ? undefined : preview.issues.join(' ');
}

/** Le filtre de l'onglet « Mes dépôts » : nom ou description. */
export function matchingRepositories(
  repositories: readonly RepositoryView[],
  query: string,
): RepositoryView[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [...repositories];
  }
  return repositories.filter(
    (repository) =>
      repository.fullName.toLowerCase().includes(needle) ||
      repository.description.toLowerCase().includes(needle),
  );
}

/** L'état de la destination, en une phrase. */
export function destinationLabel(destination: ClonePreviewView['destination']): string {
  switch (destination) {
    case 'free':
      return 'absent — le clone le créera.';
    case 'empty':
      return 'existant et vide.';
    case 'taken':
      return 'existant et non vide : refusé.';
    default:
      return 'inconnu.';
  }
}

export function CloneView(props: CloneViewProps): ReactElement {
  const {
    tab,
    root,
    connected,
    repositories,
    repositoryIssues,
    query,
    link,
    folder,
    install,
    ignoreScripts,
    preview,
    result,
    busy,
  } = props;
  const blocker = cloneBlocker(preview, busy);
  const visible = matchingRepositories(repositories, query);

  return (
    <ScreenShell
      title="Cloner un projet"
      description="Clonez un de vos dépôts GitHub ou n’importe quel lien Git. Le dossier de destination doit être absent ou vide : un clone n’écrase rien."
    >
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Source du dépôt"
      >
        <button
          type="button"
          role="tab"
          className={tab === 'mine' ? 'pf-btn pf-btn-primary' : 'pf-btn'}
          aria-selected={tab === 'mine'}
          onClick={() => props.onTab('mine')}
        >
          Mes dépôts
        </button>
        <button
          type="button"
          role="tab"
          className={tab === 'link' ? 'pf-btn pf-btn-primary' : 'pf-btn'}
          aria-selected={tab === 'link'}
          onClick={() => props.onTab('link')}
        >
          Depuis un lien
        </button>
      </div>

      {tab === 'mine' ? (
        <section className="pf-card pf-card-pad mt-3">
          {connected ? (
            <>
              <label className="pf-label" htmlFor="pf-clone-search">
                Rechercher un dépôt
              </label>
              <input
                id="pf-clone-search"
                className="pf-input"
                autoComplete="off"
                spellCheck={false}
                placeholder="nom ou description"
                value={query}
                onChange={(event) => props.onQuery(event.target.value)}
              />
              {visible.length === 0 ? (
                <p className="pf-hint mt-3">Aucun dépôt ne correspond à « {query} ».</p>
              ) : (
                <div className="pf-grid mt-3">
                  {visible.map((repository) => (
                    <button
                      key={repository.fullName}
                      type="button"
                      className="pf-choice"
                      onClick={() => props.onPick(repository)}
                    >
                      <span className="pf-choice-name">
                        {repository.fullName}
                        <span className="pf-badge ml-2">
                          {repository.private ? 'privé' : 'public'}
                        </span>
                      </span>
                      <span className="pf-choice-note">
                        {repository.description === ''
                          ? 'Choisir ce dépôt'
                          : repository.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="pf-hint">
                Connectez-vous à GitHub pour retrouver vos dépôts. Un dépôt public se clone aussi
                par son lien, sans connexion.
              </p>
              {repositoryIssues.map((issue) => (
                <p key={issue} className="pf-hint mt-2">
                  {issue}
                </p>
              ))}
              <a className="pf-btn pf-btn-primary mt-3" href="/github">
                Connecter un compte GitHub
              </a>
            </>
          )}
        </section>
      ) : (
        <section className="pf-card pf-card-pad mt-3">
          <label className="pf-label" htmlFor="pf-clone-link">
            Lien du dépôt
          </label>
          <input
            id="pf-clone-link"
            className="pf-input pf-mono"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://github.com/propriétaire/dépôt, git@…, propriétaire/dépôt"
            value={link}
            onChange={(event) => props.onLink(event.target.value)}
          />

          <label className="pf-label mt-4" htmlFor="pf-clone-folder">
            Dossier de destination
          </label>
          <input
            id="pf-clone-folder"
            className="pf-input pf-mono"
            autoComplete="off"
            spellCheck={false}
            placeholder="mon-projet"
            value={folder}
            onChange={(event) => props.onFolder(event.target.value)}
          />
          <p className="pf-hint mt-1">
            Relatif à la racine de travail : <span className="pf-mono">{root}</span>. Laissé vide,
            le nom du dépôt est utilisé. Le dossier doit être absent ou vide.
          </p>

          <fieldset className="mt-4">
            <legend className="pf-label">Après le clone</legend>
            <label className="pf-hint flex items-center gap-2" htmlFor="pf-clone-install">
              <input
                id="pf-clone-install"
                type="checkbox"
                checked={install}
                onChange={(event) => props.onInstall(event.target.checked)}
              />
              Installer les dépendances
            </label>
            {install ? (
              <label className="pf-hint mt-2 flex items-center gap-2" htmlFor="pf-clone-ignore">
                <input
                  id="pf-clone-ignore"
                  type="checkbox"
                  checked={ignoreScripts}
                  onChange={(event) => props.onIgnoreScripts(event.target.checked)}
                />
                Installer sans exécuter les scripts du projet (recommandé)
              </label>
            ) : null}
            <p className="pf-hint mt-2">
              Un dépôt cloné n’est pas du code de confiance : ses scripts d’installation s’exécutent
              sur cette machine. La commande exacte est affichée avant d’être lancée.
            </p>
          </fieldset>
        </section>
      )}

      {tab === 'link' ? (
        <section className="mt-3">
          <div className="flex items-center gap-3">
            <button type="button" className="pf-btn" disabled={busy} onClick={props.onPreview}>
              Vérifier le lien et le dossier
            </button>
            <button
              type="button"
              className="pf-btn pf-btn-primary"
              disabled={blocker !== undefined}
              onClick={props.onClone}
            >
              Cloner
            </button>
            {blocker === undefined ? null : (
              <span className="pf-error" role="status">
                {blocker}
              </span>
            )}
          </div>

          {preview === null ? null : (
            <div className="pf-card pf-card-pad mt-3">
              <p className="pf-eyebrow">Destination</p>
              <p className="mt-1">
                <span className="pf-mono">
                  {preview.directory === '' ? '—' : preview.directory}
                </span>
              </p>
              {preview.label === '' ? null : (
                <p className="pf-hint mt-1">
                  Dépôt : <span className="pf-mono">{preview.label}</span> ({preview.protocol}://
                  {preview.host})
                </p>
              )}
              <p className="pf-hint mt-1">Dossier : {destinationLabel(preview.destination)}</p>
              {preview.issues.map((issue) => (
                <p key={issue} className="pf-error mt-2">
                  {issue}
                </p>
              ))}
            </div>
          )}

          {result === null ? null : (
            <div className="pf-card pf-card-pad mt-3">
              <p className="pf-eyebrow">Résultat</p>
              {result.ok ? (
                <p className="mt-1">
                  Dépôt cloné dans <span className="pf-mono">{result.directory}</span>.
                </p>
              ) : (
                result.issues.map((issue) => (
                  <p key={issue} className="pf-error mt-1">
                    {issue}
                  </p>
                ))
              )}
              {result.project === undefined ? null : (
                <p className="pf-hint mt-2">
                  Projet détecté : {result.project.description}.
                  {result.installCommand === undefined
                    ? ''
                    : ` Commande d’installation : ${result.installCommand}.`}
                </p>
              )}
              {result.ok && result.installed ? (
                <p className="pf-hint mt-1">Dépendances installées.</p>
              ) : null}
              {result.warnings.map((warning) => (
                <p key={warning} className="pf-hint mt-1">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </ScreenShell>
  );
}

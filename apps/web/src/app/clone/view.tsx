'use client';

import type { ReactElement } from 'react';
import { CommandLine } from '../../components/ui/copy';
import { IssueList, NoteList } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine, ProgressPanel } from '../../components/ui/loading';
import { PathPicker } from '../../components/ui/path-picker';
import { ScreenShell } from '../../components/wizard/shell';
import type { Messages } from '../../lib/i18n/messages';
import { useMessages } from '../../lib/i18n/provider';
import type { RepositoryView } from '../github/repositories';
import type { CloneStreamFailure } from './client';
import type { CloneDestinationMode, ClonePreviewView, CloneResultView } from './clone';
import { HostedCloneForm, type HostedCloneProps, HostedCloneRun } from './hosted-view';
import type { ClonePhase, CloneProgress } from './progress';

/**
 * La vue de l'écran 22 — Clone Project (§6.22, §18bis).
 *
 * Deux onglets : *Mes dépôts* (le compte connecté) et *Depuis un lien*.
 *
 * La destination n'est plus un dossier « relatif à une racine de travail » que
 * personne ne voyait : en **local**, l'écran fait choisir un dossier parent
 * **absolu** dans l'explorateur de la machine, affiche le chemin complet qui
 * sera écrit, et laisse éditer le seul nom du sous-dossier. En **hébergé**, le
 * serveur n'est pas la machine de l'utilisateur et n'a pas `git` : l'écran
 * passe la main à `hosted-view.tsx`, qui copie les fichiers du dépôt depuis
 * l'archive GitHub vers un dossier choisi dans le navigateur, et dit avant de
 * commencer que ce n'est ni un clone (pas d'historique) ni une installation.
 *
 * L'avancement affiché est celui de git, poussé par `POST /api/clone`. La phase
 * ne recule jamais ; le détail brut est en chasse fixe ; et parce que le suivi
 * peut s'arrêter (annulation, liaison perdue, serveur muet), aucune barre ne
 * tourne sans fin.
 */

export type CloneTab = 'mine' | 'link';

/** Où en est l'écran : c'est ce qui décide du bouton, de la barre et des avis. */
export type CloneRunStatus =
  | 'idle'
  | 'checking'
  | 'cloning'
  | 'done'
  | 'cancelled'
  | 'failed'
  /** Le serveur n'a pas répondu à la vérification — rien n'a été cloné. */
  | 'unavailable';

/** Le dictionnaire de la section clone — passé aux fonctions pures, testables. */
export type CloneMessages = Messages['clone'];

export interface CloneViewProps {
  readonly tab: CloneTab;
  readonly onTab: (tab: CloneTab) => void;
  readonly destinationMode: CloneDestinationMode;
  /**
   * La copie hébergée (`destinationMode === 'root'`). Sans elle, le mode
   * hébergé n'a rien à proposer : c'est la page qui la fournit toujours.
   */
  readonly hosted?: Omit<HostedCloneProps, 'link' | 'folder' | 'onFolder'>;
  readonly connected: boolean;
  readonly repositories: readonly RepositoryView[];
  readonly repositoriesLoading: boolean;
  readonly repositoryIssues: readonly string[];
  readonly query: string;
  readonly onQuery: (value: string) => void;
  readonly link: string;
  readonly onLink: (value: string) => void;
  /** Le nom du sous-dossier (local) ou le dossier relatif (hébergé). */
  readonly folder: string;
  readonly onFolder: (value: string) => void;
  /** Le dossier parent absolu choisi dans l'explorateur — vide en hébergé. */
  readonly parent: string;
  readonly onParent: (value: string) => void;
  readonly install: boolean;
  readonly onInstall: (value: boolean) => void;
  readonly ignoreScripts: boolean;
  readonly onIgnoreScripts: (value: boolean) => void;
  readonly preview: ClonePreviewView | null;
  readonly result: CloneResultView | null;
  readonly status: CloneRunStatus;
  readonly progress: CloneProgress | null;
  readonly failure: CloneStreamFailure | null;
  readonly onPreview: () => void;
  readonly onClone: () => void;
  readonly onCancel: () => void;
  readonly onPick: (repository: RepositoryView) => void;
}

export interface CloneBlockerState {
  readonly busy: boolean;
  readonly destinationMode: CloneDestinationMode;
  readonly parent: string;
}

/** Ce qui reste bloquant juste avant de cloner — `undefined` quand on peut y aller. */
export function cloneBlocker(
  preview: ClonePreviewView | null,
  state: CloneBlockerState,
  t: CloneMessages,
): string | undefined {
  if (state.busy) {
    return t.blockerBusy;
  }
  // En local, le parent est un chemin choisi : sans lui, il n'y a pas de
  // destination à vérifier, et le dire vaut mieux que « vérifiez d'abord ».
  if (state.destinationMode === 'parent' && state.parent.trim() === '') {
    return t.blockerNoParent;
  }
  if (preview === null) {
    return t.blockerNoPreview;
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
export function destinationLabel(
  destination: ClonePreviewView['destination'],
  t: CloneMessages,
): string {
  switch (destination) {
    case 'free':
      return t.folderFree;
    case 'empty':
      return t.folderEmpty;
    case 'taken':
      return t.folderTaken;
    default:
      return t.folderUnknown;
  }
}

/** La phase en clair — celle que l'écran affiche, jamais son identifiant. */
export function phaseLabel(phase: ClonePhase, t: CloneMessages): string {
  switch (phase) {
    case 'starting':
      return t.phaseStarting;
    case 'counting':
      return t.phaseCounting;
    case 'compressing':
      return t.phaseCompressing;
    case 'receiving':
      return t.phaseReceiving;
    case 'resolving':
      return t.phaseResolving;
    case 'checkout':
      return t.phaseCheckout;
    case 'installing':
      return t.phaseInstalling;
    default:
      return t.phaseDone;
  }
}

/**
 * Le chemin complet tel qu'il sera écrit, composé pour l'affichage.
 *
 * Le serveur reste seul juge (c'est `preview.directory` qui fait foi) : ceci
 * n'est qu'une aide avant la vérification, avec le séparateur du parent déjà
 * choisi.
 */
export function composedDirectory(parent: string, folder: string): string {
  const base = parent.trim().replace(/[\\/]+$/, '');
  if (base === '') {
    return '';
  }
  const name = folder.trim();
  if (name === '') {
    return base;
  }
  return `${base}${base.includes('\\') ? '\\' : '/'}${name}`;
}

/** La phrase qui raconte pourquoi le suivi s'est arrêté. */
export function failureMessage(failure: CloneStreamFailure, t: CloneMessages): string {
  switch (failure.reason) {
    case 'timeout':
      return t.streamTimeout(failure.seconds);
    case 'network':
      return t.streamNetwork;
    case 'http':
      return t.streamHttp(failure.status);
    case 'malformed':
      return t.streamMalformed;
    default:
      return t.streamIncomplete;
  }
}

/** Les refus bruts du moteur, affichés tels quels sous le message traduit. */
function Refusals({ issues }: { readonly issues: readonly string[] }): ReactElement | null {
  return <IssueList className="mt-2" issues={issues} />;
}

export function CloneView(props: CloneViewProps): ReactElement {
  const t = useMessages();
  const c = t.clone;
  const { preview, result, status, progress, destinationMode } = props;
  const busy = status === 'checking' || status === 'cloning';
  const cloning = status === 'cloning';
  const blocker = cloneBlocker(preview, { busy, destinationMode, parent: props.parent }, c);
  const visible = matchingRepositories(props.repositories, props.query);
  const linkRefusal = preview !== null && preview.problem === 'link' ? preview : null;
  const parentRefusal = preview !== null && preview.problem === 'parent' ? preview : null;
  // Un parent vide n'est pas « pas accessible » : rien n'a encore été choisi.
  // L'encart de faute ne s'affiche que pour un dossier réellement refusé.
  const unreachableParent =
    parentRefusal !== null && props.parent.trim() !== '' ? parentRefusal : null;
  const shownDirectory =
    preview !== null && preview.directory !== ''
      ? preview.directory
      : composedDirectory(props.parent, props.folder);
  const refusal =
    status === 'failed' && props.failure !== null ? failureMessage(props.failure, c) : null;
  const hostedProps: HostedCloneProps | null =
    destinationMode === 'root' && props.hosted !== undefined
      ? { ...props.hosted, link: props.link, folder: props.folder, onFolder: props.onFolder }
      : null;

  return (
    <ScreenShell title={c.title} description={c.description} icon="gitBranch">
      <div className="pf-tabs" role="tablist" aria-label={c.sourceLabel}>
        <button
          type="button"
          role="tab"
          className="pf-tab"
          aria-selected={props.tab === 'mine'}
          onClick={() => props.onTab('mine')}
        >
          <Icon name="list" size={14} />
          {c.tabMine}
        </button>
        <button
          type="button"
          role="tab"
          className="pf-tab"
          aria-selected={props.tab === 'link'}
          onClick={() => props.onTab('link')}
        >
          <Icon name="link" size={14} />
          {c.tabLink}
        </button>
      </div>

      {props.tab === 'mine' ? (
        <section className="pf-card pf-card-pad mt-3">
          {props.repositoriesLoading ? (
            <LoadingLine className="mb-3">{c.loadingRepositories}</LoadingLine>
          ) : null}
          {props.connected ? (
            <>
              <label className="pf-label" htmlFor="pf-clone-search">
                {c.searchLabel}
              </label>
              <input
                id="pf-clone-search"
                className="pf-input"
                autoComplete="off"
                spellCheck={false}
                placeholder={c.searchPlaceholder}
                value={props.query}
                onChange={(event) => props.onQuery(event.target.value)}
              />
              {visible.length === 0 ? (
                <p className="pf-hint mt-3">{c.noMatch(props.query)}</p>
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
                        <Icon name={repository.private ? 'lock' : 'gitBranch'} size={14} />
                        {repository.fullName}
                        <span className="pf-badge ml-2">
                          {repository.private ? c.private : c.public}
                        </span>
                      </span>
                      <span className="pf-choice-note">
                        {repository.description === '' ? c.pickRepository : repository.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="pf-hint">{c.notConnected}</p>
              <Refusals issues={props.repositoryIssues} />
              <a className="pf-btn pf-btn-primary mt-3" href="/github">
                <Icon name="github" />
                {c.connect}
              </a>
            </>
          )}
        </section>
      ) : (
        <section className="pf-card pf-card-pad mt-3">
          <label className="pf-label" htmlFor="pf-clone-link">
            {c.linkLabel}
          </label>
          <input
            id="pf-clone-link"
            className="pf-input pf-mono"
            autoComplete="off"
            spellCheck={false}
            placeholder={c.linkPlaceholder}
            value={props.link}
            onChange={(event) => props.onLink(event.target.value)}
          />
          {linkRefusal === null ? null : <Refusals issues={linkRefusal.issues} />}

          {destinationMode === 'parent' ? (
            <>
              {unreachableParent === null ? (
                <div className="mt-4">
                  <PathPicker
                    id="pf-clone-parent"
                    label={c.parentLabel}
                    buttonLabel={c.pickParent}
                    hint={c.destinationHint}
                    kind="folder"
                    value={props.parent}
                    onChange={props.onParent}
                  />
                </div>
              ) : null}

              <label className="pf-label mt-4" htmlFor="pf-clone-folder">
                {c.folderNameLabel}
              </label>
              <input
                id="pf-clone-folder"
                className="pf-input pf-mono"
                autoComplete="off"
                spellCheck={false}
                placeholder={c.folderNamePlaceholder}
                value={props.folder}
                onChange={(event) => props.onFolder(event.target.value)}
              />
              <p className="pf-hint mt-1">{c.folderNameHint}</p>

              <p className="pf-label mt-4">{c.fullPath}</p>
              {shownDirectory === '' ? (
                <p className="pf-hint mt-1">{c.fullPathUnknown}</p>
              ) : (
                <CommandLine className="mt-1" value={shownDirectory} what={c.pathWhat} />
              )}
            </>
          ) : null}

          {hostedProps === null ? null : <HostedCloneForm {...hostedProps} />}

          {destinationMode === 'parent' ? (
            <fieldset className="mt-4">
              <legend className="pf-label">{c.afterClone}</legend>
              <label className="pf-hint flex items-center gap-2" htmlFor="pf-clone-install">
                <input
                  id="pf-clone-install"
                  type="checkbox"
                  checked={props.install}
                  onChange={(event) => props.onInstall(event.target.checked)}
                />
                {c.installAfter}
              </label>
              {props.install ? (
                <label className="pf-hint mt-2 flex items-center gap-2" htmlFor="pf-clone-ignore">
                  <input
                    id="pf-clone-ignore"
                    type="checkbox"
                    checked={props.ignoreScripts}
                    onChange={(event) => props.onIgnoreScripts(event.target.checked)}
                  />
                  {c.ignoreScripts}
                </label>
              ) : null}
              <p className="pf-callout mt-2">{c.untrusted}</p>
            </fieldset>
          ) : null}
        </section>
      )}

      {props.tab === 'link' && hostedProps !== null ? <HostedCloneRun {...hostedProps} /> : null}

      {props.tab === 'link' && hostedProps === null ? (
        <section className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="pf-btn"
              disabled={busy || (destinationMode === 'parent' && props.parent.trim() === '')}
              onClick={props.onPreview}
            >
              <Icon name="search" />
              {status === 'checking' ? c.checking : c.check}
            </button>
            <button
              type="button"
              className="pf-btn pf-btn-primary"
              disabled={blocker !== undefined}
              onClick={props.onClone}
            >
              <Icon name="download" />
              {c.clone}
            </button>
            {cloning ? (
              <button type="button" className="pf-btn pf-btn-ghost" onClick={props.onCancel}>
                <Icon name="close" />
                {t.common.cancel}
              </button>
            ) : null}
            {blocker === undefined ? null : (
              <span className="pf-error flex items-center gap-1.5" role="status">
                <Icon name="warning" size={14} />
                {blocker}
              </span>
            )}
          </div>

          {unreachableParent === null ? null : (
            <ErrorState
              className="mt-3"
              illustration="lost"
              title={c.destinationUnavailable}
              body={c.destinationUnavailableBody}
              issues={unreachableParent.issues}
              actions={
                <PathPicker
                  id="pf-clone-parent-retry"
                  label={c.parentLabel}
                  buttonLabel={c.pickOtherFolder}
                  kind="folder"
                  value={props.parent}
                  onChange={props.onParent}
                />
              }
            />
          )}

          {cloning ? (
            <ProgressPanel
              className="mt-3"
              title={c.cloning}
              phase={progress === null ? c.phaseStarting : phaseLabel(progress.phase, c)}
              value={progress?.percent}
              detail={progress?.detail}
            />
          ) : null}

          {!cloning && progress !== null ? (
            <section className="pf-card pf-card-pad mt-3">
              <p className="pf-eyebrow">{c.reachedPhase}</p>
              <p className="pf-title-sm mt-1 flex items-center gap-2">
                <Icon name={progress.phase === 'done' ? 'check' : 'clock'} size={16} />
                {phaseLabel(progress.phase, c)}
                <span className="pf-mono">{progress.percent} %</span>
              </p>
              {progress.detail === undefined ? null : (
                <>
                  <p className="pf-eyebrow mt-3">{c.gitDetail}</p>
                  <CommandLine className="mt-1" value={progress.detail} what={c.gitDetail} />
                </>
              )}
            </section>
          ) : null}

          {status === 'cancelled' ? (
            <section className="pf-card pf-card-pad mt-3" role="status">
              <p className="pf-title-sm flex items-center gap-2">
                <Icon name="warning" size={16} />
                {c.cancelledTitle}
              </p>
              <NoteList className="mt-2" notes={[c.cancelledBody]} />
            </section>
          ) : null}

          {refusal === null ? null : (
            <ErrorState
              className="mt-3"
              title={c.streamFailedTitle}
              body={refusal}
              illustration="lost"
            />
          )}

          {status === 'unavailable' ? (
            <ErrorState
              className="mt-3"
              title={c.checkFailedTitle}
              body={c.checkFailedBody}
              illustration="lost"
            />
          ) : null}

          {preview === null || linkRefusal !== null || parentRefusal !== null ? null : (
            <section className="pf-card pf-card-pad mt-3">
              <p className="pf-eyebrow">{c.destination}</p>
              <p
                className="pf-mono mt-1"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {preview.directory === '' ? '—' : preview.directory}
              </p>
              {preview.label === '' ? null : (
                <p className="pf-hint mt-1">
                  {c.repository} : <span className="pf-mono">{preview.label}</span> (
                  {preview.protocol}://{preview.host})
                </p>
              )}
              <p className="pf-hint mt-1">
                {c.folder} : {destinationLabel(preview.destination, c)}
              </p>
              <Refusals issues={preview.issues} />
            </section>
          )}

          {result === null ? null : (
            <section className="pf-card pf-card-pad mt-3">
              <p className="pf-eyebrow">{c.result}</p>
              {result.ok ? (
                <p className="pf-title-sm mt-1 flex items-center gap-2">
                  <span aria-hidden="true" style={{ color: 'var(--pf-ok)' }}>
                    <Icon name="check" size={16} />
                  </span>
                  {c.cloned(result.directory)}
                </p>
              ) : (
                <>
                  <p className="pf-title-sm mt-1 flex items-center gap-2">
                    <span aria-hidden="true" style={{ color: 'var(--pf-danger)' }}>
                      <Icon name="warning" size={16} />
                    </span>
                    {c.resultFailed}
                  </p>
                  <Refusals issues={result.issues} />
                </>
              )}
              {result.project === undefined ? null : (
                <p className="pf-hint mt-2">
                  {c.detected(result.project.description)}
                  {result.installCommand === undefined
                    ? ''
                    : ` ${c.installCommand(result.installCommand)}`}
                </p>
              )}
              {result.ok && result.installed ? <p className="pf-hint mt-1">{c.installed}</p> : null}
              <NoteList className="mt-2" notes={result.warnings} />
            </section>
          )}
        </section>
      ) : null}
    </ScreenShell>
  );
}

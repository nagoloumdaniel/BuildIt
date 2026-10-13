'use client';

import type { ReactElement } from 'react';
import { CommandSteps } from '../../components/ui/copy';
import { IssueList, NoteList } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { ProgressPanel } from '../../components/ui/loading';
import { CLONE_ARCHIVE_LIMITS } from '../../lib/clone-archive-limits';
import { cloneCommands } from '../../lib/clone-commands';
import type { Messages } from '../../lib/i18n/messages';
import { useMessages } from '../../lib/i18n/provider';
import type { HostedCopyResult, HostedFailure, HostedProgress } from './hosted-client';
import type { HostedPlanView } from './hosted-protocol';

/**
 * La copie d'un dépôt **en mode hébergé** : ce que l'écran 22 montre quand le
 * serveur n'est pas la machine de l'utilisateur.
 *
 * Tout est dit avant le premier geste : on obtient une copie des fichiers,
 * pas un clone (pas de `.git`), et rien n'est installé. La fin donne les
 * commandes à copier, avec l'endroit où les lancer. Un lien hors GitHub ne
 * fait pas semblant : il se clone sur la machine, et la commande est là.
 *
 * Deux sorties, selon le navigateur :
 * - Chrome, Edge : l'explorateur de Windows s'ouvre, et les fichiers sont
 *   écrits dans le dossier choisi, avec un compte réel (fichiers écrits /
 *   total) ;
 * - Firefox, Safari : pas d'écriture dans un dossier, l'archive ZIP est
 *   téléchargée à la place, avec les octets reçus pour seule mesure.
 */

export type CloneMessages = Messages['clone'];

export type HostedStatus =
  | 'idle'
  | 'checking'
  | 'copying'
  | 'zipping'
  | 'done'
  | 'cancelled'
  | 'failed'
  /** La vérification n'a pas eu de réponse du serveur. */
  | 'unavailable';

export type HostedOutcome =
  | { readonly kind: 'folder'; readonly result: HostedCopyResult }
  | { readonly kind: 'zip'; readonly fileName: string; readonly bytes: number };

export interface HostedCloneProps {
  /** `null` tant que le navigateur n'a pas été interrogé (rendu serveur). */
  readonly canWrite: boolean | null;
  readonly link: string;
  readonly folder: string;
  readonly onFolder: (value: string) => void;
  readonly plan: HostedPlanView | null;
  readonly status: HostedStatus;
  readonly progress: HostedProgress | null;
  readonly outcome: HostedOutcome | null;
  readonly failure: HostedFailure | null;
  /** Ce qui reste sur le disque après un arrêt : jamais caché. */
  readonly partial: { readonly written: number; readonly directory: string } | null;
  readonly onCheck: () => void;
  readonly onCopy: () => void;
  readonly onDownload: () => void;
  readonly onCancel: () => void;
}

const MB = 1024 * 1024;

/** Une taille lisible : en Ko sous le mégaoctet, en Mo au-delà. */
export function formatSize(bytes: number, t: CloneMessages): string {
  return bytes < MB
    ? t.sizeKilobytes(Math.max(1, Math.round(bytes / 1024)))
    : t.sizeMegabytes(Math.round((bytes / MB) * 10) / 10);
}

function megabytes(limit: number | undefined, fallback: number): number {
  return Math.round((limit ?? fallback) / MB);
}

/** La phrase qui raconte pourquoi la copie s'est arrêtée. */
export function hostedFailureMessage(failure: HostedFailure, t: CloneMessages): string {
  const detail = 'detail' in failure && failure.detail !== undefined ? failure.detail : '';
  const limit = 'limit' in failure ? failure.limit : undefined;
  switch (failure.code) {
    case 'link':
      return t.hostedErrorLink;
    case 'folder':
      return t.hostedErrorFolder;
    case 'notGithub':
      return t.hostedErrorNotGithub;
    case 'notFound':
      return t.hostedErrorNotFound;
    case 'unauthorized':
      return t.hostedErrorUnauthorized;
    case 'rateLimited':
      return t.hostedErrorRateLimited;
    case 'archiveTooLarge':
      return t.hostedErrorArchiveTooLarge(megabytes(limit, CLONE_ARCHIVE_LIMITS.maxArchiveBytes));
    case 'tooManyFiles':
      return t.hostedErrorTooManyFiles(limit ?? CLONE_ARCHIVE_LIMITS.maxFiles);
    case 'tooLarge':
      return t.hostedErrorTooLarge(megabytes(limit, CLONE_ARCHIVE_LIMITS.maxTotalBytes));
    case 'fileTooLarge':
      return t.hostedErrorFileTooLarge(megabytes(limit, CLONE_ARCHIVE_LIMITS.maxFileBytes), detail);
    case 'unsafePath':
      return t.hostedErrorUnsafePath(detail);
    case 'unsupported':
      return t.hostedErrorUnsupported;
    case 'corrupt':
      return t.hostedErrorCorrupt(detail);
    case 'http':
      return t.hostedErrorHttp('status' in failure ? (failure.status ?? 0) : 0);
    case 'taken':
      return t.hostedErrorTaken(detail);
    case 'write':
      return t.hostedErrorWrite(detail);
    case 'malformed':
      return t.hostedErrorMalformed;
    case 'incomplete':
      return t.hostedErrorIncomplete;
    case 'timeout':
      return t.hostedErrorTimeout(failure.seconds);
    case 'picker':
      return t.hostedErrorPicker;
    default:
      return t.hostedErrorNetwork;
  }
}

/** Ce qui empêche de lancer la copie, dit à côté du bouton grisé. */
export function hostedBlocker(
  plan: HostedPlanView | null,
  busy: boolean,
  t: CloneMessages,
): string | undefined {
  if (busy) {
    return t.blockerBusy;
  }
  if (plan === null) {
    return t.hostedBlockerCheck;
  }
  if (plan.ok) {
    return undefined;
  }
  return plan.error === undefined ? t.hostedErrorLink : hostedFailureMessage(plan.error, t);
}

/** L'avancement en clair : la phase, la mesure, et un pourcentage seulement s'il est réel. */
export function hostedProgressView(
  progress: HostedProgress | null,
  t: CloneMessages,
): { readonly phase: string; readonly value?: number; readonly detail?: string } {
  if (progress === null) {
    return { phase: t.hostedDownloading };
  }
  if (progress.phase === 'downloading') {
    return {
      phase: t.hostedDownloading,
      detail: t.hostedReceived(formatSize(progress.received, t)),
    };
  }
  return {
    phase: t.hostedWriting,
    ...(progress.total === 0 ? {} : { value: (progress.written / progress.total) * 100 }),
    detail: t.hostedWritten(progress.written, progress.total),
  };
}

/** Le haut du formulaire : ce que la copie est, et le nom du dossier à créer. */
export function HostedCloneForm(props: HostedCloneProps): ReactElement {
  const c = useMessages().clone;
  return (
    <>
      <section
        className="pf-callout pf-callout-steel pf-clone-hosted mt-4"
        aria-label={c.hostedTitle}
      >
        <p className="pf-title-sm flex items-center gap-2">
          <Icon name="info" size={16} />
          {c.hostedTitle}
        </p>
        <p className="mt-2">{c.hostedIntro}</p>
        <ul className="pf-clone-notes mt-2">
          <li>{c.hostedNoHistory}</li>
          <li>{c.hostedNoInstall}</li>
          <li>
            {c.hostedLimits(
              CLONE_ARCHIVE_LIMITS.maxFiles,
              Math.round(CLONE_ARCHIVE_LIMITS.maxTotalBytes / MB),
            )}
          </li>
        </ul>
      </section>

      <label className="pf-label mt-4" htmlFor="pf-clone-folder">
        {c.hostedFolderLabel}
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
      <p className="pf-hint mt-1">{c.hostedFolderHint}</p>
    </>
  );
}

/** Les commandes de la fin : installer ici, ou refaire un vrai clone. */
function NextSteps({
  url,
  folder,
  installCommand,
  showInstall,
}: {
  readonly url: string;
  readonly folder: string;
  readonly installCommand?: string;
  /**
   * Vrai pour une copie dans un dossier : le projet y a été reconnu. Faux pour
   * l'archive, que le serveur relaie sans l'ouvrir : on ne sait pas quoi
   * installer, et on ne le devine pas.
   */
  readonly showInstall: boolean;
}): ReactElement {
  const c = useMessages().clone;
  const commands = cloneCommands(url, folder, installCommand);
  const cloneSteps = [
    { label: c.hostedCloneStep, command: commands.clone },
    { label: c.hostedCdStep, command: commands.cd },
    ...(commands.install === undefined
      ? []
      : [{ label: c.hostedInstallAfterClone, command: commands.install }]),
  ];
  return (
    <>
      {showInstall ? (
        <section className="pf-card pf-card-pad mt-3">
          <p className="pf-eyebrow">{c.hostedNextTitle}</p>
          {commands.install === undefined ? (
            <p className="pf-hint mt-2">{c.hostedNothingToInstall}</p>
          ) : (
            <CommandSteps
              className="mt-2"
              what={c.hostedCommandsWhat}
              steps={[{ label: c.hostedInstallStep(folder), command: commands.install }]}
            />
          )}
        </section>
      ) : null}
      <section className="pf-card pf-card-pad mt-3">
        <p className="pf-eyebrow">{c.hostedRealCloneTitle}</p>
        <CommandSteps className="mt-2" what={c.hostedCommandsWhat} steps={cloneSteps} />
      </section>
    </>
  );
}

/** Les gestes, l'avancement et le résultat de la copie. */
export function HostedCloneRun(props: HostedCloneProps): ReactElement {
  const t = useMessages();
  const c = t.clone;
  const { plan, status, outcome, failure, partial } = props;
  const busy = status === 'checking' || status === 'copying' || status === 'zipping';
  const running = status === 'copying' || status === 'zipping';
  const blocker = hostedBlocker(plan, busy, c);
  const notGithub = plan !== null && plan.error?.code === 'notGithub';
  const refused = plan !== null && !plan.ok && !notGithub ? plan : null;
  const shown = hostedProgressView(props.progress, c);
  const folder = plan?.folder !== undefined && plan.folder !== '' ? plan.folder : props.folder;

  return (
    <section className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="pf-btn" disabled={busy} onClick={props.onCheck}>
          <Icon name="search" />
          {status === 'checking' ? c.checking : c.hostedCheck}
        </button>
        {props.canWrite === false ? (
          <button
            type="button"
            className="pf-btn pf-btn-primary"
            disabled={blocker !== undefined}
            onClick={props.onDownload}
          >
            <Icon name="download" />
            {c.hostedDownload}
          </button>
        ) : (
          <button
            type="button"
            className="pf-btn pf-btn-primary"
            disabled={blocker !== undefined || props.canWrite === null}
            onClick={props.onCopy}
          >
            <Icon name="folderOpen" />
            {c.hostedCopy}
          </button>
        )}
        {running ? (
          <button type="button" className="pf-btn pf-btn-ghost" onClick={props.onCancel}>
            <Icon name="close" />
            {t.common.cancel}
          </button>
        ) : null}
        {blocker === undefined || notGithub ? null : (
          <span className="pf-error flex items-center gap-1.5" role="status">
            <Icon name="warning" size={14} />
            {blocker}
          </span>
        )}
      </div>

      {props.canWrite === false ? <p className="pf-callout mt-3">{c.hostedNoFolderApi}</p> : null}

      {plan?.ok ? (
        <p className="pf-hint mt-3 flex items-center gap-2">
          <Icon name="github" size={14} />
          {c.hostedReady(plan.label)}
        </p>
      ) : null}

      {refused === null ? null : <IssueList className="mt-2" issues={refused.issues} />}

      {notGithub ? (
        <section className="pf-card pf-card-pad mt-3" role="status">
          <p className="pf-title-sm flex items-center gap-2">
            <Icon name="terminal" size={16} />
            {c.hostedNotGithubTitle}
          </p>
          <p className="pf-hint mt-2">{c.hostedNotGithubBody}</p>
          <CommandSteps
            className="mt-2"
            what={c.hostedCommandsWhat}
            steps={[
              { label: c.hostedCloneStep, command: cloneCommands(plan.url, folder).clone },
              { label: c.hostedCdStep, command: cloneCommands(plan.url, folder).cd },
            ]}
          />
        </section>
      ) : null}

      {running ? (
        <ProgressPanel
          className="mt-3"
          title={status === 'zipping' ? c.hostedZipping : c.hostedCopying}
          phase={shown.phase}
          value={shown.value}
          detail={shown.detail}
        />
      ) : null}

      {status === 'unavailable' ? (
        <ErrorState
          className="mt-3"
          title={c.checkFailedTitle}
          body={c.checkFailedBody}
          illustration="lost"
        />
      ) : null}

      {(status === 'failed' || status === 'cancelled') &&
      (failure !== null || status === 'cancelled') ? (
        <ErrorState
          className="mt-3"
          illustration="lost"
          title={status === 'cancelled' ? c.hostedCancelledTitle : c.hostedFailedTitle}
          body={failure === null ? undefined : hostedFailureMessage(failure, c)}
          issues={[
            partial !== null && partial.written > 0
              ? c.hostedPartial(partial.written, partial.directory)
              : c.hostedNothingWritten,
          ]}
        />
      ) : null}

      {status === 'done' && outcome !== null && plan !== null ? (
        <>
          <section className="pf-card pf-card-pad mt-3">
            <p className="pf-eyebrow">{c.result}</p>
            <p className="pf-title-sm mt-1 flex items-center gap-2">
              <span aria-hidden="true" style={{ color: 'var(--pf-ok)' }}>
                <Icon name="check" size={16} />
              </span>
              {outcome.kind === 'folder'
                ? c.hostedCopied(outcome.result.directory)
                : c.hostedZipSaved(outcome.fileName, formatSize(outcome.bytes, c))}
            </p>
            {outcome.kind === 'folder' ? (
              <>
                <p className="pf-hint mt-1">
                  {c.hostedCopiedCount(outcome.result.written, formatSize(outcome.result.bytes, c))}
                </p>
                {outcome.result.project === undefined ? null : (
                  <p className="pf-hint mt-1">{c.detected(outcome.result.project.description)}</p>
                )}
                <NoteList
                  className="mt-2"
                  notes={[
                    ...(outcome.result.skipped.length === 0
                      ? []
                      : [c.hostedSkipped(outcome.result.skipped.length)]),
                    ...(outcome.result.symlinks.length === 0
                      ? []
                      : [c.hostedSymlinks(outcome.result.symlinks.length)]),
                  ]}
                />
                {outcome.result.skipped.length === 0 ? null : (
                  <ul
                    className="pf-clone-skipped pf-mono pf-hint mt-2"
                    // Une zone qui défile doit se joindre au clavier.
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: liste défilante, atteinte au clavier
                    tabIndex={0}
                    aria-label={c.hostedSkipped(outcome.result.skipped.length)}
                  >
                    {outcome.result.skipped.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="pf-hint mt-1">{c.hostedZipNext}</p>
            )}
          </section>
          <NextSteps
            url={plan.url}
            folder={folder}
            showInstall={outcome.kind === 'folder'}
            {...(outcome.kind === 'folder' && outcome.result.installCommand !== undefined
              ? { installCommand: outcome.result.installCommand }
              : {})}
          />
        </>
      ) : null}
    </section>
  );
}

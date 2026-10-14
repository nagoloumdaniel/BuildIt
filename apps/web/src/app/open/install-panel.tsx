'use client';

import { type ReactElement, useId } from 'react';
import { CommandLine } from '../../components/ui/copy';
import { NoteList } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { ProgressPanel } from '../../components/ui/loading';
import type { Messages } from '../../lib/i18n/messages';
import { useMessages } from '../../lib/i18n/provider';
import type { InstallResultView, ProjectSummaryView } from './project';

/**
 * Le panneau d'un projet local reconnu : ce qu'on a trouvé, la commande
 * **exacte** qui sera lancée, l'accord à donner, et le résultat.
 *
 * Il vit hors de `view.tsx` parce que deux écrans le montrent : la page
 * `/open` et la carte « Ouvrir un projet local » du menu d'accueil. Un projet
 * local se lit de la même façon des deux côtés dupliquer le panneau aurait
 * fait diverger la formule de la commande d'installation, c'est-à-dire
 * exactement ce qu'on ne veut pas.
 *
 * La logique décisionnelle est sortie en fonctions pures
 * (`plannedCommand`, `installBlocker`) : elles se testent sans DOM, et le
 * composant ne fait que les rendre.
 */

/** Pourquoi l'installation ne peut pas partir. `undefined` : tout est réuni. */
export type InstallBlocker = 'busy' | 'noInspection' | 'manual' | 'unconfirmed';

/**
 * La commande qui **sera** lancée, telle qu'annoncée.
 *
 * Elle suit le choix « sans scripts » : ce que l'écran montre est ce que le
 * moteur exécutera, sans approximation.
 */
export function plannedCommand(
  summary: ProjectSummaryView | null,
  ignoreScripts: boolean,
): string | undefined {
  if (summary === null) {
    return undefined;
  }
  return ignoreScripts ? (summary.safeCommand ?? summary.plainCommand) : summary.plainCommand;
}

/** Ce qui manque pour lancer : la première raison, dans l'ordre où on la lit. */
export function installBlocker(
  summary: ProjectSummaryView | null,
  confirmed: boolean,
  busy: boolean,
): InstallBlocker | undefined {
  if (busy) {
    return 'busy';
  }
  if (summary === null) {
    return 'noInspection';
  }
  if (summary.manualCommand !== undefined) {
    return 'manual';
  }
  if (!confirmed) {
    return 'unconfirmed';
  }
  return undefined;
}

/** La phrase du blocage, dans la langue courante. */
export function blockerText(t: Messages, blocker: InstallBlocker): string {
  switch (blocker) {
    case 'busy':
      return t.open.blockerBusy;
    case 'noInspection':
      return t.open.blockerNoInspection;
    case 'manual':
      return t.open.blockerManual;
    case 'unconfirmed':
      return t.open.blockerUnconfirmed;
  }
}

export interface DetectionSummaryProps {
  readonly summary: ProjectSummaryView;
  readonly className?: string;
}

/** Ce que le dossier est, et d'où on le sait. */
export function DetectionSummary({ summary, className }: DetectionSummaryProps): ReactElement {
  const t = useMessages();
  return (
    <div className={className}>
      <p className="pf-title-sm flex flex-wrap items-center gap-2">
        <Icon name="layers" size={16} />
        {summary.label}
      </p>
      <p className="pf-hint mt-1">
        {t.open.manager} : {summary.packageManager ?? t.open.notApplicable} {summary.origin}.
      </p>
      <p className="pf-hint mt-1">
        {t.open.readFile} : <span className="pf-mono">{summary.evidence}</span>
      </p>
      <NoteList className="mt-2" notes={summary.warnings} />
    </div>
  );
}

export interface InstallPanelProps {
  readonly summary: ProjectSummaryView;
  readonly installResult: InstallResultView | null;
  readonly ignoreScripts: boolean;
  readonly onIgnoreScripts: (value: boolean) => void;
  readonly confirmed: boolean;
  readonly onConfirmed: (value: boolean) => void;
  /** La confirmation est donnée et la commande tourne. */
  readonly installing: boolean;
  readonly onInstall: () => void;
  /** Le titre du bloc « détection » : la carte du menu en a déjà un. */
  readonly showDetectionLabel?: boolean;
  /**
   * Vrai quand BuildIt peut **lancer** l'installation : en local seulement.
   *
   * En hébergé, le dossier a été lu dans le navigateur du visiteur ; aucun
   * serveur ne lancera `pnpm install` sur sa machine. Le panneau montre alors
   * la commande, copiable, et le dit plutôt qu'un bouton grisé sans issue.
   */
  readonly runnable?: boolean;
}

/**
 * Le projet reconnu, la commande, l'accord, l'installation.
 *
 * L'installation ne part **jamais** toute seule : la case de confirmation est
 * le seul chemin, et le bouton grisé dit précisément ce qui manque.
 */
export function InstallPanel({
  summary,
  installResult,
  ignoreScripts,
  onIgnoreScripts,
  confirmed,
  onConfirmed,
  installing,
  onInstall,
  showDetectionLabel = true,
  runnable = true,
}: InstallPanelProps): ReactElement {
  const t = useMessages();
  const fieldId = useId();
  const command = plannedCommand(summary, ignoreScripts);
  const blocker = installBlocker(summary, confirmed, installing);

  return (
    <div>
      {showDetectionLabel ? <p className="pf-eyebrow">{t.open.detection}</p> : null}
      <DetectionSummary className="mt-1" summary={summary} />

      {!runnable ? (
        <>
          <p className="pf-label mt-4">{t.open.installCommand}</p>
          <CommandLine
            prompt
            value={summary.manualCommand ?? command ?? '—'}
            what={t.open.commandWhat}
          />
          <p className="pf-hint mt-2">{t.open.runYourself}</p>
        </>
      ) : summary.manualCommand === undefined ? (
        <>
          <p className="pf-label mt-4">{t.open.installCommand}</p>
          {command === undefined ? (
            <p className="pf-hint">{t.open.notApplicable}</p>
          ) : (
            <CommandLine prompt value={command} what={t.open.commandWhat} />
          )}
          <p className="pf-hint mt-2">{t.open.trustNote}</p>

          <label className="pf-hint mt-3 flex items-center gap-2" htmlFor={`${fieldId}-ignore`}>
            <input
              checked={ignoreScripts}
              id={`${fieldId}-ignore`}
              onChange={(event) => onIgnoreScripts(event.target.checked)}
              type="checkbox"
            />
            {t.open.ignoreScripts}
          </label>
          <label className="pf-hint mt-2 flex items-center gap-2" htmlFor={`${fieldId}-confirm`}>
            <input
              checked={confirmed}
              id={`${fieldId}-confirm`}
              onChange={(event) => onConfirmed(event.target.checked)}
              type="checkbox"
            />
            {t.open.confirm}
          </label>

          {installing ? (
            <ProgressPanel
              className="mt-3"
              detail={t.open.installNoMeasure}
              title={t.open.installing}
            />
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                className="pf-btn pf-btn-primary"
                disabled={blocker !== undefined}
                onClick={onInstall}
                type="button"
              >
                <Icon name="download" size={15} />
                {t.open.install}
              </button>
              {blocker === undefined ? null : (
                <span className="pf-hint" role="status">
                  {blockerText(t, blocker)}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="pf-hint mt-3">{t.open.manualOnly(summary.manualCommand)}</p>
      )}

      {installResult === null ? null : installResult.ok ? (
        <p className="pf-hint mt-3 flex items-start gap-2" role="status">
          <span aria-hidden="true" className="mt-0.5 flex-none" style={{ color: 'var(--pf-ok)' }}>
            <Icon name="check" size={14} />
          </span>
          {t.open.installDone(installResult.command)}
        </p>
      ) : (
        <ErrorState
          {...(installResult.retryable
            ? {
                actions: (
                  <button className="pf-btn" onClick={onInstall} type="button">
                    <Icon name="refresh" size={15} />
                    {t.common.retry}
                  </button>
                ),
              }
            : {})}
          className="mt-3"
          illustration="lost"
          issues={installResult.issues}
          title={t.open.installFailed}
        />
      )}
    </div>
  );
}

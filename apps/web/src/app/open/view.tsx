'use client';

import type { ReactElement } from 'react';
import { ScreenShell } from '../../components/wizard/shell';
import type { InstallResultView, ProjectInspectionView } from './project';

/**
 * La vue de l'écran 23 — Open Local Project (§6.23, §18bis).
 *
 * On reconnaît le projet (écosystème, gestionnaire), on affiche la commande
 * d'installation **exacte**, et on ne la lance que sur confirmation explicite.
 * Rien n'est écrit avant.
 *
 * Le chemin est validé côté serveur avant tout accès disque : cette vue ne fait
 * que le transmettre.
 */

export interface OpenViewProps {
  readonly directory: string;
  readonly onDirectory: (value: string) => void;
  readonly inspection: ProjectInspectionView | null;
  readonly installResult: InstallResultView | null;
  readonly ignoreScripts: boolean;
  readonly onIgnoreScripts: (value: boolean) => void;
  readonly confirmed: boolean;
  readonly onConfirmed: (value: boolean) => void;
  readonly busy: boolean;
  readonly onInspect: () => void;
  readonly onInstall: () => void;
}

/** La commande qui sera lancée, selon le choix « sans scripts ». */
export function plannedCommand(
  inspection: ProjectInspectionView | null,
  ignoreScripts: boolean,
): string | undefined {
  if (inspection === null || !inspection.ok) {
    return undefined;
  }
  return ignoreScripts
    ? (inspection.value.safeCommand ?? inspection.value.plainCommand)
    : inspection.value.plainCommand;
}

/** Pourquoi le bouton « Installer » est grisé — `undefined` quand il est actif. */
export function installBlocker(
  inspection: ProjectInspectionView | null,
  confirmed: boolean,
  busy: boolean,
): string | undefined {
  if (busy) {
    return 'Une opération est en cours.';
  }
  if (inspection === null) {
    return 'Analysez d’abord le dossier.';
  }
  if (!inspection.ok) {
    return 'Ce dossier n’est pas un projet reconnu : rien à installer.';
  }
  if (inspection.value.manualCommand !== undefined) {
    return 'L’installation automatique de ce type de projet arrive en V1.';
  }
  if (!confirmed) {
    return 'Cochez la confirmation : rien ne se lancera sans votre accord.';
  }
  return undefined;
}

export function OpenView(props: OpenViewProps): ReactElement {
  const { directory, inspection, installResult, ignoreScripts, confirmed, busy } = props;
  const command = plannedCommand(inspection, ignoreScripts);
  const blocker = installBlocker(inspection, confirmed, busy);

  return (
    <ScreenShell
      title="Ouvrir un projet local"
      description="Reconnaissez un projet déjà sur cette machine : écosystème, gestionnaire de paquets, et la commande d’installation exacte — affichée avant d’être lancée."
    >
      <section className="pf-card pf-card-pad">
        <label className="pf-label" htmlFor="pf-open-directory">
          Dossier du projet
        </label>
        <input
          id="pf-open-directory"
          className="pf-input pf-mono"
          autoComplete="off"
          spellCheck={false}
          placeholder="C:\projets\mon-projet"
          value={directory}
          onChange={(event) => props.onDirectory(event.target.value)}
        />
        <p className="pf-hint mt-1">
          Chemin absolu, sur la machine qui sert cette interface. Seuls les fichiers qui nomment
          l’outillage sont lus (package.json, pyproject.toml, Cargo.toml…).
        </p>
        <button
          type="button"
          className="pf-btn pf-btn-primary mt-3"
          disabled={busy}
          onClick={props.onInspect}
        >
          Analyser le dossier
        </button>
      </section>

      {inspection === null ? null : (
        <section className="pf-card pf-card-pad mt-3">
          <p className="pf-eyebrow">Détection</p>
          {inspection.ok ? (
            <>
              <p className="mt-1">{inspection.value.label}</p>
              <p className="pf-hint mt-1">
                Gestionnaire : {inspection.value.packageManager ?? 'non applicable'} —{' '}
                {inspection.value.origin}. Fichier lu :{' '}
                <span className="pf-mono">{inspection.value.evidence}</span>.
              </p>
              {inspection.value.warnings.map((warning) => (
                <p key={warning} className="pf-hint mt-1">
                  {warning}
                </p>
              ))}

              {inspection.value.manualCommand === undefined ? (
                <>
                  <p className="pf-label mt-4">Commande d’installation</p>
                  <p className="pf-mono">{command ?? '—'}</p>
                  <label className="pf-hint mt-3 flex items-center gap-2" htmlFor="pf-open-ignore">
                    <input
                      id="pf-open-ignore"
                      type="checkbox"
                      checked={ignoreScripts}
                      onChange={(event) => props.onIgnoreScripts(event.target.checked)}
                    />
                    Installer sans exécuter les scripts du projet
                  </label>
                  <label
                    className="pf-hint mt-2 flex items-center gap-2"
                    htmlFor="pf-open-confirmed"
                  >
                    <input
                      id="pf-open-confirmed"
                      type="checkbox"
                      checked={confirmed}
                      onChange={(event) => props.onConfirmed(event.target.checked)}
                    />
                    J’ai lu la commande : lancer l’installation
                  </label>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      className="pf-btn pf-btn-primary"
                      disabled={blocker !== undefined}
                      onClick={props.onInstall}
                    >
                      Installer les dépendances
                    </button>
                    {blocker === undefined ? null : (
                      <span className="pf-hint" role="status">
                        {blocker}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="pf-hint mt-3">
                  L’installation automatique de ce type de projet arrive en V1. Lancez vous-même :{' '}
                  <span className="pf-mono">{inspection.value.manualCommand}</span>
                </p>
              )}
            </>
          ) : (
            inspection.issues.map((issue) => (
              <p key={issue} className="pf-error mt-1">
                {issue}
              </p>
            ))
          )}
        </section>
      )}

      {installResult === null ? null : (
        <section className="pf-card pf-card-pad mt-3">
          <p className="pf-eyebrow">Installation</p>
          {installResult.ok ? (
            <p className="mt-1">
              Dépendances installées : <span className="pf-mono">{installResult.command}</span>.
            </p>
          ) : (
            installResult.issues.map((issue) => (
              <p key={issue} className="pf-error mt-1">
                {issue}
              </p>
            ))
          )}
        </section>
      )}
    </ScreenShell>
  );
}

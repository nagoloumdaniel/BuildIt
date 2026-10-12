'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { CommandLine } from '../../components/ui/copy';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { ProgressPanel } from '../../components/ui/loading';
import { ScreenShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { InstallPanel } from './install-panel';
import type { LocalOpenController } from './local-open';
import { PickCard } from './pick-card';

/**
 * La vue de l'écran 23 — Open Local Project (§6.23).
 *
 * **Aucun champ « collez un chemin », dans aucun mode.** Le dossier se choisit
 * dans l'explorateur : celui de la machine quand BuildIt tourne en local
 * (`pf web`), celui du navigateur quand il est hébergé — dans les deux cas une
 * vraie fenêtre de l'explorateur de Windows, et dans les deux cas l'analyse
 * part au choix du dossier, parce que choisir, c'est demander.
 *
 * Ce que le mode hébergé change est dit à l'endroit où ça compte : le dossier
 * est lu dans le navigateur, donc BuildIt reconnaît le projet mais ne peut rien
 * installer sur la machine du visiteur. La commande s'affiche et se copie.
 *
 * Le fil d'état vit dans `useLocalProjectOpen` : cet écran le rend, il ne le
 * réinvente pas. C'est ce qui garantit que la carte du menu d'accueil et cette
 * page racontent la même chose.
 */

export interface OpenViewProps {
  readonly controller: LocalOpenController;
}

export function OpenView({ controller }: OpenViewProps): ReactElement {
  const t = useMessages();
  const busy = controller.phase === 'inspecting' || controller.installing;
  const picking = controller.phase === 'picking';
  const inspection = controller.inspection;

  return (
    <ScreenShell description={t.open.description} title={t.open.title}>
      <PickCard
        busy={picking || controller.phase === 'inspecting'}
        busyLabel={picking ? t.picker.openingHint : t.open.analysing}
        disabled={controller.mode === 'none' || busy}
        note={t.open.folderHint}
        onPick={controller.pick}
        title={controller.directory === '' ? t.open.pick : t.open.reanalyseFolder}
      />

      {controller.mode === 'browser' ? (
        <p className="pf-callout pf-callout-steel mt-3">{t.open.browserNote}</p>
      ) : null}

      {controller.mode === 'none' ? <p className="pf-callout mt-3">{t.open.noPickerNote}</p> : null}

      {controller.directory === '' ? null : (
        <div className="mt-3">
          <p className="pf-label">{t.open.folderLabel}</p>
          <CommandLine
            className="mt-1"
            value={controller.directory}
            what={controller.mode === 'browser' ? t.open.folderWhat : t.open.pathWhat}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              className="pf-btn pf-btn-sm"
              disabled={busy}
              onClick={controller.reanalyse}
              type="button"
            >
              <Icon name="refresh" size={14} />
              {t.open.reanalyse}
            </button>
            <button
              className="pf-btn pf-btn-ghost pf-btn-sm"
              disabled={busy}
              onClick={controller.clear}
              type="button"
            >
              <Icon name="close" size={14} />
              {t.picker.clear}
            </button>
          </div>
        </div>
      )}

      {controller.notice === null ? null : (
        <p aria-live="polite" className="pf-hint mt-3" role="status">
          {controller.notice}
        </p>
      )}

      {controller.phase === 'idle' && controller.directory === '' ? (
        <EmptyState
          body={t.open.noFolderBody}
          className="mt-3"
          icon="folderOpen"
          title={t.open.noFolderTitle}
        />
      ) : null}

      {controller.phase === 'inspecting' ? (
        <section className="pf-card pf-card-pad mt-3">
          <ProgressPanel detail={controller.directory} title={t.open.analysing} />
        </section>
      ) : null}

      {inspection?.ok === false ? (
        <ErrorState
          actions={
            <>
              <button className="pf-btn" onClick={controller.pick} type="button">
                <Icon name="folderOpen" size={15} />
                {t.open.pick}
              </button>
              <Link className="pf-btn pf-btn-ghost" href="/">
                <Icon name="arrowLeft" size={15} />
                {t.common.backHome}
              </Link>
            </>
          }
          body={t.open.notRecognisedBody}
          className="mt-3"
          illustration="lost"
          issues={inspection.issues}
          title={t.open.notRecognised}
        />
      ) : null}

      {inspection?.ok === true ? (
        <section className="pf-card pf-card-pad mt-3">
          <InstallPanel
            confirmed={controller.confirmed}
            ignoreScripts={controller.ignoreScripts}
            installResult={controller.installResult}
            installing={controller.installing}
            onConfirmed={controller.setConfirmed}
            onIgnoreScripts={controller.setIgnoreScripts}
            onInstall={controller.install}
            runnable={controller.runnable}
            summary={inspection.value}
          />
        </section>
      ) : null}
    </ScreenShell>
  );
}

'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { EmptyState } from '../../components/ui/empty-state';
import { ErrorState } from '../../components/ui/error-state';
import { Icon } from '../../components/ui/icon';
import { LoadingLine, ProgressPanel } from '../../components/ui/loading';
import { PathPicker } from '../../components/ui/path-picker';
import { ScreenShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { InstallPanel } from './install-panel';
import type { LocalOpenController } from './local-open';

/**
 * La vue de l'écran 23 — Open Local Project (§6.23).
 *
 * **Aucun champ « collez un chemin » en local** : le dossier se choisit dans
 * l'explorateur de la machine (`PathPicker`), et l'analyse part au choix du
 * dossier — choisir, c'est demander. Pendant la lecture du disque, une barre
 * d'avancement dit que ça travaille ; le résultat affiche l'écosystème, le
 * gestionnaire et la commande d'installation **exacte**, et rien ne se lance
 * sans un accord explicite.
 *
 * En hébergé, l'explorateur serait celui du serveur : `PathPicker` retombe sur
 * la saisie, et cet écran dit pourquoi (`t.open.hostedNote`) — le repli est
 * nommé, pas subi.
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
  const inspection = controller.inspection;

  return (
    <ScreenShell description={t.open.description} title={t.open.title}>
      <section className="pf-card pf-card-pad">
        <PathPicker
          buttonLabel={t.open.pick}
          disabled={busy}
          hint={t.open.folderHint}
          id="pf-open-directory"
          kind="folder"
          label={t.open.folderLabel}
          onChange={(value) => controller.analyse(value)}
          value={controller.directory}
        />

        {controller.canPick === false ? (
          <p className="pf-callout mt-3">{t.open.hostedNote}</p>
        ) : null}

        {controller.directory === '' ? null : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="pf-btn"
              disabled={busy}
              onClick={() => controller.analyse(controller.directory)}
              type="button"
            >
              <Icon name="refresh" size={15} />
              {t.open.reanalyse}
            </button>
          </div>
        )}

        {controller.phase === 'picking' ? (
          <LoadingLine className="mt-3" size="sm">
            {t.open.picking}
          </LoadingLine>
        ) : null}

        {controller.notice === null ? null : (
          <p aria-live="polite" className="pf-hint mt-2" role="status">
            {controller.notice}
          </p>
        )}
      </section>

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
              <button
                className="pf-btn"
                onClick={() => controller.analyse(controller.directory)}
                type="button"
              >
                <Icon name="refresh" size={15} />
                {t.open.reanalyse}
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
            summary={inspection.value}
          />
        </section>
      ) : null}
    </ScreenShell>
  );
}

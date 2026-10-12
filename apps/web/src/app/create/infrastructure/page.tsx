'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { OptionCard } from '../../../components/ui/option-card';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';
import { loadOptionsAction } from '../../actions';
import { chooseHosting, infrastructureIds, selectedHosting } from './infrastructure';

/**
 * Écran 8 — Infrastructure (§6.9).
 *
 * Deux cases à cocher (`docker`, CI) et un cloud cible. Le brouillon n'a pas de
 * champ cloud : l'hébergeur est un identifiant de la catégorie `hosting` choisi
 * parmi les options du moteur, et il rejoint `draft.technologies`. Docker et
 * CI/CD restent des booléens, parce que le manifest n'a que deux façons de les
 * exprimer — et c'est `lib/draft-to-manifest.ts` qui les traduit.
 *
 * Les identifiants et leurs cibles sont affichés : l'utilisateur n'a pas à
 * deviner ce que ses clics écrivent.
 */
export default function InfrastructurePage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [hosts, setHosts] = useState<readonly OptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer la lecture après une panne du moteur, sans perdre le brouillon.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    const selection = {
      targets: [...draft.targets],
      technologies: [
        ...new Set([...draft.technologies, ...draft.capabilities, ...infrastructureIds(draft)]),
      ].sort(),
    };
    void loadOptionsAction('hosting', selection)
      .then((loaded) => {
        if (alive) {
          setHosts(loaded);
          setFailure(undefined);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(
            error instanceof Error && error.message.length > 0
              ? error.message
              : t.build.infrastructure.engineDown,
          );
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [draft, attempt, t]);

  const hostingIds = hosts.map((host) => host.id);
  const current = selectedHosting(draft.technologies, hostingIds);

  return (
    <StepShell
      step="infrastructure"
      title={t.build.infrastructure.title}
      description={t.build.infrastructure.description}
    >
      <fieldset>
        <legend className="pf-label">{t.build.infrastructure.legend}</legend>
        <div className="pf-grid">
          <label className="pf-choice flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.infra.docker}
              onChange={(event) => {
                const docker = event.target.checked;
                session.update((currentDraft) => ({
                  ...currentDraft,
                  infra: { ...currentDraft.infra, docker },
                }));
              }}
            />
            <span className="min-w-0">
              <span className="pf-choice-name">{t.build.infrastructure.docker}</span>
              <span className="pf-choice-note">{t.build.infrastructure.dockerNote}</span>
            </span>
          </label>

          <label className="pf-choice flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.infra.ci}
              onChange={(event) => {
                const ci = event.target.checked;
                session.update((currentDraft) => ({
                  ...currentDraft,
                  infra: { ...currentDraft.infra, ci },
                }));
              }}
            />
            <span className="min-w-0">
              <span className="pf-choice-name">{t.build.infrastructure.ci}</span>
              <span className="pf-choice-note">{t.build.infrastructure.ciNote}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <section className="mt-6" aria-label={t.build.infrastructure.cloudLegend}>
        <h2 className="pf-label">{t.build.infrastructure.cloudTitle}</h2>
        <p className="pf-hint">
          {t.build.infrastructure.cloudHintBefore} <span className="pf-mono">hosting</span>
          {t.build.infrastructure.cloudHintMid} <span className="pf-mono">technologies</span>
          {t.build.infrastructure.cloudHintAfter}
        </p>
        {loading ? (
          <LoadingLine className="mt-2">{t.build.infrastructure.loading}</LoadingLine>
        ) : null}
        {failure === undefined ? null : (
          <ErrorState
            className="mt-3"
            title={t.build.infrastructure.engineDownTitle}
            body={failure}
            actions={
              <button
                type="button"
                className="pf-btn"
                onClick={() => setAttempt((value) => value + 1)}
              >
                <Icon name="refresh" />
                {t.common.retry}
              </button>
            }
          />
        )}
        {loading || failure !== undefined ? null : hosts.length === 0 ? (
          <p className="pf-hint mt-2">{t.build.infrastructure.empty}</p>
        ) : (
          <div className="pf-grid mt-2">
            {hosts.map((host) => {
              const chosen = host.id === current;
              return (
                <OptionCard
                  key={host.id}
                  option={host}
                  pressed={chosen}
                  alternatives={
                    host.state === 'blocked'
                      ? hosts
                          .filter((item) => item.id !== host.id && item.state === 'available')
                          .slice(0, 3)
                      : []
                  }
                  onToggle={() => {
                    session.update((currentDraft) =>
                      chooseHosting(currentDraft, hostingIds, chosen ? null : host.id),
                    );
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6" aria-label={t.build.infrastructure.manifestLegend}>
        <h2 className="pf-label">{t.build.infrastructure.manifestTitle}</h2>
        <dl className="pf-hint">
          <div>
            <dt className="pf-mono">docker</dt>
            <dd>{t.build.infrastructure.dockerWrites}</dd>
          </div>
          <div>
            <dt className="pf-mono">github-actions</dt>
            <dd>{t.build.infrastructure.ciWrites}</dd>
          </div>
          <div>
            <dt className="pf-mono">hosting</dt>
            <dd>{t.build.infrastructure.hostingWrites}</dd>
          </div>
        </dl>
      </section>
    </StepShell>
  );
}

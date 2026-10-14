'use client';

import { type ReactElement, useEffect, useRef, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { OptionCard } from '../../../components/ui/option-card';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';
import { loadOptionsAction } from '../../actions';
import { currentDeepLink, revealSection } from '../blueprint/deep-link';
import { chooseHosting, infrastructureIds, selectedHosting } from './infrastructure';

/**
 * Écran 8 Infrastructure (§6.9).
 *
 * Deux cases à cocher (`docker`, CI) et un cloud cible. Le brouillon n'a pas de
 * champ cloud : l'hébergeur est un identifiant de la catégorie `hosting` choisi
 * parmi les options du moteur, et il rejoint `draft.technologies`. Docker et
 * CI/CD restent des booléens, parce que le manifest n'a que deux façons de les
 * exprimer et c'est `lib/draft-to-manifest.ts` qui les traduit.
 *
 * La traduction brouillon → manifest n'est plus détaillée ici : le plan du
 * projet (écran 9) montre ce qui sera réellement généré, et un crayon y ramène
 * à la bonne case.
 */
export default function InfrastructurePage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [hosts, setHosts] = useState<readonly OptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const dockerRef = useRef<HTMLButtonElement>(null);
  const ciRef = useRef<HTMLButtonElement>(null);
  const hostingRef = useRef<HTMLElement>(null);

  // L'arrivée par un crayon du plan (`?section=docker|ci|hosting`) : la
  // section visée est amenée sous les yeux, et le bouton reçoit le focus pour
  // qu'un clavier puisse le basculer aussitôt. Sans paramètre, rien ne change.
  useEffect(() => {
    const section = currentDeepLink('section');
    if (section === 'hosting') {
      revealSection(hostingRef.current);
      return;
    }
    const target =
      section === 'docker' ? dockerRef.current : section === 'ci' ? ciRef.current : null;
    if (target !== null) {
      revealSection(target);
      target.focus({ preventScroll: true });
    }
  }, []);

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
          <button
            ref={dockerRef}
            type="button"
            className="pf-choice pf-deep-target"
            data-infra="docker"
            aria-pressed={draft.infra.docker}
            onClick={() => {
              const docker = !draft.infra.docker;
              session.update((currentDraft) => ({
                ...currentDraft,
                infra: { ...currentDraft.infra, docker },
              }));
            }}
          >
            <span className="pf-choice-name">{t.build.infrastructure.docker}</span>
            <span className="pf-choice-note">{t.build.infrastructure.dockerNote}</span>
          </button>

          <button
            ref={ciRef}
            type="button"
            className="pf-choice pf-deep-target"
            data-infra="ci"
            aria-pressed={draft.infra.ci}
            onClick={() => {
              const ci = !draft.infra.ci;
              session.update((currentDraft) => ({
                ...currentDraft,
                infra: { ...currentDraft.infra, ci },
              }));
            }}
          >
            <span className="pf-choice-name">{t.build.infrastructure.ci}</span>
            <span className="pf-choice-note">{t.build.infrastructure.ciNote}</span>
          </button>
        </div>
      </fieldset>

      <section
        ref={hostingRef}
        className="pf-deep-target mt-6"
        aria-label={t.build.infrastructure.cloudLegend}
      >
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
          <div className="pf-grid-4 mt-2">
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
    </StepShell>
  );
}

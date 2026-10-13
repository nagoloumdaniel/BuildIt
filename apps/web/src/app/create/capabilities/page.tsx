'use client';

import type { Category } from '@buildit/registry';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';
import { loadOptionsAction } from '../../actions';
import { currentDeepLink, revealSection } from '../blueprint/deep-link';
import {
  CAPABILITY_FAMILIES,
  type CapabilityCategory,
  DEFAULT_CAPABILITY_CATEGORY,
  engineSelection,
  toggleCapability,
} from './capabilities';
import { CapabilityOptions } from './option-list';

/**
 * Écran 6 — Capabilities (§6.7).
 *
 * L'écran ne connaît **aucune** technologie : il demande au moteur les options
 * d'une famille du catalogue (`loadOptionsAction`) et affiche ce qu'il rend,
 * états et raisons compris. Une famille à la fois : c'est la divulgation
 * progressive du §5, et cela évite de charger 250 fiches d'un coup.
 *
 * Le choix s'écrit dans `draft.capabilities`. Le manifest n'a pas de champ par
 * famille : ces identifiants rejoignent `services`, comme `pf add` les y met.
 */
export default function CapabilitiesPage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [family, setFamily] = useState<CapabilityCategory>(DEFAULT_CAPABILITY_CATEGORY);
  const [options, setOptions] = useState<readonly OptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  // Un rechargement à la demande : la panne du moteur se réessaie sans quitter
  // l'écran ni perdre le brouillon.
  const [attempt, setAttempt] = useState(0);
  const optionsRef = useRef<HTMLElement>(null);

  // L'arrivée par un crayon du plan (`/create/capabilities?family=payments`) :
  // la famille demandée est ouverte et ses options amenées sous les yeux. Une
  // famille inconnue est ignorée : l'écran s'ouvre comme d'habitude.
  useEffect(() => {
    const requested = currentDeepLink('family');
    const known = CAPABILITY_FAMILIES.find((category) => category === requested);
    if (known !== undefined) {
      setFamily(known);
      revealSection(optionsRef.current);
    }
  }, []);

  // Le brouillon est dans les dépendances : chaque bascule change la sélection,
  // donc l'état des options (une capacité peut en débloquer ou en bloquer une
  // autre). La réponse tardive d'une famille quittée est ignorée.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer le chargement après une panne, sans quitter la famille ni perdre le brouillon.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadOptionsAction(family, engineSelection(draft))
      .then((loaded) => {
        if (alive) {
          setOptions(loaded);
          setFailure(undefined);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(
            error instanceof Error && error.message.length > 0
              ? error.message
              : t.wizard.capabilities.engineDown,
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
  }, [family, draft, attempt, t]);

  const familyInfo = t.wizard.capabilities.families[family];
  // Qui appartient à `family` — la seule catégorie dont `toggleCapability` peut,
  // à cet instant, retirer un choix concurrent sans se tromper.
  const categoryOf = useMemo(() => {
    const byId = new Map<string, Category>();
    for (const option of options) {
      byId.set(option.id, family);
    }
    return byId;
  }, [options, family]);

  return (
    <StepShell
      step="capabilities"
      title={t.wizard.capabilities.title}
      description={t.wizard.capabilities.description}
    >
      <fieldset>
        <legend className="pf-label">{t.wizard.capabilities.familiesLegend}</legend>
        <div className="pf-grid">
          {CAPABILITY_FAMILIES.map((category) => (
            <button
              key={category}
              type="button"
              className="pf-choice"
              aria-pressed={category === family}
              onClick={() => {
                setFamily(category);
              }}
            >
              <span className="pf-choice-name">
                {t.wizard.capabilities.families[category].label}
              </span>
              <span className="pf-choice-note">
                {t.wizard.capabilities.families[category].note}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <section
        ref={optionsRef}
        className="pf-deep-target mt-6"
        aria-label={t.wizard.capabilities.optionsLabel}
      >
        <h2 className="pf-label">{familyInfo.label}</h2>
        {loading ? <LoadingLine>{t.wizard.capabilities.loading}</LoadingLine> : null}
        {failure === undefined ? null : (
          <ErrorState
            className="mt-3"
            title={t.wizard.capabilities.engineDownTitle}
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
        {loading || failure !== undefined ? null : (
          <CapabilityOptions
            options={options}
            onToggle={(id) => {
              session.update((current) => toggleCapability(current, id, family, categoryOf));
            }}
          />
        )}
      </section>

      <div className="mt-6">
        <p className="pf-label">{t.wizard.capabilities.kept}</p>
        {draft.capabilities.length === 0 ? (
          <p className="pf-hint">{t.wizard.capabilities.none}</p>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            {draft.capabilities.map((id) => (
              <button
                key={id}
                type="button"
                className="pf-badge pf-badge-accent"
                aria-label={t.wizard.capabilities.remove(id)}
                onClick={() => {
                  session.update((current) => toggleCapability(current, id, family, categoryOf));
                }}
              >
                {id} ✕
              </button>
            ))}
          </p>
        )}
        <p className="pf-hint mt-2">
          {t.wizard.capabilities.servicesNoteBefore} <span className="pf-mono">services</span>
          {t.wizard.capabilities.servicesNoteAfter}
        </p>
      </div>
    </StepShell>
  );
}

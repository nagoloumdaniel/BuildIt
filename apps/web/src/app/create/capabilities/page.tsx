'use client';

import type { Category } from '@buildit/registry';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { categoryIcon } from '../../../components/ui/category-icon';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { StackIcon } from '../../../components/ui/stack-icon';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';
import { loadOptionsAction } from '../../actions';
import { currentDeepLink, revealSection } from '../blueprint/deep-link';
import {
  CAPABILITY_FAMILIES,
  type CapabilityCategory,
  engineSelection,
  toggleCapability,
} from './capabilities';
import { CapabilityOptions } from './option-list';

/**
 * Écran 6 Capabilities (§6.7).
 *
 * L'écran ne connaît **aucune** technologie : il demande au moteur les options
 * d'une famille du catalogue (`loadOptionsAction`) et affiche ce qu'il rend,
 * états et raisons compris.
 *
 * L'écran s'ouvre sur la liste des familles ; un clic n'affiche plus que les
 * options de celle-là, avec un bouton « Retour ». La recherche, elle, lit
 * toutes les familles et montre directement les options qui correspondent.
 *
 * Le choix s'écrit dans `draft.capabilities`. Le manifest n'a pas de champ par
 * famille : ces identifiants rejoignent `services`, comme `pf add` les y met.
 */
export default function CapabilitiesPage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [family, setFamily] = useState<CapabilityCategory | null>(null);
  const [query, setQuery] = useState('');
  const [loaded, setLoaded] = useState<ReadonlyMap<CapabilityCategory, readonly OptionView[]>>(
    new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  // Un rechargement à la demande : la panne du moteur se réessaie sans quitter
  // l'écran ni perdre le brouillon.
  const [attempt, setAttempt] = useState(0);
  const optionsRef = useRef<HTMLElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const familiesRef = useRef<HTMLDivElement>(null);
  // Le focus suit l'exploration : « Retour » à l'ouverture, la famille quittée au retour.
  const [focusTarget, setFocusTarget] = useState<'back' | CapabilityCategory | null>(null);
  const [revealPending, setRevealPending] = useState(false);
  const searching = query.trim() !== '';

  // L'arrivée par un crayon du plan (`/create/capabilities?family=payments`) :
  // la famille demandée est ouverte et ses options amenées sous les yeux. Une
  // famille inconnue est ignorée : l'écran s'ouvre comme d'habitude.
  useEffect(() => {
    const requested = currentDeepLink('family');
    const known = CAPABILITY_FAMILIES.find((category) => category === requested);
    if (known !== undefined) {
      setFamily(known);
      setRevealPending(true);
    }
  }, []);

  useEffect(() => {
    if (revealPending && family !== null) {
      revealSection(optionsRef.current);
      setRevealPending(false);
    }
  }, [revealPending, family]);

  useEffect(() => {
    if (focusTarget === null) {
      return;
    }
    if (focusTarget === 'back') {
      backRef.current?.focus({ preventScroll: true });
    } else {
      familiesRef.current
        ?.querySelector<HTMLButtonElement>(`[data-family="${focusTarget}"]`)
        ?.focus({ preventScroll: true });
    }
    setFocusTarget(null);
  }, [focusTarget]);

  // Les familles à lire : celle qu'on explore, ou toutes pendant une recherche.
  const wanted = useMemo<readonly CapabilityCategory[]>(
    () => (searching ? CAPABILITY_FAMILIES : family === null ? [] : [family]),
    [searching, family],
  );

  // Le brouillon est dans les dépendances : chaque bascule change la sélection,
  // donc l'état des options (une capacité peut en débloquer ou en bloquer une
  // autre). La réponse tardive d'un état quitté est ignorée.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer le chargement après une panne, sans quitter la famille ni perdre le brouillon.
  useEffect(() => {
    if (wanted.length === 0) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const selection = engineSelection(draft);
    void Promise.all(
      wanted.map(
        async (category) => [category, await loadOptionsAction(category, selection)] as const,
      ),
    )
      .then((pairs) => {
        if (alive) {
          setLoaded(new Map(pairs));
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
  }, [wanted, draft, attempt, t]);

  // Qui appartient à quelle famille ce que `toggleCapability` consulte pour
  // retirer un choix concurrent sans se tromper.
  const categoryOf = useMemo(() => {
    const byId = new Map<string, Category>();
    for (const [category, options] of loaded) {
      for (const option of options) {
        byId.set(option.id, category);
      }
    }
    return byId;
  }, [loaded]);

  const labelOf = new Map<string, string>();
  for (const options of loaded.values()) {
    for (const option of options) {
      labelOf.set(option.id, option.label);
    }
  }

  function toggle(id: string, category: CapabilityCategory): void {
    session.update((current) => toggleCapability(current, id, category, categoryOf));
  }

  const needle = query.trim().toLowerCase();
  const results = searching
    ? CAPABILITY_FAMILIES.map((category) => ({
        category,
        options: (loaded.get(category) ?? []).filter(
          (option) =>
            option.label.toLowerCase().includes(needle) || option.id.toLowerCase().includes(needle),
        ),
      })).filter((group) => group.options.length > 0)
    : [];

  const failureState =
    failure === undefined ? null : (
      <ErrorState
        className="mt-3"
        title={t.wizard.capabilities.engineDownTitle}
        body={failure}
        actions={
          <button type="button" className="pf-btn" onClick={() => setAttempt((value) => value + 1)}>
            <Icon name="refresh" />
            {t.common.retry}
          </button>
        }
      />
    );

  return (
    <StepShell
      step="capabilities"
      title={t.wizard.capabilities.title}
      description={t.wizard.capabilities.description}
    >
      <div>
        <label className="pf-label" htmlFor="pf-capability-search">
          {t.wizard.capabilities.searchLabel}
        </label>
        <div className="pf-search mt-1">
          <span aria-hidden="true" className="pf-search-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            id="pf-capability-search"
            className="pf-input"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={t.wizard.capabilities.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <p className="pf-hint mt-1">{t.wizard.capabilities.searchHint}</p>
      </div>

      {searching ? (
        <section className="mt-6" aria-label={t.wizard.capabilities.resultsLabel}>
          <p className="pf-eyebrow">{t.wizard.capabilities.resultsFor(query.trim())}</p>
          {loading ? <LoadingLine>{t.wizard.capabilities.loading}</LoadingLine> : null}
          {failureState}
          {!loading && failure === undefined && results.length === 0 ? (
            <p className="pf-hint mt-2">{t.wizard.capabilities.noMatch}</p>
          ) : null}
          {loading || failure !== undefined
            ? null
            : results.map((group) => (
                <div key={group.category} className="mt-4">
                  <h2 className="pf-label flex items-center gap-2">
                    {t.wizard.capabilities.families[group.category].label}
                    <span className="pf-badge">{group.options.length}</span>
                  </h2>
                  <div className="mt-2">
                    <CapabilityOptions
                      options={group.options}
                      onToggle={(id) => toggle(id, group.category)}
                    />
                  </div>
                </div>
              ))}
        </section>
      ) : family === null ? (
        <fieldset className="mt-6">
          <legend className="pf-label">{t.wizard.capabilities.familiesLegend}</legend>
          <div ref={familiesRef} className="pf-grid-3">
            {CAPABILITY_FAMILIES.map((category) => (
              <button
                key={category}
                type="button"
                className="pf-choice"
                data-family={category}
                onClick={() => {
                  setFocusTarget('back');
                  setFamily(category);
                }}
              >
                <span className="pf-choice-name">
                  <span aria-hidden="true" className="pf-option-icon">
                    <Icon name={categoryIcon(category)} size={16} />
                  </span>
                  {t.wizard.capabilities.families[category].label}
                </span>
                <span className="pf-choice-note">
                  {t.wizard.capabilities.families[category].note}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <section
          ref={optionsRef}
          className="pf-deep-target mt-6"
          aria-label={t.wizard.capabilities.optionsLabel}
        >
          <button
            ref={backRef}
            type="button"
            className="pf-btn pf-btn-ghost pf-btn-sm"
            onClick={() => {
              setFocusTarget(family);
              setFamily(null);
            }}
          >
            <Icon name="arrowLeft" size={14} />
            {t.wizard.capabilities.back}
          </button>
          <h2 className="pf-label mt-3">{t.wizard.capabilities.families[family].label}</h2>
          <p className="pf-hint">{t.wizard.capabilities.families[family].note}</p>
          {loading ? <LoadingLine>{t.wizard.capabilities.loading}</LoadingLine> : null}
          {failureState}
          {loading || failure !== undefined ? null : (
            <div className="mt-3">
              <CapabilityOptions
                options={loaded.get(family) ?? []}
                onToggle={(id) => toggle(id, family)}
              />
            </div>
          )}
        </section>
      )}

      <div className="mt-6">
        <p className="pf-label">{t.wizard.capabilities.kept}</p>
        {draft.capabilities.length === 0 ? (
          <p className="pf-hint">{t.wizard.capabilities.none}</p>
        ) : (
          <ul className="pf-chips mt-2">
            {draft.capabilities.map((id) => {
              const label = labelOf.get(id) ?? id;
              return (
                <li key={id} className="pf-chip">
                  <span aria-hidden="true" className="pf-chip-icon">
                    <StackIcon category={categoryOf.get(id)} id={id} label={label} size={14} />
                  </span>
                  <span className="min-w-0 truncate">{label}</span>
                  <button
                    type="button"
                    className="pf-chip-remove"
                    aria-label={t.wizard.capabilities.remove(label)}
                    title={t.wizard.capabilities.remove(label)}
                    onClick={() => {
                      session.update((current) => ({
                        ...current,
                        capabilities: current.capabilities.filter((existing) => existing !== id),
                      }));
                    }}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="pf-hint mt-2">
          {t.wizard.capabilities.servicesNoteBefore} <span className="pf-mono">services</span>
          {t.wizard.capabilities.servicesNoteAfter}
        </p>
      </div>
    </StepShell>
  );
}

'use client';

import type { Category } from '@buildit/registry';
import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { loadOptionsAction } from '../../actions';
import {
  CAPABILITY_FAMILIES,
  DEFAULT_CAPABILITY_CATEGORY,
  engineSelection,
  toggleCapability,
} from './capabilities';
import { CapabilityOptions } from './option-list';

/** Le message d'une panne du moteur : l'écran le montre, il ne le tait pas. */
function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Le moteur n’a pas répondu.';
}

/**
 * Écran 7 — Capabilities (§6.7).
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
  const draft = useDraft();
  const session = useSession();
  const [family, setFamily] = useState<Category>(DEFAULT_CAPABILITY_CATEGORY);
  const [options, setOptions] = useState<readonly OptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  // Le brouillon est dans les dépendances : chaque bascule change la sélection,
  // donc l'état des options (une capacité peut en débloquer ou en bloquer une
  // autre). La réponse tardive d'une famille quittée est ignorée.
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
          setFailure(failureMessage(error));
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
  }, [family, draft]);

  const familyInfo = CAPABILITY_FAMILIES.find((candidate) => candidate.category === family);
  // Qui appartient à `family` — la seule catégorie dont `toggleCapability`
  // peut, à cet instant, retirer un choix concurrent sans se tromper.
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
      title="Capacités"
      description="Ce que le projet sait faire : paiements, stockage, recherche, IA… Ces choix rejoignent le champ services du manifest — il n’a pas de champ par famille, et c’est ce qui évite de le faire migrer à chaque capacité nouvelle. Tout est conservé dans le brouillon au fur et à mesure."
    >
      <fieldset>
        <legend className="pf-label">Familles de capacités</legend>
        <div className="pf-grid">
          {CAPABILITY_FAMILIES.map((candidate) => (
            <button
              key={candidate.category}
              type="button"
              className="pf-choice"
              aria-pressed={candidate.category === family}
              onClick={() => {
                setFamily(candidate.category);
              }}
            >
              <span className="pf-choice-name">{candidate.label}</span>
              <span className="pf-choice-note">{candidate.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <section className="mt-6" aria-label="Options de la famille choisie">
        <h2 className="pf-label">{familyInfo?.label ?? family}</h2>
        {loading ? <p className="pf-hint">Chargement des options…</p> : null}
        {failure === undefined ? null : <p className="pf-error">{failure}</p>}
        {loading ? null : (
          <CapabilityOptions
            options={options}
            onToggle={(id) => {
              session.update((current) => toggleCapability(current, id, family, categoryOf));
            }}
          />
        )}
      </section>

      <div className="mt-6">
        <p className="pf-label">Capacités retenues</p>
        {draft.capabilities.length === 0 ? (
          <p className="pf-hint">Aucune capacité choisie pour l’instant.</p>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            {draft.capabilities.map((id) => (
              <button
                key={id}
                type="button"
                className="pf-badge pf-badge-accent"
                aria-label={`Retirer ${id}`}
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
          Ces identifiants partent dans <span className="pf-mono">services</span> : le manifest ne
          porte aucune valeur, seulement des choix.
        </p>
      </div>
    </StepShell>
  );
}

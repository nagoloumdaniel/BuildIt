'use client';

import { useEffect, useState } from 'react';
import { useDraft, useSession } from '../../components/wizard/draft-provider';
import { StepShell } from '../../components/wizard/shell';
import { loadPresetsAction } from '../actions';

/** Les deux modes du §5 : peu d'options, ou tout le catalogue. */
const MODES = [
  {
    value: 'guided' as const,
    label: 'Guidé',
    note: 'Deux à quatre choix recommandés par étape. Le reste reste accessible.',
  },
  {
    value: 'expert' as const,
    label: 'Expert',
    note: 'Tout le catalogue, avec recherche et filtres, et les incompatibilités expliquées.',
  },
];

export default function CreatePage() {
  const draft = useDraft();
  const session = useSession();
  // Les presets certifiés viennent du serveur (§8) : le client ne connaît que
  // la vue, jamais le moteur. C'est le motif que suivent tous les écrans.
  const [presets, setPresets] = useState<readonly { id: string; name: string }[]>([]);

  useEffect(() => {
    let alive = true;
    void loadPresetsAction().then((loaded) => {
      if (alive) {
        setPresets(loaded);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <StepShell
      step="create"
      title="Créer un projet"
      description="Nommez le projet et choisissez comment vous voulez le configurer. Tout est conservé au fur et à mesure."
    >
      <label className="pf-label" htmlFor="pf-project-name">
        Nom du projet
      </label>
      <input
        id="pf-project-name"
        className="pf-input"
        autoComplete="off"
        spellCheck={false}
        placeholder="mon-projet"
        value={draft.name}
        onChange={(event) => {
          const name = event.target.value;
          session.update((current) => ({ ...current, name }));
        }}
      />
      <p className="pf-hint mt-1">
        Minuscules, chiffres, points, tirets et soulignés. Ce nom devient le dossier et
        l’identifiant du projet.
      </p>

      <fieldset className="mt-6">
        <legend className="pf-label">Mode de configuration</legend>
        <div className="pf-grid">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className="pf-choice"
              aria-pressed={draft.mode === mode.value}
              onClick={() => session.update((current) => ({ ...current, mode: mode.value }))}
            >
              <span className="pf-choice-name">{mode.label}</span>
              <span className="pf-choice-note">{mode.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <button type="button" className="pf-btn pf-btn-ghost" onClick={() => session.reset()}>
          Repartir de zéro
        </button>
        <span className="pf-hint">Le brouillon se reprend tout seul si vous fermez l’onglet.</span>
      </div>

      {presets.length === 0 ? null : (
        <p className="pf-hint mt-4">
          Presets certifiés disponibles : {presets.map((preset) => preset.name).join(', ')}.
        </p>
      )}
    </StepShell>
  );
}

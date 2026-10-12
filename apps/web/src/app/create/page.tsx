'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui/icon';
import { useDraft, useSession } from '../../components/wizard/draft-provider';
import { StepShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { loadPresetsAction } from '../actions';

/**
 * Écran 1 — Create Project (§6.2).
 *
 * Le nom et le mode de configuration sont les deux seules décisions de cet
 * écran. Les deux modes du §5 sont décrits ici, en clair : « Guidé » n'est pas
 * « Expert » avec moins d'options, c'est deux façons de parcourir le catalogue.
 */
export default function CreatePage() {
  const t = useMessages();
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

  // Les deux modes du §5 : peu d'options, ou tout le catalogue.
  const modes = [
    {
      value: 'guided' as const,
      label: t.wizard.name.modeGuided,
      note: t.wizard.name.modeGuidedNote,
    },
    {
      value: 'expert' as const,
      label: t.wizard.name.modeExpert,
      note: t.wizard.name.modeExpertNote,
    },
  ];

  return (
    <StepShell step="create" title={t.wizard.name.title} description={t.wizard.name.description}>
      <label className="pf-label" htmlFor="pf-project-name">
        {t.wizard.name.label}
      </label>
      <input
        id="pf-project-name"
        className="pf-input"
        autoComplete="off"
        spellCheck={false}
        placeholder={t.wizard.namePlaceholder}
        value={draft.name}
        onChange={(event) => {
          const name = event.target.value;
          session.update((current) => ({ ...current, name }));
        }}
      />
      <p className="pf-hint mt-1">{t.wizard.name.hint}</p>

      <fieldset className="mt-6">
        <legend className="pf-label">{t.wizard.name.modeLegend}</legend>
        <div className="pf-grid">
          {modes.map((mode) => (
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

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="pf-btn pf-btn-ghost" onClick={() => session.reset()}>
          <Icon name="refresh" />
          {t.wizard.name.reset}
        </button>
        <span className="pf-hint min-w-0">{t.wizard.name.draftNote}</span>
      </div>

      {presets.length === 0 ? null : (
        <p className="pf-hint mt-4">
          {t.wizard.name.presets(presets.map((preset) => preset.name).join(', '))}
        </p>
      )}
    </StepShell>
  );
}

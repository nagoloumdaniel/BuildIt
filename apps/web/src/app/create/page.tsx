'use client';

import { Suspense } from 'react';
import { useDraft, useSession } from '../../components/wizard/draft-provider';
import { StepShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { FreshStart } from './fresh-start';

/**
 * Écran 1 Create Project (§6.2).
 *
 * Le nom et le mode de configuration sont les deux seules décisions de cet
 * écran. Les deux modes du §5 sont décrits ici, en clair : « Guidé » n'est pas
 * « Expert » avec moins d'options, c'est deux façons de parcourir le catalogue.
 */
export default function CreatePage() {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();

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
      {/* « Nouveau projet » arrive ici avec `?new=1` : brouillon neuf. */}
      <Suspense fallback={null}>
        <FreshStart />
      </Suspense>
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
    </StepShell>
  );
}

'use client';

import { Suspense } from 'react';
import { useDraft, useSession } from '../../components/wizard/draft-provider';
import { StepShell } from '../../components/wizard/shell';
import { useMessages } from '../../lib/i18n/provider';
import { FreshStart } from './fresh-start';

/**
 * Écran 1 Create Project (§6.2).
 *
 * Le nom est la seule décision de cet écran. Le mode de configuration
 * (guidé/expert) se choisit au Stack Builder, l'écran où il change réellement
 * la présentation du catalogue : le répéter ici faisait deux endroits pour une
 * même décision sans rien clarifier.
 */
export default function CreatePage() {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();

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
    </StepShell>
  );
}

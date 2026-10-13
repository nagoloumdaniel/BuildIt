'use client';

import type { ReactElement } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import { ProjectTypeChoices, withType } from './profiles';

/**
 * L'écran 3 du §6.4. Ce fichier ne porte **que** l'assemblage : la coquille
 * d'étape et le branchement au brouillon. Next refuse tout export autre que
 * `default` dans un `page.tsx` (validateur engendré), donc les données et le
 * contenu vivent dans `profiles.tsx`.
 */
export default function TypePage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();

  return (
    <StepShell step="type" title={t.wizard.types.title} description={t.wizard.types.description}>
      <ProjectTypeChoices
        selected={draft.type}
        onSelect={(type) => session.update((current) => withType(current, type))}
      />
    </StepShell>
  );
}

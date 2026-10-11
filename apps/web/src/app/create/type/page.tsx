'use client';

import type { ReactElement } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { ProjectTypeChoices, withType } from './profiles';

/**
 * L'écran 4 du §6.4. Ce fichier ne porte **que** l'assemblage : la coquille
 * d'étape et le branchement au brouillon. Next refuse tout export autre que
 * `default` dans un `page.tsx` (validateur engendré), donc les données et le
 * contenu vivent dans `profiles.tsx`.
 */
export default function TypePage(): ReactElement {
  const draft = useDraft();
  const session = useSession();

  return (
    <StepShell
      step="type"
      title="Profil du projet"
      description="Le profil oriente l’architecture et la stack proposées ensuite. Il n’entre pas dans le manifest : c’est une aide au choix, pas une contrainte du moteur."
    >
      <ProjectTypeChoices
        mode={draft.mode}
        selected={draft.type}
        targets={draft.targets}
        onSelect={(type) => session.update((current) => withType(current, type))}
      />
    </StepShell>
  );
}

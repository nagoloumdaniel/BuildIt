'use client';

import type { ReactElement } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { ArchitectureChoices, withArchitecture } from './options';

/**
 * L'écran 5 du §6.5. Ce fichier ne porte **que** l'assemblage : la coquille
 * d'étape et le branchement au brouillon. Next refuse tout export autre que
 * `default` dans un `page.tsx` (validateur engendré), donc les données et le
 * contenu vivent dans `options.tsx`.
 */
export default function ArchitecturePage(): ReactElement {
  const draft = useDraft();
  const session = useSession();

  return (
    <StepShell
      step="architecture"
      title="Architecture"
      description="La forme la plus souple n’est pas la moins chère à exploiter. L’architecture choisie part dans le manifest."
    >
      <ArchitectureChoices
        mode={draft.mode}
        selected={draft.architecture}
        type={draft.type}
        onSelect={(architecture) =>
          session.update((current) => withArchitecture(current, architecture))
        }
      />
    </StepShell>
  );
}

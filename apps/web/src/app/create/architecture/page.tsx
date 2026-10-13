'use client';

import { type ReactElement, useEffect } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import { ArchitectureChoices, DEFAULT_ARCHITECTURE, withArchitecture } from './options';

/**
 * L'écran 4 du §6.5. Ce fichier ne porte **que** l'assemblage : la coquille
 * d'étape et le branchement au brouillon. Next refuse tout export autre que
 * `default` dans un `page.tsx` (validateur engendré), donc les données et le
 * contenu vivent dans `options.tsx`.
 *
 * Préremplissage : à la première visite (`architecture` encore vide), une
 * forme par défaut (`DEFAULT_ARCHITECTURE`) est posée, parce que le manifest en
 * exige une. Le test se fait **dans** le changement, sur l'état courant : un
 * brouillon relu après un rechargement ne doit jamais être écrasé.
 */
export default function ArchitecturePage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();

  useEffect(() => {
    if (draft.architecture === undefined) {
      session.update((current) =>
        current.architecture === undefined
          ? withArchitecture(current, DEFAULT_ARCHITECTURE)
          : current,
      );
    }
  }, [draft.architecture, session]);

  return (
    <StepShell
      step="architecture"
      title={t.wizard.architecture.title}
      description={t.wizard.architecture.description}
    >
      <ArchitectureChoices
        selected={draft.architecture}
        technologies={draft.technologies}
        targets={draft.targets}
        onSelect={(architecture) =>
          session.update((current) => withArchitecture(current, architecture))
        }
      />
    </StepShell>
  );
}

'use client';

import { type ReactElement, useEffect } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import { ArchitectureChoices, defaultArchitecture, withArchitecture } from './options';

/**
 * L'écran 4 du §6.5. Ce fichier ne porte **que** l'assemblage : la coquille
 * d'étape et le branchement au brouillon. Next refuse tout export autre que
 * `default` dans un `page.tsx` (validateur engendré), donc les données et le
 * contenu vivent dans `options.tsx`.
 *
 * Préremplissage : à la première visite (`architecture` encore vide), la forme
 * la plus recommandée pour le profil (`defaultArchitecture`) est posée toute
 * seule — l'utilisateur voit tout de suite un choix cohérent, badgé
 * « Recommandé » **et** « Choisie », au lieu d'un écran vide à remplir. Il
 * reste libre d'en choisir une autre ; une fois posée (ici ou par un clic),
 * l'effet ne la touche plus jamais.
 */
export default function ArchitecturePage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();

  useEffect(() => {
    if (draft.architecture === undefined) {
      session.update((current) => withArchitecture(current, defaultArchitecture(current.type)));
    }
  }, [draft.architecture, session]);

  return (
    <StepShell
      step="architecture"
      title={t.wizard.architecture.title}
      description={t.wizard.architecture.description}
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

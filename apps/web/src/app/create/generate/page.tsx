'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { ProjectExport } from '../../../components/ui/project-export';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { useLocale } from '../../../lib/i18n/provider';
import { browserProjectStorage } from '../../../lib/projects';
import type { GenerationView } from '../../actions';
import { browserSessionStorage, saveReport } from '../report/result';
import { rememberGeneratedProject } from './remember';

/**
 * Generation (§6.13).
 *
 * Un seul geste d'abord, « Générer le projet », puis deux sorties distinctes :
 * l'archive ZIP (partout) ou le dossier choisi dans l'explorateur de la machine
 * (en local), avec ou sans installation des dépendances. Tout le parcours est
 * dans `ProjectExport`, qui ne connaît que le manifest : la liste des projets
 * le réutilise tel quel.
 *
 * Cet écran ne garde que ce qui tient au parcours : le rapport transmis à
 * l'écran Report (§6.14) par `sessionStorage`, et la **mémoire des projets
 * générés**, avec le manifest qui permettra de refaire une archive ou
 * d'écrire le même projet ailleurs. Les deux ne sont écrits qu'au succès : un
 * refus n'a produit aucun projet. Le « Continuer » du parcours mène au
 * rapport : pas de second bouton pour y aller.
 */
export default function GeneratePage() {
  const { t: messages } = useLocale();
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);

  const remember = useCallback(
    (result: GenerationView) => {
      if (!manifest.ok) {
        return;
      }
      saveReport(browserSessionStorage(), result);
      rememberGeneratedProject(browserProjectStorage(), draft, result, new Date(), manifest.value);
    },
    [draft, manifest],
  );

  if (!manifest.ok) {
    return (
      <StepShell
        step="generate"
        title={messages.build.generate.title}
        description={messages.output.generateDescription}
      >
        <ErrorState
          title={messages.build.generate.incompleteTitle}
          body={messages.build.generate.incompleteBody}
          issues={manifest.issues.map((issue) => issue.message)}
          actions={
            <Link className="pf-btn" href="/create/stack">
              <Icon name="layers" />
              {messages.build.generate.fixStack}
            </Link>
          }
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      step="generate"
      title={messages.build.generate.title}
      description={messages.output.generateDescription}
    >
      <ProjectExport
        manifest={manifest.value}
        onGenerated={remember}
        projectName={manifest.value.name}
      />
    </StepShell>
  );
}

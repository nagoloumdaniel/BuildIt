'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { ProjectExport } from '../../../components/ui/project-export';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { useLocale } from '../../../lib/i18n/provider';
import { browserProjectStorage } from '../../../lib/projects';
import type { GenerationView } from '../../actions';
import { browserSessionStorage, saveReport } from '../report/result';
import { GithubConnectPanel } from './github-connect';
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
 *
 * La **première** sortie réussie (archive téléchargée, dossier écrit, en local
 * comme par le navigateur) verrouille le brouillon (`generated: true`) : le
 * projet existe désormais hors de BuildIt, le modifier ici le ferait diverger
 * de ce qui est sur le disque. Le cadre des étapes lit ce drapeau pour fermer
 * le retour aux étapes 1 à 10. Comme on ne revient pas en arrière, l'écran le
 * dit **avant** le premier geste, pas après.
 */
export default function GeneratePage() {
  const { t: messages } = useLocale();
  const draft = useDraft();
  const session = useSession();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);
  // Le dépôt GitHub demandé à la génération en dossier, quand le panneau en
  // porte un nom et que le compte est connecté. Choix, jamais obligation.
  const [github, setGithub] = useState<{ readonly name: string } | undefined>(undefined);

  const onGithubChange = useCallback((next: { readonly name: string } | undefined) => {
    setGithub(next);
  }, []);

  const remember = useCallback(
    (result: GenerationView) => {
      if (!manifest.ok) {
        return;
      }
      saveReport(browserSessionStorage(), result);
      rememberGeneratedProject(browserProjectStorage(), draft, result, new Date(), manifest.value);
      // Tout de suite, pas au passage au rapport : un onglet fermé ici doit
      // déjà retrouver un projet verrouillé.
      session.update((current) =>
        current.generated === true ? current : { ...current, generated: true },
      );
    },
    [draft, manifest, session],
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
      {draft.generated === true ? null : (
        <div className="pf-callout pf-output-lock mb-4" role="note">
          <p className="pf-output-callout-title flex items-center gap-2">
            <Icon name="lock" size={14} />
            {messages.output.lockTitle}
          </p>
          <p className="mt-1">{messages.output.lockBody}</p>
        </div>
      )}
      {draft.generated === true ? null : (
        <div className="mb-4">
          <GithubConnectPanel onChange={onGithubChange} projectName={manifest.value.name} />
        </div>
      )}
      <ProjectExport
        install={{ docker: draft.infra.docker, envVarNames: draft.envVarNames }}
        manifest={manifest.value}
        onGenerated={remember}
        projectName={manifest.value.name}
        {...(github === undefined ? {} : { github })}
      />
    </StepShell>
  );
}

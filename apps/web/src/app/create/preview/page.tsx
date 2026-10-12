'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { ProjectArchitecture } from '../../../components/ui/project-architecture';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { useMessages } from '../../../lib/i18n/provider';

/**
 * Architecture du projet (§6.12, ex-« aperçu des fichiers »).
 *
 * L'écran ne calcule rien lui-même : il convertit le brouillon en manifest
 * (`draftToManifest`, le même convertisseur que le CLI) et confie le reste à
 * `ProjectArchitecture`, qui sert aussi `/projects/architecture`. Un manifest
 * se lit ainsi de la même façon avant et après la génération.
 *
 * Un brouillon incomplet n'a pas d'architecture : l'écran le dit et renvoie
 * vers la stack, plutôt que de montrer un arbre vide qui laisserait croire que
 * le projet ne contiendrait rien.
 */
export default function PreviewPage() {
  const t = useMessages();
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);

  if (!manifest.ok) {
    return (
      <StepShell
        description={t.architecture.descriptionIncomplete}
        step="preview"
        title={t.architecture.title}
      >
        <ErrorState
          actions={
            <>
              <Link className="pf-btn" href="/create/stack">
                <Icon name="layers" />
                {t.architecture.fixStack}
              </Link>
              <Link className="pf-btn pf-btn-ghost" href="/">
                <Icon name="home" />
                {t.architecture.backHome}
              </Link>
            </>
          }
          body={t.architecture.incompleteBody}
          issues={manifest.issues.map((issue) => issue.message)}
          title={t.architecture.incompleteTitle}
        />
      </StepShell>
    );
  }

  return (
    <StepShell description={t.architecture.description} step="preview" title={t.architecture.title}>
      <ProjectArchitecture manifest={manifest.value} />
    </StepShell>
  );
}

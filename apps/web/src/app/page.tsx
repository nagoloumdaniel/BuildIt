'use client';

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useDraft, useSession } from '../components/wizard/draft-provider';
import { ScreenShell } from '../components/wizard/shell';
import { downloadZip } from '../lib/download-zip';
import { stepMemory } from '../lib/journey-transition';
import { browserProjectStorage, loadProjects, type StoredProject } from '../lib/projects';
import { browserSessionStorage, type GenerationReport, loadReport } from './create/report/result';
import { DashboardView } from './dashboard-view';
import { usePickHandoff } from './open/pick-handoff';
import { SharedLink } from './shared-link';

/**
 * Écran 1 Dashboard (§6.1, §18bis) : le branchement.
 *
 * Le contenu testable vit dans `dashboard-view.tsx` (Next interdit tout export
 * autre que `default` ici). Ce fichier ne fait que fournir le brouillon, la
 * session, le rapport de génération et la liste des projets générés, lus en
 * `sessionStorage`/`localStorage`, donc **après hydratation**, jamais au
 * premier rendu serveur.
 *
 * Tant que la liste n'est pas lue, `DashboardView` reçoit `null` et dit qu'elle
 * lit annoncer « aucun projet » puis afficher trois cartes serait un
 * mensonge, et un saut de mise en page.
 *
 * L'écran n'a **pas** de titre : le nom du produit est déjà dans l'en-tête, et
 * un « BuildIt » de 32 px suivi de sa propre description répétait la seule
 * chose que le visiteur voit déjà. La page s'ouvre donc sur les chemins ce
 * qu'on vient y faire.
 */
export default function Home(): ReactElement {
  const draft = useDraft();
  const session = useSession();
  const [report, setReport] = useState<GenerationReport | null>(null);
  const [projects, setProjects] = useState<readonly StoredProject[] | null>(null);
  const openLocal = usePickHandoff();

  useEffect(() => {
    // L'accueil n'est pas une étape : revenir d'ici au parcours ne doit pas
    // faire glisser l'étape 1 comme un retour en arrière.
    stepMemory.clear();
    setReport(loadReport(browserSessionStorage()));
    setProjects(loadProjects(browserProjectStorage()));
  }, []);

  return (
    <ScreenShell back={null}>
      <DashboardView
        draft={draft}
        openLocal={openLocal}
        onReset={() => {
          session.reset();
        }}
        projects={projects}
        report={report}
        {...(report?.zipBase64 === undefined
          ? {}
          : {
              onRedownload: () => {
                if (report.zipBase64 !== undefined) {
                  downloadZip(report.zipBase64, draft.name);
                }
              },
            })}
      />

      {/* Le champ « lien partagé reçu » vit **dans** la page, pas dans une
          seconde coquille : deux `pf-shell` empilés doublaient le rembourrage
          bas et laissaient un vide de 150 px sous la dernière carte. Il utilise
          le routeur, mais les tests le simulent déjà (`page.test.ts`). */}
      <SharedLink />
    </ScreenShell>
  );
}

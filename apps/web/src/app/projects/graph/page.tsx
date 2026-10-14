'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { browserProjectStorage, loadProjects } from '../../../lib/projects';
import { lookupProject, type ProjectLookup } from '../architecture/view';
import { ProjectGraphScreen } from './view';

/**
 * `/projects/graph?id=<projectId>` : le branchement.
 *
 * La liste des projets vit en `localStorage` : elle n'est lue qu'après
 * hydratation, jamais au premier rendu serveur. L'identifiant est lu au même
 * moment, dans `window.location`, plutôt que par `useSearchParams` : la page
 * n'a rien à rendre côté serveur, et elle n'impose ainsi pas de frontière
 * `Suspense` pour une valeur dont elle ne se sert qu'avec le stockage.
 */
export default function ProjectGraphPage(): ReactElement {
  const [lookup, setLookup] = useState<ProjectLookup | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    setLookup(lookupProject(loadProjects(browserProjectStorage()), id));
  }, []);

  return <ProjectGraphScreen lookup={lookup} />;
}

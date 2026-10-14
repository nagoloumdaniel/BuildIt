'use client';

import { type ReactElement, useCallback, useEffect, useState } from 'react';
import {
  browserProjectStorage,
  loadProjects,
  projectId,
  rememberProject,
  type StoredProject,
} from '../../lib/projects';
import type { GenerationView } from '../actions';
import { ProjectsView } from './view';

/**
 * Écran « Tous les projets » (§6.14) : le branchement.
 *
 * La liste vit en `localStorage` : elle n'est donc lue qu'après hydratation,
 * jamais au premier rendu serveur. Tant qu'elle n'est pas lue, la vue dit
 * qu'elle lit elle n'affiche pas « aucun projet », qui serait faux.
 *
 * Le re-téléchargement n'est proposé que pour le projet dont l'archive est
 * encore en main : le rapport vit en `sessionStorage`, et c'est `ProjectExport`
 * qui porte ce geste.
 *
 * Depuis que la poubelle de la carte choisit **ce qui** disparaît (la ligne
 * BuildIt, le dépôt GitHub, le dossier local), les gestes ne vivent plus ici :
 * `ProjectsView` exécute la suppression, écrit `localStorage`, puis appelle
 * `onChanged`. La page relit alors la liste au lieu de garder une copie
 * qu'elle croirait à jour c'est exactement le défaut que deux boutons séparés
 * entretenaient.
 */
export default function ProjectsPage(): ReactElement {
  const [projects, setProjects] = useState<readonly StoredProject[] | null>(null);

  useEffect(() => {
    setProjects(loadProjects(browserProjectStorage()));
  }, []);

  /**
   * Relire la liste après une suppression. C'est le seul chemin de mise à
   * jour de ce côté-ci : la vue a déjà écrit ce qu'il fallait.
   */
  const changed = useCallback((): void => {
    setProjects(loadProjects(browserProjectStorage()));
  }, []);

  /**
   * Un projet réécrit dans un **autre** dossier est un nouvel exemplaire sur le
   * disque : il rejoint la liste, avec son dossier, pour qu'on le retrouve et
   * qu'on puisse le supprimer. Une archive, elle, n'écrit rien chez BuildIt :
   * la liste ne bouge pas.
   */
  const exported = useCallback((project: StoredProject, result: GenerationView): void => {
    if (!result.ok || result.directory === '') {
      return;
    }
    const at = new Date();
    setProjects(
      rememberProject(browserProjectStorage(), {
        ...project,
        id: projectId(project.name, at),
        directory: result.directory,
        fileCount: result.files.length,
        bytes: result.bytes,
        generatedAt: at.toISOString(),
      }),
    );
  }, []);

  // Le rapport de session disait quelle archive restait téléchargeable ; le
  // geste de re-téléchargement vit dans la carte ProjectExport, qui le porte
  // elle-même. La page n'a donc plus à le lire.
  return <ProjectsView onChanged={changed} onExported={exported} projects={projects} />;
}

import type { DraftState } from '../../../lib/draft';
import {
  type ProjectStorage,
  projectId,
  rememberProject,
  type StoredProject,
} from '../../../lib/projects';
import type { GenerationView } from '../../actions';

/**
 * La mémoire des projets générés (§6.14).
 *
 * Un projet généré **n'est plus un brouillon** : il est sur le disque, il ne se
 * modifie plus depuis BuildIt, et c'est la liste des projets — pas la reprise de
 * parcours — qui le porte. Cette fonction est le seul endroit qui écrit cette
 * mémoire, et elle n'écrit **rien** si la génération a été refusée : un refus
 * reste à corriger, il n'a produit aucun projet.
 *
 * Le stockage et l'horodatage sont injectés : la règle se prouve sans navigateur
 * (`ProjectStorage` est un simple `read`/`write`), et deux générations du même
 * nom dans le même dossier se remplacent au lieu de s'empiler
 * (`rememberProject`).
 */
export function rememberGeneratedProject(
  storage: ProjectStorage,
  draft: DraftState,
  report: GenerationView,
  now: Date = new Date(),
): readonly StoredProject[] {
  if (!report.ok) {
    return [];
  }
  return rememberProject(storage, {
    id: projectId(draft.name, now),
    name: draft.name,
    directory: report.directory,
    fileCount: report.files.length,
    bytes: report.bytes,
    generatedAt: now.toISOString(),
    // Copie : la liste est persistée, et le brouillon peut encore changer.
    technologies: [...draft.technologies],
  });
}

import {
  type Architecture,
  isoDate,
  type Manifest,
  type SkeletonDir,
  skeletonFiles,
  skeletonTree,
  withoutDuplicateShared,
} from '@buildit/manifest';
import type { RegistryEntry } from '@buildit/registry';
import type { PlannedFile } from './plan.js';

/**
 * Les dossiers et fichiers de base propres à l'architecture choisie.
 *
 * L'arborescence vient de `skeletonTree` (@buildit/manifest), la même que
 * l'aperçu de l'assistant. Ici, chaque dossier reçoit un README court qui dit
 * sa responsabilité et sa règle de dépendance — pas de code factice : des
 * fichiers qui compilent dans toutes les stacks, quel que soit le langage.
 * S'y ajoutent l'ADR-001 qui explique le choix, la vue d'architecture, et
 * CONTRIBUTING.md / SECURITY.md.
 */

/** Le framework de chaque côté, détecté par la catégorie des fiches. */
function stackOf(entries: readonly RegistryEntry[]) {
  return {
    frontend: entries.some((entry) => entry.category === 'frontend'),
    backend: entries.some((entry) => entry.category === 'backend'),
  };
}

const APP_BASES = ['apps/web/', 'apps/api/', ''] as const;

/**
 * Respecte la convention de l'application générée : si ses templates posent
 * des fichiers mais aucun sous `src/` (Next.js avec `app/` à la racine,
 * Django, Rails…), les dossiers du squelette vont à sa racine plutôt que dans
 * un `src/` qui ne contiendrait qu'eux.
 */
function followConvention(
  dirs: readonly SkeletonDir[],
  planned: readonly PlannedFile[],
): SkeletonDir[] {
  const withoutSrc = APP_BASES.filter((base) => {
    const own = planned.filter(
      (file) =>
        file.path.startsWith(base) &&
        (base !== '' || !file.path.startsWith('apps/')) &&
        file.path.slice(base.length).includes('/'),
    );
    return own.length > 0 && !own.some((file) => file.path.startsWith(`${base}src/`));
  });
  return dirs.map((dir) => {
    const base = withoutSrc.find((candidate) => dir.path.startsWith(`${candidate}src/`));
    return base === undefined
      ? dir
      : { ...dir, path: base + dir.path.slice(base.length + 'src/'.length) };
  });
}

export interface SkeletonOptions {
  /** Date de génération, inscrite dans l'ADR-001 (déterministe en test). */
  readonly now?: Date | undefined;
}

/** Vrai si un fichier planifié se trouve sous ce dossier. */
function plannedDir(planned: readonly PlannedFile[]) {
  return (dir: string) => planned.some((file) => file.path.startsWith(`${dir}/`));
}

export function architectureSkeleton(
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  planned: readonly PlannedFile[] = [],
  options: SkeletonOptions = {},
): PlannedFile[] {
  const architecture = manifest.architecture;
  const source = `architecture:${architecture}`;
  // Le template a déjà `components/` ou `lib/` (Next.js) : pas de shared/ui
  // ni shared/lib en doublon à côté.
  const dirs = withoutDuplicateShared(
    followConvention(skeletonTree(architecture, stackOf(entries)), planned),
    plannedDir(planned),
  );
  const date = isoDate(options.now ?? new Date());
  return skeletonFiles(manifest.name, architecture, dirs, { date }).map((file) => ({
    ...file,
    source,
  }));
}

/** Ajoute le squelette sans jamais écraser un fichier déjà planifié : les templates gagnent. */
export function withArchitectureSkeleton(
  files: readonly PlannedFile[],
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  options: SkeletonOptions = {},
): PlannedFile[] {
  const taken = new Set(files.map((file) => file.path));
  return [
    ...files,
    ...architectureSkeleton(manifest, entries, files, options).filter(
      (file) => !taken.has(file.path),
    ),
  ];
}

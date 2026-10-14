import {
  ARCHITECTURES,
  type Architecture,
  type SkeletonFile,
  type SkeletonStack,
  skeletonFiles,
  skeletonTree,
  withoutDuplicateShared,
} from '@buildit/manifest';

/**
 * Les dossiers et fichiers de base d'un projet **déjà existant**.
 *
 * Même source que la génération (`skeletonTree` + `skeletonFiles`, dans
 * `@buildit/manifest`) : un projet ouvert reçoit exactement ce qu'un projet
 * généré aurait eu. Module pur, sans `fs` il tourne dans le navigateur en
 * hébergé comme sur le serveur en local.
 *
 * Règle d'or : on ne propose que ce qui **manque**. Un fichier présent n'est
 * jamais réécrit.
 */

export const MANIFEST_FILE = 'pf.manifest.json';

export interface ProjectShape {
  readonly name: string;
  readonly architecture: Architecture;
  readonly stack: SkeletonStack;
  /** `manifest` : lue dans `pf.manifest.json` ; `inferred` : déduite des fichiers. */
  readonly source: 'manifest' | 'inferred';
}

export interface ShapeInput {
  /** Le nom du dossier choisi. */
  readonly folder: string;
  /** Les fichiers du premier niveau. */
  readonly files: readonly string[];
  /** Les dossiers du premier niveau. */
  readonly dirs: readonly string[];
  readonly packageJson?: string | undefined;
  readonly manifest?: string | undefined;
}

const FRONTEND_DEPS = [
  'next',
  'react',
  'react-dom',
  'vue',
  'nuxt',
  'svelte',
  '@sveltejs/kit',
  'astro',
  '@angular/core',
  'solid-js',
  'vite',
  '@remix-run/react',
];
const BACKEND_DEPS = [
  'express',
  'hono',
  'fastify',
  '@nestjs/core',
  'koa',
  '@adonisjs/core',
  'elysia',
];
/** Fichiers d'écosystèmes serveur : leur présence dit « back ». */
const BACKEND_FILES = [
  'pyproject.toml',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'Gemfile',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'manage.py',
];

function parseJson(text: string | undefined): Record<string, unknown> | undefined {
  if (text === undefined) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function isArchitecture(value: unknown): value is Architecture {
  return typeof value === 'string' && (ARCHITECTURES as readonly string[]).includes(value);
}

function hasFramework(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['framework'] === 'string'
  );
}

function fromManifest(text: string | undefined): ProjectShape | undefined {
  const manifest = parseJson(text);
  if (manifest === undefined || !isArchitecture(manifest['architecture'])) {
    return undefined;
  }
  const name = typeof manifest['name'] === 'string' ? manifest['name'] : undefined;
  if (name === undefined || name === '') {
    return undefined;
  }
  return {
    name,
    architecture: manifest['architecture'],
    stack: {
      frontend: hasFramework(manifest['frontend']),
      backend: hasFramework(manifest['backend']),
    },
    source: 'manifest',
  };
}

function dependencies(pkg: Record<string, unknown> | undefined): readonly string[] {
  if (pkg === undefined) {
    return [];
  }
  return ['dependencies', 'devDependencies'].flatMap((key) => {
    const block = pkg[key];
    return typeof block === 'object' && block !== null ? Object.keys(block) : [];
  });
}

function inferArchitecture(dirs: ReadonlySet<string>, files: ReadonlySet<string>): Architecture {
  if (dirs.has('services')) return 'microservices';
  if (dirs.has('functions')) return 'serverless';
  if (
    dirs.has('apps') ||
    files.has('pnpm-workspace.yaml') ||
    files.has('turbo.json') ||
    files.has('nx.json') ||
    files.has('lerna.json')
  ) {
    return 'monorepo';
  }
  return 'single-app';
}

export function projectShape(input: ShapeInput): ProjectShape {
  const declared = fromManifest(input.manifest);
  if (declared !== undefined) {
    return declared;
  }
  const files = new Set(input.files);
  const dirs = new Set(input.dirs);
  const pkg = parseJson(input.packageJson);
  const deps = dependencies(pkg);
  const frontend = deps.some((dep) => FRONTEND_DEPS.includes(dep));
  const backend =
    deps.some((dep) => BACKEND_DEPS.includes(dep)) || BACKEND_FILES.some((file) => files.has(file));
  const pkgName = typeof pkg?.['name'] === 'string' ? pkg['name'] : '';
  return {
    name: pkgName === '' ? input.folder : pkgName,
    architecture: inferArchitecture(dirs, files),
    // Rien de reconnu : le squelette d'application unique pose ses modules,
    // la forme la plus neutre.
    stack: { frontend, backend },
    source: 'inferred',
  };
}

/** La date du jour, locale, en `AAAA-MM-JJ` celle inscrite dans l'ADR. */
export function localIsoDate(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface BaseFilesOptions {
  /** Vrai si ce dossier existe déjà dans le projet (`components`, `src/lib`…). */
  readonly existsDir?: (path: string) => boolean;
  /** Date de l'ADR ; par défaut, aujourd'hui. */
  readonly date?: string;
}

/**
 * Les dossiers dont l'existence change le squelette : les jumeaux de
 * `shared/ui` et `shared/lib` (`components/`, `lib/`). À vérifier avant
 * `baseFilesFor` quand la vérification est asynchrone (disque, poignée).
 */
export function dirsToProbe(shape: ProjectShape): string[] {
  const asked: string[] = [...CONVENTION_DIRS];
  withoutDuplicateShared(skeletonTree(shape.architecture, shape.stack), (path) => {
    asked.push(path);
    return false;
  });
  return asked;
}

/** Ce qui dit qu'un projet range son code à la racine, pas sous `src/`. */
const CONVENTION_DIRS = ['src', 'app', 'pages', 'components', 'lib'] as const;

export function baseFilesFor(shape: ProjectShape, options: BaseFilesOptions = {}): SkeletonFile[] {
  const existsDir = options.existsDir ?? (() => false);
  // Même convention que la génération : sans `src/` mais avec `app/`,
  // `components/`… (Next.js), les dossiers vont à la racine.
  const atRoot =
    options.existsDir !== undefined &&
    !existsDir('src') &&
    CONVENTION_DIRS.some((dir) => dir !== 'src' && existsDir(dir));
  const tree = skeletonTree(shape.architecture, shape.stack).map((dir) =>
    atRoot && dir.path.startsWith('src/') ? { ...dir, path: dir.path.slice('src/'.length) } : dir,
  );
  const dirs = withoutDuplicateShared(tree, existsDir);
  return skeletonFiles(shape.name, shape.architecture, dirs, {
    date: options.date ?? localIsoDate(),
  });
}

/** Les dossiers qui contiennent au moins un de ces fichiers (chemins POSIX). */
export function dirsOfPaths(paths: readonly string[]): Set<string> {
  const dirs = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    for (let end = 1; end < segments.length; end += 1) {
      dirs.add(segments.slice(0, end).join('/'));
    }
  }
  return dirs;
}

/** Seulement ce qui manque un fichier présent n'est jamais réécrit. */
export function missingBaseFiles(
  files: readonly SkeletonFile[],
  exists: (path: string) => boolean,
): SkeletonFile[] {
  return files.filter((file) => !exists(file.path));
}

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Fix, ProjectFacts } from '@buildit/doctor';
import type { Manifest } from '@buildit/manifest';
import type { Registry } from '@buildit/registry';

/**
 * Le CLI est le seul endroit qui lit le disque ; le paquet `doctor` ne juge que
 * des faits. Ce module assemble donc les faits et rien de plus : aucune
 * décision, aucun score, aucune règle.
 *
 * Une lecture qui échoue est une absence, jamais une exception : un projet sans
 * `package.json` n'est pas un plantage, c'est un fait à constater.
 *
 * Tous les chemins lus sont **relatifs à la racine du projet** : `FileSource`
 * porte la racine, ce module n'en connaît pas. C'est ce qui rend les tests
 * capables de fabriquer un projet en mémoire, sans toucher au disque.
 */

/** Ce que le Doctor doit lire d'un projet, injectable pour les tests. */
export interface FileSource {
  /** Le chemin absolu d'un fichier du projet, à partir d'un chemin relatif. */
  path(relative: string): string;
  /** Le contenu d'un fichier, ou `undefined` s'il n'existe pas. */
  read(path: string): Promise<string | undefined>;
  /** Le fichier ou dossier est-il là ? */
  exists(path: string): Promise<boolean>;
  /** Les entrées d'un dossier, ou `[]` s'il n'existe pas. */
  list(path: string): Promise<readonly string[]>;
}

/** Le dossier TypeScript et le gestionnaire de paquets, par fichier témoin. */
const LOCKFILES = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'package-lock.json'];
const INSTALL_DIRS = ['node_modules', '.venv', 'vendor'];
const TESTS_DIRS = ['test', 'tests', '__tests__', 'e2e', 'spec'];

/** Les variables d'environnement lues par du code TypeScript ou JavaScript. */
const ENV_READS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
];

/** Les noms de variables cités dans un texte, dédoublonnés et triés. */
export function envNamesIn(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of ENV_READS) {
    for (const match of text.matchAll(pattern)) {
      const [, name] = match;
      if (name === undefined || !isRequiredVariable(name)) {
        continue;
      }
      found.add(name);
    }
  }
  return [...found].sort();
}

/**
 * Ce que le fichier doit déclarer.
 *
 * Sont écartés, avec leur raison pas par confort :
 *
 * - `NODE_ENV`, `CI`, `PATH` et consorts : des variables d'**environnement**, pas
 *   de configuration du projet ; `.env.example` n'est pas leur place ;
 * - tout ce qui porte un préfixe de test (`PF_SMOKE_`, `PF_E2E_`, `PF_PROBE_`) :
 *   ces valeurs se passent en ligne de commande, elles ne se remplissent pas ;
 * - ce qu'un outil pose pour décrire la machine ou le commit (`GIT_AUTHOR_*`,
 *   `GITHUB_SHA`, `npm_config_*`) : ça vient de Git ou de la CI.
 *
 * Le constat porte sur ce que le code **lit** : le Doctor ne devine pas si la
 * variable est exigée au démarrage ou optionnelle, et le fichier proposé le dit.
 */
function isRequiredVariable(name: string): boolean {
  if (RUNTIME_VARIABLES.has(name)) {
    return false;
  }
  if (TEST_PREFIXES.some((prefix) => name.startsWith(prefix))) {
    return false;
  }
  return !TOOLING_VARIABLES.some((pattern) => pattern.test(name));
}

/** Les variables d'environnement de la machine, jamais de la configuration. */
const RUNTIME_VARIABLES: ReadonlySet<string> = new Set([
  'NODE_ENV',
  'CI',
  'PATH',
  'PATHEXT',
  'HOME',
  'USERPROFILE',
  'TMPDIR',
  'TEMP',
  'TMP',
  'SHELL',
  'TERM',
  'PWD',
  'OS',
  'LANG',
  'LC_ALL',
]);

/** Les variables qui se passent à la commande, pas dans un `.env`. */
const TEST_PREFIXES: readonly string[] = ['PF_SMOKE_', 'PF_E2E_', 'PF_PROBE_', 'PF_TEST_'];

/** Ce qu'un outil pose lui-même : ni configuration, ni secret du projet. */
const TOOLING_VARIABLES: readonly RegExp[] = [
  /^GIT_(AUTHOR|COMMITTER)_(NAME|EMAIL)$/,
  /^GITHUB_(ACTOR|REPOSITORY|SHA|REF|WORKFLOW|RUN_ID)$/,
  /^npm_(config|package)_/,
];

/** Les scripts déclarés dans un `package.json`, `[]` s'il est illisible. */
export function scriptsIn(raw: string | undefined): string[] {
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return [];
    }
    const scripts = (parsed as Record<string, unknown>)['scripts'];
    return typeof scripts === 'object' && scripts !== null
      ? Object.keys(scripts as Record<string, unknown>)
      : [];
  } catch {
    return [];
  }
}

/** Les dépendances déclarées d'un `package.json`, production et développement. */
export function dependenciesIn(raw: string | undefined): string[] {
  if (raw === undefined) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return [];
    }
    const record = parsed as Record<string, unknown>;
    const names: string[] = [];
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const group = record[field];
      if (typeof group === 'object' && group !== null) {
        names.push(...Object.keys(group as Record<string, unknown>));
      }
    }
    return [...new Set(names)].sort();
  } catch {
    return [];
  }
}

/** Le nom d'un projet : celui du `package.json`, sinon le dossier. */
export function nameIn(raw: string | undefined, directory: string): string {
  if (raw !== undefined) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const name = (parsed as Record<string, unknown>)['name'];
        if (typeof name === 'string' && name.trim() !== '') {
          return name;
        }
      }
    } catch {
      // Un package.json illisible ne prive pas le rapport de son titre.
    }
  }
  return (
    directory
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() ?? directory
  );
}

/**
 * Les fichiers de code d'un projet, bornés : on n'analyse pas `node_modules`,
 * et on s'arrête bien avant un dépôt entier. Le Doctor lit des témoins, pas un
 * index.
 */
async function sourceFiles(source: FileSource): Promise<string[]> {
  const skip = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    'coverage',
    '.turbo',
    'vendor',
    '.venv',
  ]);
  const files: string[] = [];
  const queue: string[] = [''];
  while (queue.length > 0 && files.length < 400) {
    const relative = queue.shift() ?? '';
    const entries = await source.list(relative === '' ? '.' : relative);
    for (const entry of entries) {
      const path = relative === '' ? entry : `${relative}/${entry}`;
      if (skip.has(entry)) {
        continue;
      }
      if (/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(entry)) {
        files.push(path);
      } else if (!entry.includes('.')) {
        queue.push(path);
      }
    }
  }
  return files;
}

/** Les fichiers qui parlent de la pile, sans être du code. */
const MANIFEST_FILES = ['.buildit/manifest.json', 'pf.manifest.json', 'manifest.json'];
const ENV_EXAMPLE_FILES = ['.env.example', '.env.sample', '.env.template', '.env.dist'];
const DOCKER_FILES = ['Dockerfile', 'docker-compose.yml', 'compose.yaml', 'compose.yml'];

/** Combien de fichiers de code sont lus pour trouver les variables lues. */
const MAX_SCANNED = 120;

export interface FactsInput {
  /** Le manifest, s'il y en a un. */
  readonly manifest?: Manifest | undefined;
  /** Le catalogue chargé : seule source de vérité sur ce qui existe (§11). */
  readonly registry?: Registry | undefined;
  /** Le nom de repli, quand le projet n'a pas de `package.json` : le dossier. */
  readonly name?: string | undefined;
}

/** Assemble les faits du Doctor. Aucune règle, aucune décision. */
export async function readFacts(source: FileSource, input: FactsInput = {}): Promise<ProjectFacts> {
  const { manifest, registry } = input;
  const packageJson = await source.read('package.json');
  const dependencies = dependenciesIn(packageJson);
  const scripts = scriptsIn(packageJson);

  const find = async (names: readonly string[]): Promise<boolean> => {
    for (const name of names) {
      if (await source.exists(name)) {
        return true;
      }
    }
    return false;
  };

  const typescript = (await source.exists('tsconfig.json')) || dependencies.includes('typescript');
  const declaredTests = await find(TESTS_DIRS);

  // Les variables lues : bornées, et jamais celles qui décrivent la machine.
  const files = (await sourceFiles(source)).slice(0, MAX_SCANNED);
  const envUsed = new Set<string>();
  for (const file of files) {
    const text = await source.read(file);
    if (text === undefined) {
      continue;
    }
    for (const name of envNamesIn(text)) {
      envUsed.add(name);
    }
  }

  // La pile : le manifest d'abord, sinon les dépendances déclarées.
  const technologies = [...(manifest === undefined ? [] : selectionOf(manifest)), ...dependencies];
  const catalogueIds =
    registry === undefined
      ? []
      : [...new Set(technologies)].filter((id) => registry.get(id) !== undefined);
  const expectedPackages =
    registry === undefined
      ? []
      : catalogueIds.map((id) => {
          const entry = registry.get(id);
          return {
            id,
            packages: [...(entry?.packages ?? []), ...(entry?.devPackages ?? [])],
          };
        });

  return {
    name: nameIn(packageJson, input.name ?? 'projet'),
    dependencies,
    scripts,
    typescript,
    packageManager: (await find(LOCKFILES)) || (packageJson?.includes('"packageManager"') ?? false),
    installed: await find(INSTALL_DIRS),
    gitignore: await source.exists('.gitignore'),
    docker: await find(DOCKER_FILES),
    dockerignore: await source.exists('.dockerignore'),
    tests: declaredTests || scripts.includes('test'),
    ci: await source.exists('.github/workflows'),
    envExample: await find(ENV_EXAMPLE_FILES),
    envUsed: [...envUsed].sort(),
    readme: await find(['README.md', 'readme.md', 'README']),
    technologies,
    expectedPackages,
    catalogueIds,
  };
}

/** Les identifiants d'un manifest, dans l'ordre où le manifest les déclare. */
function selectionOf(manifest: Manifest): string[] {
  const ids: string[] = [];
  const add = (value: string | undefined): void => {
    if (value !== undefined) {
      ids.push(value);
    }
  };
  for (const app of [manifest.frontend, manifest.mobile, manifest.desktop, manifest.backend]) {
    for (const value of Object.values(app ?? {})) {
      add(value);
    }
  }
  add(manifest.database?.engine);
  add(manifest.database?.orm);
  add(manifest.auth?.provider);
  ids.push(...(manifest.services ?? []), ...(manifest.quality ?? []), ...(manifest.infra ?? []));
  return [...new Set(ids)];
}

/** Le manifest du projet, s'il y en a un. */
export async function findManifestFile(source: FileSource): Promise<string | undefined> {
  for (const name of MANIFEST_FILES) {
    if (await source.exists(name)) {
      return name;
    }
  }
  return undefined;
}

/**
 * Applique un plan de correction. `create` n'écrase **jamais** : un fichier
 * apparu entre l'affichage et l'application est laissé intact. `merge-json`
 * n'ajoute que des clés absentes, à la racine un `scripts.test` déjà écrit
 * reste celui de l'auteur.
 *
 * Rend les chemins effectivement écrits : un plan qui n'écrit rien est un plan
 * qui a menti, et le rapport doit le dire.
 */
export async function applyFixes(
  fixes: readonly Fix[],
  source: FileSource,
): Promise<readonly string[]> {
  const written: string[] = [];
  for (const fix of fixes) {
    const path = source.path(fix.path);
    if (fix.action === 'create') {
      if (await source.exists(fix.path)) {
        continue;
      }
      // Un chemin peut avoir des dossiers à créer (`.github/workflows/ci.yml`) :
      // le plan annoncé doit être applicable tel quel, sans étape manuelle.
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, fix.content, 'utf8');
      written.push(fix.path);
      continue;
    }
    const current = await source.read(fix.path);
    if (current === undefined) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(current);
    } catch {
      // Un JSON illisible n'est pas un JSON à réécrire : on le laisse tel quel.
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      continue;
    }
    const patch: unknown = JSON.parse(fix.content);
    const merged: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
    for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof merged[key] === 'object' &&
        merged[key] !== null
      ) {
        const current = merged[key] as Record<string, unknown>;
        const group: Record<string, unknown> = { ...current };
        for (const [name, entry] of Object.entries(value as Record<string, unknown>)) {
          // La clé déjà écrite par l'auteur gagne : `--fix` complète, il ne
          // remplace pas un `scripts.test` existant par un autre.
          if (current[name] === undefined) {
            group[name] = entry;
          }
        }
        merged[key] = group;
      } else if (merged[key] === undefined) {
        merged[key] = value;
      }
    }
    await writeFile(path, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
    written.push(fix.path);
  }
  return written;
}

/**
 * Les fichiers du projet, tels que `pf doctor` les lit par défaut. Le préfixe
 * `root` est ce qui permet au reste du module de ne parler que de chemins
 * relatifs.
 */
export function fileSourceAt(root: string): FileSource {
  return {
    path: (relative) => join(root, relative),
    async read(path) {
      try {
        return await readFile(join(root, path), 'utf8');
      } catch {
        return undefined;
      }
    },
    async exists(path) {
      try {
        await stat(join(root, path));
        return true;
      } catch {
        return false;
      }
    },
    async list(path) {
      try {
        return await readdir(join(root, path));
      } catch {
        return [];
      }
    },
  };
}

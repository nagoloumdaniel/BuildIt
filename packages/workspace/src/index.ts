import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { type CommandRunner, isTransientFailure, outputTail } from '@buildit/exec';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@buildit/validation';

/**
 * Un projet déjà sur la machine (§18bis) : de quoi il est fait, avec quoi on
 * l'installe, et **d'où on le sait**.
 *
 * Ni analyse, ni Doctor : on lit les fichiers qui nomment l'outillage, rien
 * de plus. Une supposition est dite comme telle.
 */

export const ECOSYSTEMS = ['node', 'python', 'rust', 'go', 'php', 'ruby'] as const;
export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const PACKAGE_MANAGERS = ['pnpm', 'yarn', 'bun', 'npm'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export interface Command {
  readonly command: string;
  readonly args: readonly string[];
}

export interface Detection {
  readonly ecosystem: Ecosystem;
  /** Nom lisible de l'écosystème. */
  readonly label: string;
  /** Écosystème JavaScript seulement : l'installation est automatisable. */
  readonly packageManager?: PackageManager;
  /** Version déclarée dans `packageManager`, quand il y en a une. */
  readonly packageManagerVersion?: string;
  /** Comment on le sait. `assumed` : on ne le sait pas, on suppose npm. */
  readonly source: 'lockfile' | 'packageManager' | 'assumed' | 'manifest';
  /** Le fichier qui l'a dit. */
  readonly evidence: string;
  /** Hors JavaScript : la commande à lancer soi-même (V1 pour l'automatiser). */
  readonly manualCommand?: string;
  readonly warnings: readonly string[];
}

export const WORKSPACE_CODES = [
  'WORKSPACE_NOT_FOUND',
  'WORKSPACE_NOT_A_DIRECTORY',
  'WORKSPACE_UNKNOWN',
  'WORKSPACE_NOT_AUTOMATED',
  'WORKSPACE_INSTALL_FAILED',
  'WORKSPACE_COMMAND_UNAVAILABLE',
] as const;

export type WorkspaceCode = (typeof WORKSPACE_CODES)[number];
export type WorkspaceIssue = Issue<WorkspaceCode>;

const MESSAGES: Readonly<Record<WorkspaceCode, string>> = {
  WORKSPACE_NOT_FOUND: 'Le dossier {value} n’existe pas.',
  WORKSPACE_NOT_A_DIRECTORY: '{value} n’est pas un dossier.',
  WORKSPACE_UNKNOWN:
    'Aucun projet reconnu dans {value} : ni package.json, ni pyproject.toml, Cargo.toml, go.mod, composer.json ou Gemfile.',
  WORKSPACE_NOT_AUTOMATED:
    'L’installation automatique d’un projet {value} arrive en V1. Lancez vous-même : {command}',
  WORKSPACE_INSTALL_FAILED: '« {command} » a échoué. Fin de la sortie :\n{output}',
  WORKSPACE_COMMAND_UNAVAILABLE: 'La commande « {command} » est introuvable sur cette machine.',
};

const messageFor = createMessageFormatter(MESSAGES);

function issue(
  code: WorkspaceCode,
  params: Readonly<Record<string, string>>,
  hint?: string,
): WorkspaceIssue {
  const base = { code, path: [], message: messageFor(code, params) };
  return hint === undefined ? base : { ...base, hint };
}

/**
 * Ce que la détection a besoin de savoir d'un dossier.
 *
 * Volontairement minuscule : les **noms** des fichiers de premier niveau, et le
 * texte de `package.json` quand il y en a un. C'est tout ce que la règle lit —
 * un verrou se reconnaît à son nom, un manifeste aussi. Le reste du dossier ne
 * la concerne pas.
 *
 * Pourquoi un port plutôt qu'un chemin : la même règle doit valoir pour un
 * dossier du disque (`pf web` en local, le CLI) **et** pour un dossier que le
 * visiteur a désigné dans son navigateur, dont le serveur ne verra jamais le
 * chemin seulement ces quelques noms. Deux détections auraient divergé au
 * premier verrou ajouté.
 */
export interface ProjectEntries {
  /** Les noms des fichiers de premier niveau, sans chemin. */
  readonly names: readonly string[];
  /** Le texte de `package.json`, s'il y en a un et qu'il est lisible. */
  readonly packageJson?: string;
}

/** Verrous, par ordre de priorité quand plusieurs coexistent. */
const LOCKFILES: readonly (readonly [string, PackageManager])[] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
];

function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

/** `"pnpm@9.1.0+sha512…"` → `['pnpm', '9.1.0']`. */
function parsePackageManagerField(value: unknown): [PackageManager, string] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const match = /^([a-z]+)@(\d[^+\s]*)/.exec(value);
  if (match === null) {
    return undefined;
  }
  const [, name = '', version = ''] = match;
  return isPackageManager(name) ? [name, version] : undefined;
}

function detectNode(entries: ProjectEntries): Detection {
  const warnings: string[] = [];
  const present = new Set(entries.names);
  let declared: [PackageManager, string] | undefined;
  try {
    const pkg: unknown = JSON.parse(entries.packageJson ?? '');
    declared =
      typeof pkg === 'object' && pkg !== null
        ? parsePackageManagerField((pkg as Record<string, unknown>)['packageManager'])
        : undefined;
  } catch {
    warnings.push('package.json est illisible : le champ packageManager est ignoré.');
  }

  const found = LOCKFILES.filter(([file]) => present.has(file));

  const base = { ecosystem: 'node', label: 'JavaScript / TypeScript' } as const;
  const version = declared === undefined ? {} : { packageManagerVersion: declared[1] };
  const [first] = found;
  if (first !== undefined) {
    const managers = new Set(found.map(([, manager]) => manager));
    if (managers.size > 1) {
      warnings.push(
        `Plusieurs verrous : ${found.map(([file]) => file).join(', ')}. On suit ${first[0]}.`,
      );
    }
    if (declared !== undefined && declared[0] !== first[1]) {
      warnings.push(
        `packageManager annonce ${declared[0]}, mais le verrou est celui de ${first[1]} : on suit le verrou.`,
      );
    }
    return {
      ...base,
      packageManager: first[1],
      ...(declared?.[0] === first[1] ? version : {}),
      source: 'lockfile',
      evidence: first[0],
      warnings,
    };
  }
  if (declared !== undefined) {
    return {
      ...base,
      packageManager: declared[0],
      ...version,
      source: 'packageManager',
      evidence: 'package.json',
      warnings,
    };
  }
  warnings.push('Ni verrou ni champ packageManager : npm est une supposition.');
  return { ...base, packageManager: 'npm', source: 'assumed', evidence: 'package.json', warnings };
}

/** Les autres écosystèmes : reconnus, nommés, installés à la main (V1). */
const OTHERS: readonly {
  readonly file: string;
  readonly ecosystem: Ecosystem;
  readonly label: string;
  readonly command: (present: ReadonlySet<string>) => string;
}[] = [
  {
    file: 'pyproject.toml',
    ecosystem: 'python',
    label: 'Python',
    command: (present) => {
      if (present.has('uv.lock')) {
        return 'uv sync';
      }
      if (present.has('poetry.lock')) {
        return 'poetry install';
      }
      return 'pip install .';
    },
  },
  {
    file: 'requirements.txt',
    ecosystem: 'python',
    label: 'Python',
    command: () => 'pip install -r requirements.txt',
  },
  { file: 'Cargo.toml', ecosystem: 'rust', label: 'Rust', command: () => 'cargo fetch' },
  { file: 'go.mod', ecosystem: 'go', label: 'Go', command: () => 'go mod download' },
  { file: 'composer.json', ecosystem: 'php', label: 'PHP', command: () => 'composer install' },
  { file: 'Gemfile', ecosystem: 'ruby', label: 'Ruby', command: () => 'bundle install' },
];

/**
 * Reconnaît un projet à partir de ses entrées. JavaScript d'abord : c'est le
 * seul écosystème installé automatiquement.
 *
 * `label` ne sert qu'aux messages de refus c'est le dossier tel que
 * l'utilisateur l'a désigné : un chemin absolu en local, un simple nom de
 * dossier quand il vient du navigateur.
 */
export function detectFromEntries(
  entries: ProjectEntries,
  label: string,
): ParseResult<Detection, WorkspaceCode> {
  const present = new Set(entries.names);
  if (present.has('package.json')) {
    return ok(detectNode(entries));
  }
  for (const other of OTHERS) {
    if (present.has(other.file)) {
      return ok({
        ecosystem: other.ecosystem,
        label: other.label,
        source: 'manifest',
        evidence: other.file,
        manualCommand: other.command(present),
        warnings: [],
      });
    }
  }
  return fail([
    issue(
      'WORKSPACE_UNKNOWN',
      { value: label },
      'Vérifiez le dossier ; pour un nouveau projet : pf create.',
    ),
  ]);
}

/** Les entrées d'un dossier du disque le port de `detectFromEntries`, côté Node. */
async function entriesOf(dir: string): Promise<ProjectEntries> {
  let names: string[];
  try {
    const found = await readdir(dir, { withFileTypes: true });
    names = found.filter((entry) => !entry.isDirectory()).map((entry) => entry.name);
  } catch {
    // Dossier illisible (droits) : aucune entrée, donc aucun manifeste reconnu.
    return { names: [] };
  }
  if (!names.includes('package.json')) {
    return { names };
  }
  try {
    return { names, packageJson: await readFile(join(dir, 'package.json'), 'utf8') };
  } catch {
    return { names };
  }
}

/** Reconnaît le projet de `dir`, sur le disque de cette machine. */
export async function detectProject(dir: string): Promise<ParseResult<Detection, WorkspaceCode>> {
  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(dir);
  } catch {
    return fail([issue('WORKSPACE_NOT_FOUND', { value: dir })]);
  }
  if (!info.isDirectory()) {
    return fail([issue('WORKSPACE_NOT_A_DIRECTORY', { value: dir })]);
  }
  return detectFromEntries(await entriesOf(dir), dir);
}

export interface InstallOptions {
  /**
   * N'exécute aucun script d'installation des dépendances. À proposer pour du
   * code qu'on n'a pas écrit : un `postinstall` s'exécute sur la machine.
   */
  readonly ignoreScripts?: boolean;
}

/** Yarn ≥ 2 a remplacé `--ignore-scripts` par `--mode=skip-build`. */
function isModernYarn(detection: Detection): boolean {
  const major = Number.parseInt(detection.packageManagerVersion ?? '1', 10);
  return major >= 2;
}

/**
 * La commande d'installation, exacte à afficher **avant** de la lancer.
 * `undefined` hors JavaScript : l'installation n'y est pas encore automatisée.
 */
export function installCommand(
  detection: Detection,
  options: InstallOptions = {},
): Command | undefined {
  const manager = detection.packageManager;
  if (manager === undefined) {
    return undefined;
  }
  const args = ['install'];
  if (options.ignoreScripts === true) {
    args.push(
      manager === 'yarn' && isModernYarn(detection) ? '--mode=skip-build' : '--ignore-scripts',
    );
  }
  return { command: manager, args };
}

/** `pnpm install --ignore-scripts` tel que l'utilisateur le taperait. */
export function formatCommand(command: Command): string {
  return [command.command, ...command.args].join(' ');
}

export interface InstallFailure {
  readonly issues: readonly WorkspaceIssue[];
  /** Panne réseau : relancer a un sens. */
  readonly retryable: boolean;
}

/** Lance l'installation. À n'appeler qu'après confirmation de l'utilisateur. */
export async function install(
  detection: Detection,
  dir: string,
  runner: CommandRunner,
  options: InstallOptions = {},
): Promise<InstallFailure | undefined> {
  const command = installCommand(detection, options);
  if (command === undefined) {
    return {
      issues: [
        issue('WORKSPACE_NOT_AUTOMATED', {
          value: detection.label,
          command: detection.manualCommand ?? '',
        }),
      ],
      retryable: false,
    };
  }
  const shown = formatCommand(command);
  let result: Awaited<ReturnType<CommandRunner['run']>>;
  try {
    result = await runner.run(command.command, command.args, dir);
  } catch {
    return {
      issues: [
        issue(
          'WORKSPACE_COMMAND_UNAVAILABLE',
          { command: command.command },
          command.command === 'npm'
            ? 'Installez Node.js (npm est livré avec).'
            : `Activez-le avec Corepack : corepack enable ${command.command}`,
        ),
      ],
      retryable: false,
    };
  }
  if (result.exitCode === 0) {
    return undefined;
  }
  return {
    issues: [
      issue('WORKSPACE_INSTALL_FAILED', { command: shown, output: outputTail(result.output) }),
    ],
    retryable: isTransientFailure(result.output),
  };
}

import type { Manifest } from '@project-factory/manifest';
import type { Recipe } from '@project-factory/recipes';
import type { RegistryEntry } from '@project-factory/registry';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';
import { buildInfrastructure } from './infrastructure.js';
import { envDeclaration } from './integrations.data.js';
import { BRIDGES, ROLE_BY_CATEGORY, ROLE_BY_ID, type Role } from './monorepo.data.js';
import type { PlannedFile } from './plan.js';
import { buildScaffold, collectBuildPolicy, envExample, pnpmWorkspace } from './scaffold.js';

/**
 * Monorepo multi-applications (spec 2026-09-28).
 *
 * Aucun second générateur : la stack est répartie entre les applications, et
 * chacune est générée par le chemin des applications seules — celui que le
 * test de fumée certifie —, puis placée sous `apps/<nom>/`. La racine reçoit
 * ce qui appartient au dépôt entier.
 */

export const MONOREPO_ISSUE_CODES = [
  'GEN_MONOREPO_NO_APP',
  'GEN_RECIPE_ACROSS_APPS',
  'GEN_DOCKERFILE_MONOREPO_DEFERRED',
] as const;

export type MonorepoIssueCode = (typeof MONOREPO_ISSUE_CODES)[number];

const MESSAGES: Readonly<Record<MonorepoIssueCode, string>> = {
  GEN_MONOREPO_NO_APP:
    'Le monorepo ne contient aucune application : choisissez au moins un framework web ou un backend.',
  GEN_RECIPE_ACROSS_APPS:
    'La recette « {value} » exige des technologies réparties entre plusieurs applications ({expected}). Elle doit tenir dans une seule.',
  GEN_DOCKERFILE_MONOREPO_DEFERRED:
    'Docker est choisi : docker-compose.yml est généré pour les services locaux, mais pas de Dockerfile par application — en monorepo, il exige un élagage du dépôt (turbo prune) que le générateur ne fait pas encore. Mieux vaut aucun Dockerfile qu’un Dockerfile qui échoue.',
};

const messageFor = createMessageFormatter(MESSAGES);

export type AppName = 'web' | 'api';

const APP_ORDER: readonly AppName[] = ['web', 'api'];

/** Fichiers qu'une application seule produit mais que la racine porte, une fois. */
const ROOT_ONLY = new Set([
  '.gitignore',
  'README.md',
  'pnpm-workspace.yaml',
  'turbo.json',
  'biome.json',
  'docker-compose.yml',
  'Dockerfile',
  '.dockerignore',
  '.github/workflows/ci.yml',
  '.devcontainer/devcontainer.json',
]);

/** Fichiers d'application que la racine n'a pas à porter : elle n'a pas de code. */
const APP_ONLY = new Set(['.env.example', 'env.d.ts', 'tsconfig.json']);

/** Ce que génère une application seule — fourni par le pipeline. */
export interface GeneratedFiles {
  readonly files: readonly PlannedFile[];
  readonly warnings: readonly Issue<string>[];
}

export type GenerateApp = (
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  recipes: readonly Recipe[],
) => ParseResult<GeneratedFiles, string>;

/** Charge un dossier de templates, chemins relatifs à la racine du dépôt. */
export type LoadTemplates = (template: string) => ParseResult<PlannedFile[], string>;

/** Réécrit un package.json planifié en y ajoutant une dépendance de workspace. */
function withWorkspaceDependency(file: PlannedFile, name: string): PlannedFile {
  const json = JSON.parse(file.contents) as { dependencies?: Record<string, string> };
  const dependencies = Object.fromEntries(
    Object.entries({ ...json.dependencies, [name]: 'workspace:*' }).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );
  return { ...file, contents: `${JSON.stringify({ ...json, dependencies }, null, 2)}\n` };
}

/** Ajoute des variables à .env.example et env.d.ts d'une application, triées, sans doublon. */
function withEnv(
  files: readonly PlannedFile[],
  prefix: string,
  added: readonly string[],
): PlannedFile[] {
  const example = files.find((file) => file.path === `${prefix}.env.example`);
  const names = new Set(added);
  for (const line of example?.contents.split('\n') ?? []) {
    const match = /^([A-Z][A-Z0-9_]*)=$/.exec(line);
    if (match?.[1] !== undefined) {
      names.add(match[1]);
    }
  }
  const sorted = [...names].sort();
  return files.map((file) => {
    if (file.path === `${prefix}.env.example`) {
      return { ...file, contents: envExample(sorted) };
    }
    if (file.path === `${prefix}env.d.ts`) {
      return { ...file, contents: envDeclaration({ env: sorted }) };
    }
    return file;
  });
}

function roleOf(entry: RegistryEntry): Role {
  return ROLE_BY_ID[entry.id] ?? ROLE_BY_CATEGORY[entry.category];
}

interface Partition {
  readonly apps: ReadonlyMap<AppName, RegistryEntry[]>;
  readonly root: RegistryEntry[];
}

/** Répartit la stack : chaque fiche va à son rôle, `both` partout, `data` au web d'abord. */
export function partition(entries: readonly RegistryEntry[]): Partition {
  const byRole = new Map<Role, RegistryEntry[]>();
  for (const entry of entries) {
    const role = roleOf(entry);
    byRole.set(role, [...(byRole.get(role) ?? []), entry]);
  }

  const present = APP_ORDER.filter((app) => (byRole.get(app)?.length ?? 0) > 0);
  const dataHome: AppName | undefined = present.includes('web') ? 'web' : present[0];

  const apps = new Map<AppName, RegistryEntry[]>();
  for (const app of present) {
    apps.set(app, [
      ...(byRole.get(app) ?? []),
      ...(app === dataHome ? (byRole.get('data') ?? []) : []),
      ...(byRole.get('both') ?? []),
    ]);
  }
  return { apps, root: byRole.get('root') ?? [] };
}

/** La recette va à l'application qui porte sa technologie ; tout ce qu'elle exige doit y être. */
function placeRecipes(
  recipes: readonly Recipe[],
  apps: ReadonlyMap<AppName, RegistryEntry[]>,
): ParseResult<Map<AppName, Recipe[]>, MonorepoIssueCode> {
  const placed = new Map<AppName, Recipe[]>();
  const issues: Issue<MonorepoIssueCode>[] = [];
  for (const recipe of recipes) {
    const home = [...apps].find(([, entries]) =>
      entries.some((entry) => recipe.for.includes(entry.id)),
    );
    const ids = new Set(home?.[1].map((entry) => entry.id));
    if (home === undefined || !(recipe.requires ?? []).every((id) => ids.has(id))) {
      issues.push({
        code: 'GEN_RECIPE_ACROSS_APPS',
        path: ['recipes', recipe.id],
        message: messageFor('GEN_RECIPE_ACROSS_APPS', {
          value: recipe.id,
          expected: [...recipe.for, ...(recipe.requires ?? [])].join(', '),
        }),
      });
      continue;
    }
    placed.set(home[0], [...(placed.get(home[0]) ?? []), recipe]);
  }
  return issues.length > 0 ? fail(issues) : ok(placed);
}

/**
 * Scripts de la racine : les tâches des applications passent par Turborepo
 * s'il est choisi, sinon par pnpm en récursif.
 */
function rootScripts(
  existing: Readonly<Record<string, string>>,
  turbo: boolean,
): Record<string, string> {
  const delegate = (task: string) =>
    turbo ? `turbo run ${task}` : `pnpm --recursive --if-present run ${task}`;
  const scripts: Record<string, string> = {
    ...existing,
    build: delegate('build'),
    dev: delegate('dev'),
    test: delegate('test'),
    typecheck: delegate('typecheck'),
  };
  return Object.fromEntries(Object.entries(scripts).sort(([a], [b]) => a.localeCompare(b)));
}

function applicationsSection(apps: ReadonlyMap<AppName, RegistryEntry[]>, shared: boolean): string {
  const lines = ['## Applications', ''];
  for (const [app, entries] of apps) {
    lines.push(`- \`apps/${app}\` — ${entries.map((entry) => entry.name).join(', ')}`);
  }
  if (shared) {
    lines.push(
      '- `packages/shared` — le contrat entre le web et l’API : schémas Zod et client typé. L’API le respecte (test de contrat), le web le valide à la réception ; `/status` montre la liaison.',
    );
  }
  return `${lines.join('\n')}\n`;
}

export function planMonorepo(
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  recipes: readonly Recipe[],
  generateApp: GenerateApp,
  loadTemplates: LoadTemplates,
): ParseResult<GeneratedFiles, string> {
  const { apps, root } = partition(entries);
  if (apps.size === 0) {
    return fail([
      {
        code: 'GEN_MONOREPO_NO_APP',
        path: ['architecture'],
        message: messageFor('GEN_MONOREPO_NO_APP', {}),
      },
    ]);
  }

  const placed = placeRecipes(recipes, apps);
  if (!placed.ok) {
    return placed;
  }

  const files: PlannedFile[] = [];
  const warnings: Issue<string>[] = [];

  for (const [app, appEntries] of apps) {
    const generated = generateApp(
      {
        ...manifest,
        name: `${manifest.name}-${app}`,
        architecture: 'single-app',
        targets: [app],
      },
      appEntries,
      placed.value.get(app) ?? [],
    );
    if (!generated.ok) {
      return generated;
    }
    files.push(
      ...generated.value.files
        .filter((file) => !ROOT_ONLY.has(file.path))
        .map((file) => ({ ...file, path: `apps/${app}/${file.path}` })),
    );
    warnings.push(
      ...generated.value.warnings.filter((warning) => warning.code !== 'GEN_DOCKERFILE_DEFERRED'),
    );
  }

  // Les ponts entre applications : contrat partagé, client, test de contrat.
  // Chaque application dépend alors du paquet partagé.
  const ids = (app: AppName) => new Set((apps.get(app) ?? []).map((entry) => entry.id));
  const bridges = BRIDGES.filter(
    (bridge) => ids('web').has(bridge.web) && ids('api').has(bridge.api),
  );
  for (const bridge of bridges) {
    const loaded = loadTemplates(bridge.template);
    if (!loaded.ok) {
      return loaded;
    }
    const shared = `${manifest.name}-shared`;
    const linked = [...files, ...loaded.value].map((file) =>
      file.path === 'apps/web/package.json' || file.path === 'apps/api/package.json'
        ? withWorkspaceDependency(file, shared)
        : file,
    );
    files.splice(0, files.length, ...withEnv(linked, 'apps/web/', bridge.webEnv));
  }

  // La racine : le socle de ses propres fiches (Biome, Turborepo…), puis ce
  // qui doit réunir toutes les applications — scripts, scripts d'installation,
  // services locaux, CI.
  const scaffold = buildScaffold(manifest, root);
  if (!scaffold.ok) {
    return fail(scaffold.issues);
  }

  const turbo = root.some((entry) => entry.id === 'turborepo');
  let scripts: Record<string, string> = {};
  for (const file of scaffold.value.files) {
    if (
      APP_ONLY.has(file.path) ||
      ['docker-compose.yml', 'Dockerfile', '.dockerignore'].includes(file.path) ||
      file.path.startsWith('.github/') ||
      file.path.startsWith('.devcontainer/')
    ) {
      continue;
    }
    if (file.path === 'package.json') {
      const json = JSON.parse(file.contents) as { scripts: Record<string, string> };
      scripts = rootScripts(json.scripts, turbo);
      files.push({ ...file, contents: `${JSON.stringify({ ...json, scripts }, null, 2)}\n` });
    } else if (file.path === 'pnpm-workspace.yaml') {
      files.push({
        ...file,
        contents: pnpmWorkspace(true, collectBuildPolicy(entries)) ?? file.contents,
      });
    } else if (file.path === 'README.md') {
      files.push({
        ...file,
        contents: `${file.contents.trimEnd()}\n\n${applicationsSection(apps, bridges.length > 0)}`,
      });
    } else {
      files.push(file);
    }
  }

  files.push(
    ...buildInfrastructure(entries, scripts, { projectName: manifest.name, workspaceFile: true }),
  );

  warnings.push(
    ...scaffold.value.warnings.filter((warning) => warning.code !== 'GEN_DOCKERFILE_DEFERRED'),
  );
  if (entries.some((entry) => entry.id === 'docker')) {
    warnings.push({
      code: 'GEN_DOCKERFILE_MONOREPO_DEFERRED',
      path: ['docker'],
      message: messageFor('GEN_DOCKERFILE_MONOREPO_DEFERRED', {}),
    });
  }

  return ok({ files, warnings });
}

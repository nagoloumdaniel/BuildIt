import { type Manifest, PROJECT_NAME_PATTERN } from '@project-factory/manifest';
import type { Recipe } from '@project-factory/recipes';
import type { RegistryEntry } from '@project-factory/registry';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';
import { type DependencySource, resolveDependencies } from './dependencies.js';
import { buildInfrastructure, canRunInContainer } from './infrastructure.js';
import { INTEGRATIONS, type Integration } from './integrations.data.js';
import type { PlannedFile } from './plan.js';
import { recipeAsDependencySource } from './recipes.js';

/**
 * Le socle d'un projet généré (§13).
 *
 * Assemble en fichiers ce que les étages précédents ont résolu : les
 * dépendances deviennent un `package.json`, les variables déclarées par les
 * fiches deviennent un `.env.example`, la stack devient un `README.md`.
 *
 * Aucun nom de technologie n'est câblé ici. Ce que Vitest ou Biome apportent au
 * projet vient de `integrations.data.ts` ; le socle ne fait que l'assembler.
 */

/** Problèmes que le socle détecte lui-même. */
const OWN_CODES = [
  'GEN_SCRIPT_CONFLICT',
  'GEN_SECRET_IN_ENV',
  'GEN_DOCKERFILE_DEFERRED',
  'GEN_INVALID_PROJECT_NAME',
] as const;

/**
 * Problèmes que le socle **transmet** sans les reformuler.
 *
 * Ils appartiennent au résolveur de dépendances, qui les rédige mieux que le
 * socle ne le ferait : c'est lui qui connaît les plages en cause. Ils n'ont
 * donc pas d'entrée dans le catalogue ci-dessous — une entrée existerait sans
 * jamais servir, et produirait un message dégradé le jour où quelqu'un
 * l'appellerait par erreur.
 */
const FORWARDED_CODES = ['GEN_DEPENDENCY_CONFLICT', 'GEN_PACKAGE_ROLE_CONFLICT'] as const;

export const SCAFFOLD_ISSUE_CODES: readonly string[] = [...OWN_CODES, ...FORWARDED_CODES];

export type ScaffoldIssueCode = (typeof OWN_CODES)[number] | (typeof FORWARDED_CODES)[number];
export type ScaffoldIssue = Issue<ScaffoldIssueCode>;

const MESSAGES: Readonly<Record<(typeof OWN_CODES)[number], string>> = {
  GEN_SCRIPT_CONFLICT:
    'Le script « {script} » est réclamé par {first} et par {second}. Un package.json ne peut en garder qu’un.',
  GEN_DOCKERFILE_DEFERRED:
    'Docker est choisi, mais le projet n’a pas encore d’application à construire et démarrer (scripts build et start). Aucun Dockerfile n’est posé : il échouerait dès « docker build ». Il le sera quand un template certifié fournira l’application.',
  GEN_INVALID_PROJECT_NAME:
    'Le nom de projet {value} n’est pas un nom de paquet valide (minuscules, chiffres, « . », « _ », « - »). Le manifest n’a pas été validé avant la génération.',
  GEN_SECRET_IN_ENV:
    '{first} déclare « {value} » comme variable d’environnement. Ce n’est pas un nom de variable — une valeur ne doit jamais entrer dans un fichier généré.',
};

const messageFor = createMessageFormatter(MESSAGES);

/** Plancher Node et gestionnaire de paquets du projet généré. */
export const NODE_RANGE: string = '>=20.11.0';
export const PACKAGE_MANAGER: string = 'pnpm@11.13.1';

/** Nom de variable d'environnement acceptable : majuscules, chiffres, tirets bas. */
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

/**
 * Intégrations qui s'appliquent à une fiche **dans cette stack** : celles de
 * la fiche seule, plus celles dont la fiche compagne (`when`) est choisie.
 */
function integrationsFor(entry: RegistryEntry, stack: ReadonlySet<string>): Integration[] {
  return INTEGRATIONS.filter(
    (integration) =>
      integration.id === entry.id &&
      (integration.when === undefined || stack.has(integration.when)),
  );
}

function stackOf(entries: readonly RegistryEntry[]): Set<string> {
  return new Set(entries.map((entry) => entry.id));
}

/** Nom d'une intégration dans les messages et la provenance des fichiers. */
function labelOf(integration: Integration): string {
  return integration.when === undefined ? integration.id : `${integration.id}+${integration.when}`;
}

/**
 * Scripts qu'une technologie apporte à ce projet-ci.
 *
 * Les scripts d'application ne comptent que si la fiche est certifiée : c'est
 * le seul cas où un template pose le code sur lequel ils opèrent.
 */
function scriptsOf(entry: RegistryEntry, stack: ReadonlySet<string>): Record<string, string> {
  const scripts: Record<string, string> = {};
  for (const integration of integrationsFor(entry, stack)) {
    Object.assign(
      scripts,
      integration.scripts,
      entry.generation === 'certified' ? integration.appScripts : {},
    );
  }
  return scripts;
}

/** Fichiers de configuration exigés par les outils de la stack. */
function integrationFiles(
  entries: readonly RegistryEntry[],
  env: readonly string[],
): PlannedFile[] {
  const stack = stackOf(entries);
  return entries.flatMap((entry) =>
    integrationsFor(entry, stack).flatMap((integration) =>
      (integration.files ?? []).map((file) => ({
        path: file.path,
        contents: typeof file.contents === 'string' ? file.contents : file.contents({ env }),
        source: `integration:${labelOf(integration)}`,
      })),
    ),
  );
}

/**
 * Paquets apportés par les intégrations, vus comme des sources de dépendances :
 * leurs plages rencontrent celles des fiches et des recettes dans le même
 * résolveur, avec les mêmes messages de conflit.
 */
function integrationDependencySources(entries: readonly RegistryEntry[]): DependencySource[] {
  const stack = stackOf(entries);
  return entries.flatMap((entry) =>
    integrationsFor(entry, stack)
      .filter(
        (integration) =>
          integration.dependencies !== undefined || integration.devDependencies !== undefined,
      )
      .map((integration) => ({
        id: `integration:${labelOf(integration)}`,
        name: `Intégration ${labelOf(integration)}`,
        packages: Object.keys(integration.dependencies ?? {}),
        devPackages: Object.keys(integration.devDependencies ?? {}),
        packageRanges: { ...integration.dependencies, ...integration.devDependencies },
      })),
  );
}

function collectScripts(entries: readonly RegistryEntry[]): {
  scripts: Record<string, string>;
  issues: ScaffoldIssue[];
} {
  const scripts: Record<string, string> = {};
  const owners = new Map<string, RegistryEntry>();
  const issues: ScaffoldIssue[] = [];
  const stack = stackOf(entries);

  for (const entry of entries) {
    for (const [name, command] of Object.entries(scriptsOf(entry, stack))) {
      const owner = owners.get(name);
      if (owner !== undefined) {
        // Deux outils qui veulent le même script : le générateur ne peut pas
        // choisir à la place de l'utilisateur sans se tromper une fois sur deux.
        issues.push({
          code: 'GEN_SCRIPT_CONFLICT',
          path: [name],
          message: messageFor('GEN_SCRIPT_CONFLICT', {
            script: name,
            first: owner.id,
            second: entry.id,
          }),
        });
        continue;
      }
      owners.set(name, entry);
      scripts[name] = command;
    }
  }

  return { scripts: sortedRecord(scripts), issues };
}

/** Ce qui déclare des variables d'environnement : une fiche ou une recette. */
interface EnvSource {
  readonly id: string;
  readonly name: string;
  readonly env?: readonly string[] | undefined;
}

function collectEnv(entries: readonly EnvSource[]): {
  names: string[];
  issues: ScaffoldIssue[];
} {
  const names = new Set<string>();
  const issues: ScaffoldIssue[] = [];

  for (const entry of entries) {
    for (const name of entry.env ?? []) {
      // Le registry impose déjà cette grammaire. On la revérifie parce que le
      // générateur peut être appelé avec un registry tiers (§19) : ne pas faire
      // confiance à son entrée est la seule position tenable pour un composant
      // qui écrit des fichiers.
      if (!ENV_NAME.test(name)) {
        issues.push({
          code: 'GEN_SECRET_IN_ENV',
          path: [entry.id, name],
          message: messageFor('GEN_SECRET_IN_ENV', { first: entry.name, value: name }),
        });
        continue;
      }
      names.add(name);
    }
  }

  return { names: [...names].sort(), issues };
}

function sortedRecord(record: Readonly<Record<string, string>>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = record[key] as string;
  }
  return result;
}

function packageJson(
  manifest: Manifest,
  scripts: Record<string, string>,
  dependencies: Readonly<Record<string, string>>,
  devDependencies: Readonly<Record<string, string>>,
): string {
  // Ordre de clés déclaré, pas alphabétique : c'est l'ordre conventionnel d'un
  // package.json, et le fichier est d'abord lu par des humains.
  const content = {
    name: manifest.name,
    version: '0.1.0',
    private: true,
    type: 'module',
    engines: { node: NODE_RANGE },
    packageManager: PACKAGE_MANAGER,
    scripts,
    ...(Object.keys(dependencies).length > 0 ? { dependencies } : {}),
    ...(Object.keys(devDependencies).length > 0 ? { devDependencies } : {}),
  };
  return `${JSON.stringify(content, null, 2)}\n`;
}

function envExample(names: readonly string[]): string {
  const lines = [
    '# Variables d’environnement requises par ce projet.',
    '# Aucune valeur n’est fournie : renseignez-les localement, ne les versionnez jamais.',
    '',
    ...names.map((name) => `${name}=`),
  ];
  return `${lines.join('\n')}\n`;
}

function readme(
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  recipes: readonly Recipe[],
): string {
  const stack = entries.map((entry) => `- ${entry.name}`).join('\n');
  const applied = recipes.map((recipe) => `- ${recipe.name} — ${recipe.description}`).join('\n');
  const lines = [
    `# ${manifest.name}`,
    '',
    ...(entries.length > 0 ? ['## Stack', '', stack, ''] : []),
    ...(recipes.length > 0 ? ['## Recettes', '', applied, ''] : []),
    '## Démarrer',
    '',
    '```bash',
    'pnpm install',
    '```',
    '',
    'Copiez `.env.example` vers `.env` et renseignez les variables.',
    '',
    '---',
    '',
    'Ce projet a été généré par Project Factory. Il est **autonome** : aucune',
    'dépendance à Project Factory ne subsiste. Vous pouvez désinstaller l’outil,',
    'rien ne cassera.',
    '',
  ];
  return lines.join('\n');
}

const GITIGNORE = `node_modules/
dist/
build/
generated/
coverage/
.turbo/
*.tsbuildinfo

.env
.env.*
!.env.example

.DS_Store
Thumbs.db
.idea/
.vscode/*
!.vscode/extensions.json
`;

const WORKSPACE_PACKAGES = ['packages:', '  - "apps/*"', '  - "packages/*"'];

/**
 * `pnpm-workspace.yaml` : il a deux raisons d'exister, indépendantes.
 *
 * - un monorepo y déclare ses paquets ;
 * - pnpm 11 y lit `allowBuilds`, la liste des paquets autorisés à exécuter leur
 *   script d'installation. Sans elle, `pnpm install` **échoue** dès qu'un tel
 *   paquet est présent (Prisma, notamment) — même dans une application seule.
 */
function pnpmWorkspace(monorepo: boolean, allowBuilds: readonly string[]): string | undefined {
  if (!monorepo && allowBuilds.length === 0) {
    return undefined;
  }
  const lines = monorepo ? [...WORKSPACE_PACKAGES] : [];
  if (allowBuilds.length > 0) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(
      '# Paquets autorisés à exécuter leur script d’installation (pnpm >= 10).',
      '# Chacun l’est parce qu’une technologie choisie en a besoin.',
      'allowBuilds:',
      ...allowBuilds.map((name) => `  ${/^[a-z0-9-]+$/.test(name) ? name : `"${name}"`}: true`),
    );
  }
  return `${lines.join('\n')}\n`;
}

function collectAllowBuilds(entries: readonly RegistryEntry[]): string[] {
  const stack = stackOf(entries);
  const names = entries.flatMap((entry) =>
    integrationsFor(entry, stack).flatMap((integration) => integration.allowBuilds ?? []),
  );
  return [...new Set(names)].sort();
}

const TURBO_JSON = `{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
`;

export interface Scaffold {
  readonly files: readonly PlannedFile[];
  /**
   * Avertissements non bloquants — versions non épinglées, notamment.
   *
   * Ils remontent jusqu'à l'appelant au lieu d'être consommés ici : un
   * avertissement calculé puis jeté est pire que pas d'avertissement, parce
   * qu'il donne l'illusion que le contrôle existe.
   */
  readonly warnings: readonly Issue<string>[];
}

/** Construit les fichiers racine d'un projet à partir de sa stack résolue. */
export function buildScaffold(
  manifest: Manifest,
  entries: readonly RegistryEntry[],
  recipes: readonly Recipe[] = [],
): ParseResult<Scaffold, ScaffoldIssueCode> {
  // `name` est le seul champ libre du manifest, et il est substitué dans du
  // code (package.json, templates). Le type `Manifest` ne garantit pas qu'il a
  // été validé : un appelant peut en fabriquer un à la main. Revérifié ici, au
  // premier endroit où il entre dans un fichier.
  if (!PROJECT_NAME_PATTERN.test(manifest.name)) {
    return fail([
      {
        code: 'GEN_INVALID_PROJECT_NAME',
        path: ['name'],
        message: messageFor('GEN_INVALID_PROJECT_NAME', { value: JSON.stringify(manifest.name) }),
      },
    ]);
  }

  const { scripts, issues: scriptIssues } = collectScripts(entries);
  const { names, issues: envIssues } = collectEnv([...entries, ...recipes]);
  const dependencies = resolveDependencies([
    ...entries,
    ...integrationDependencySources(entries),
    ...recipes.map(recipeAsDependencySource),
  ]);

  const ownIssues: ScaffoldIssue[] = [...scriptIssues, ...envIssues];

  if (!dependencies.ok) {
    // Les problèmes de dépendances sont transmis tels quels : l'utilisateur lit
    // le même message qu'il ait lancé le résolveur seul ou le socle complet.
    // Ils partent avec les problèmes propres au socle — une seule liste, tous
    // les défauts d'un coup.
    return fail([
      ...ownIssues,
      ...dependencies.issues.map((issue) => ({
        code: issue.code as ScaffoldIssueCode,
        path: issue.path,
        message: issue.message,
      })),
    ]);
  }

  if (ownIssues.length > 0) {
    return fail(ownIssues);
  }

  const resolved = dependencies.value;

  const files: PlannedFile[] = [
    {
      path: 'package.json',
      contents: packageJson(manifest, scripts, resolved.dependencies, resolved.devDependencies),
      source: 'scaffold:package-json',
    },
    { path: '.gitignore', contents: GITIGNORE, source: 'scaffold:gitignore' },
    { path: '.env.example', contents: envExample(names), source: 'scaffold:env-example' },
    { path: 'README.md', contents: readme(manifest, entries, recipes), source: 'scaffold:readme' },
  ];

  files.push(...integrationFiles(entries, names));

  const workspace = pnpmWorkspace(
    manifest.architecture === 'monorepo',
    collectAllowBuilds(entries),
  );

  // Docker et CI viennent apres le socle : ils dependent des scripts que les
  // technologies ont apportes, donc ils ne peuvent etre construits qu'une fois
  // le package.json decide.
  files.push(
    ...buildInfrastructure(entries, scripts, {
      projectName: manifest.name,
      workspaceFile: workspace !== undefined,
    }),
  );

  const warnings: Issue<string>[] = [...resolved.warnings];
  if (entries.some((entry) => entry.id === 'docker') && !canRunInContainer(scripts)) {
    warnings.push({
      code: 'GEN_DOCKERFILE_DEFERRED',
      path: ['docker'],
      message: messageFor('GEN_DOCKERFILE_DEFERRED', {}),
    });
  }

  if (workspace !== undefined) {
    files.push({
      path: 'pnpm-workspace.yaml',
      contents: workspace,
      source: 'scaffold:pnpm-workspace',
    });
  }

  if (manifest.architecture === 'monorepo') {
    if (entries.some((entry) => entry.id === 'turborepo')) {
      files.push({ path: 'turbo.json', contents: TURBO_JSON, source: 'scaffold:turbo' });
    }
  }

  return ok({ files, warnings });
}

import type { Manifest } from '@project-factory/manifest';
import type { RegistryEntry } from '@project-factory/registry';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';
import { resolveDependencies } from './dependencies.js';
import { buildInfrastructure } from './infrastructure.js';
import { INTEGRATIONS } from './integrations.data.js';
import type { PlannedFile } from './plan.js';

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
const OWN_CODES = ['GEN_SCRIPT_CONFLICT', 'GEN_SECRET_IN_ENV'] as const;

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
  GEN_SECRET_IN_ENV:
    '{first} déclare « {value} » comme variable d’environnement. Ce n’est pas un nom de variable — une valeur ne doit jamais entrer dans un fichier généré.',
};

const messageFor = createMessageFormatter(MESSAGES);

/** Plancher Node et gestionnaire de paquets du projet généré. */
const NODE_RANGE = '>=20.11.0';
const PACKAGE_MANAGER = 'pnpm@11.13.1';

/** Nom de variable d'environnement acceptable : majuscules, chiffres, tirets bas. */
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;

const SCRIPTS_BY_ID = new Map(
  INTEGRATIONS.map((integration) => [integration.id, integration.scripts ?? {}]),
);

function collectScripts(entries: readonly RegistryEntry[]): {
  scripts: Record<string, string>;
  issues: ScaffoldIssue[];
} {
  const scripts: Record<string, string> = {};
  const owners = new Map<string, RegistryEntry>();
  const issues: ScaffoldIssue[] = [];

  for (const entry of entries) {
    for (const [name, command] of Object.entries(SCRIPTS_BY_ID.get(entry.id) ?? {})) {
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

function collectEnv(entries: readonly RegistryEntry[]): {
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

function readme(manifest: Manifest, entries: readonly RegistryEntry[]): string {
  const stack = entries.map((entry) => `- ${entry.name}`).join('\n');
  const lines = [
    `# ${manifest.name}`,
    '',
    ...(entries.length > 0 ? ['## Stack', '', stack, ''] : []),
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

const PNPM_WORKSPACE = `packages:
  - "apps/*"
  - "packages/*"
`;

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
): ParseResult<Scaffold, ScaffoldIssueCode> {
  const { scripts, issues: scriptIssues } = collectScripts(entries);
  const { names, issues: envIssues } = collectEnv(entries);
  const dependencies = resolveDependencies(entries);

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
    { path: 'README.md', contents: readme(manifest, entries), source: 'scaffold:readme' },
  ];

  // Docker et CI viennent apres le socle : ils dependent des scripts que les
  // technologies ont apportes, donc ils ne peuvent etre construits qu'une fois
  // le package.json decide.
  files.push(...buildInfrastructure(entries, scripts));

  if (manifest.architecture === 'monorepo') {
    files.push({
      path: 'pnpm-workspace.yaml',
      contents: PNPM_WORKSPACE,
      source: 'scaffold:pnpm-workspace',
    });
    if (entries.some((entry) => entry.id === 'turborepo')) {
      files.push({ path: 'turbo.json', contents: TURBO_JSON, source: 'scaffold:turbo' });
    }
  }

  return ok({ files, warnings: resolved.warnings });
}

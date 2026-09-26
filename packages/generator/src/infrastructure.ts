import type { RegistryEntry } from '@project-factory/registry';
import { type DockerService, INTEGRATIONS } from './integrations.data.js';
import type { PlannedFile } from './plan.js';

/**
 * Infrastructure locale et intégration continue du projet généré (§15).
 *
 * Ce que le §15 appelle « services locaux » : de quoi lancer `docker compose
 * up` et développer contre une vraie base, sans rien installer sur la machine.
 *
 * Rien n'est généré qui ne soit demandé. Un projet sans base n'a pas de
 * `docker-compose.yml` ; un projet sans outil de CI n'a pas de workflow. Poser
 * des fichiers « au cas où » oblige l'utilisateur à comprendre puis supprimer
 * ce qu'il n'a pas choisi.
 */

const DOCKER_BY_ID = new Map<string, DockerService>(
  INTEGRATIONS.filter(
    (integration): integration is typeof integration & { docker: DockerService } =>
      integration.docker !== undefined,
  ).map((integration) => [integration.id, integration.docker]),
);

/**
 * Scripts exécutés en intégration continue, dans l'ordre : ce qui échoue vite
 * passe en premier. L'étape Validation du pipeline (postinstall.ts) lance
 * exactement les mêmes : ce qu'elle vérifie est ce que la CI vérifiera.
 *
 * `test:e2e` en est **volontairement absent**. Les tests de bout en bout
 * exigent des navigateurs installés (`playwright install --with-deps`) et une
 * application qui tourne — deux choses qu'un socle fraîchement généré n'a pas.
 * Les lancer produirait une CI rouge au premier passage, avant même que
 * l'utilisateur ait écrit une ligne. Le workflow le dit, plutôt que de le taire.
 */
export const CI_SCRIPTS: readonly string[] = ['lint', 'typecheck', 'test', 'build'];

/** Un conteneur de production a besoin de construire puis de démarrer l'application. */
export function canRunInContainer(scripts: Readonly<Record<string, string>>): boolean {
  return scripts['build'] !== undefined && scripts['start'] !== undefined;
}

function serviceBlock(service: DockerService): string[] {
  const lines = [
    `  ${service.name}:`,
    `    image: ${service.image}`,
    '    restart: unless-stopped',
  ];

  if (service.ports !== undefined && service.ports.length > 0) {
    lines.push('    ports:');
    for (const port of service.ports) {
      lines.push(`      - "${port}"`);
    }
  }

  if (service.environment !== undefined) {
    lines.push('    environment:');
    for (const key of Object.keys(service.environment).sort()) {
      lines.push(`      ${key}: ${service.environment[key]}`);
    }
  }

  if (service.volume !== undefined) {
    lines.push('    volumes:');
    lines.push(`      - ${service.volume.name}:${service.volume.path}`);
  }

  if (service.healthcheck !== undefined) {
    lines.push('    healthcheck:');
    lines.push(`      test: ["CMD-SHELL", "${service.healthcheck}"]`);
    lines.push('      interval: 10s');
    lines.push('      retries: 5');
  }

  return lines;
}

function dockerCompose(services: readonly DockerService[]): string {
  const lines = [
    '# Services à lancer en local pour développer : docker compose up -d',
    '#',
    '# Les identifiants ci-dessous sont des valeurs de bac à sable, destinées à',
    '# des conteneurs éphémères sur votre machine en local. Ce ne sont pas des',
    '# secrets. N’utilisez jamais ce fichier en production : les vrais',
    '# identifiants vont dans votre .env, qui n’est pas versionné.',
    '',
    'services:',
  ];

  for (const service of services) {
    lines.push(...serviceBlock(service));
    lines.push('');
  }

  const volumes = services
    .map((service) => service.volume?.name)
    .filter((name): name is string => name !== undefined);

  if (volumes.length > 0) {
    lines.push('volumes:');
    for (const volume of volumes) {
      lines.push(`  ${volume}:`);
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Workflow d'intégration continue.
 *
 * Il n'exécute que des scripts **réellement présents** dans le package.json
 * généré. Une CI qui appelle un script inexistant échoue à la première
 * exécution, et l'utilisateur perd sa confiance dans le projet livré avant même
 * d'avoir écrit une ligne.
 */
function githubWorkflow(scripts: Readonly<Record<string, string>>): string {
  const steps = CI_SCRIPTS.filter((name) => scripts[name] !== undefined);

  const lines = [
    'name: CI',
    '',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    '',
    'jobs:',
    '  ci:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v5',
    '      - uses: pnpm/action-setup@v4',
    '      - uses: actions/setup-node@v5',
    '        with:',
    '          node-version: 22',
    '          cache: pnpm',
    '      - run: pnpm install --frozen-lockfile',
    ...steps.map((name) => `      - run: pnpm run ${name}`),
    // Quand le projet a des tests de bout en bout, le workflow explique
    // comment les activer plutôt que de faire comme s'ils n'existaient pas.
    ...(scripts['test:e2e'] === undefined
      ? []
      : [
          '',
          '      # Les tests de bout en bout ne sont pas lancés ici : ils demandent',
          '      # des navigateurs installés et une application qui tourne. Pour les',
          '      # activer, ajoutez :',
          '      #   - run: pnpm exec playwright install --with-deps',
          '      #   - run: pnpm run test:e2e',
        ]),
    '',
  ];

  return lines.join('\n');
}

/**
 * Image de production en trois étapes : dépendances, construction, exécution.
 *
 * Posée seulement quand le projet a de quoi se construire et démarrer
 * (`build` et `start`) — un Dockerfile qui échoue à `docker build` sur un
 * projet neuf est pire que pas de Dockerfile. `pnpm-workspace.yaml` n'est
 * copié que s'il existe : un `COPY` d'un fichier absent casse la construction.
 */
function dockerfile(workspaceFile: boolean): string {
  const manifests = [
    'package.json',
    'pnpm-lock.yaml',
    ...(workspaceFile ? ['pnpm-workspace.yaml'] : []),
  ];
  return `${[
    '# syntax=docker/dockerfile:1',
    '',
    'FROM node:22-alpine AS base',
    '# pnpm à la version de packageManager, via corepack. Le cache vit dans',
    '# COREPACK_HOME pour être recopié : sinon le conteneur retéléchargerait pnpm',
    '# à chaque démarrage, et ne démarrerait pas sans réseau.',
    'ENV COREPACK_HOME=/corepack',
    'RUN corepack enable',
    'WORKDIR /app',
    '',
    'FROM base AS deps',
    `COPY ${manifests.join(' ')} ./`,
    'RUN corepack install && pnpm install --frozen-lockfile',
    '',
    'FROM deps AS build',
    'COPY . .',
    'RUN pnpm run build',
    '',
    'FROM base AS runtime',
    'ENV NODE_ENV=production',
    'COPY --from=deps /corepack /corepack',
    'COPY --from=build --chown=node:node /app ./',
    '# Jamais root : une faille applicative ne donne pas la main sur le conteneur.',
    'USER node',
    'EXPOSE 3000',
    'CMD ["pnpm", "start"]',
  ].join('\n')}\n`;
}

/** Ce qui n'entre jamais dans le contexte de construction — les secrets d'abord. */
const DOCKERIGNORE = `.env
.env.*
!.env.example
.git
node_modules
dist
.next
coverage
`;

/**
 * Dev Container : l'environnement de développement, reproductible.
 *
 * Écrit à la main plutôt qu'avec `JSON.stringify` : Biome mettrait un tableau
 * court sur une ligne, et le projet échouerait à son propre `pnpm lint`.
 */
function devcontainer(projectName: string, ports: readonly number[]): string {
  return `${[
    '{',
    `  "name": ${JSON.stringify(projectName)},`,
    '  "image": "mcr.microsoft.com/devcontainers/typescript-node:22",',
    `  "forwardPorts": [${ports.join(', ')}],`,
    '  "postCreateCommand": "corepack enable && pnpm install"',
    '}',
  ].join('\n')}\n`;
}

/** Port de l'application en développement, avant ceux des services. */
const APP_PORT = 3000;

export interface InfrastructureOptions {
  readonly projectName: string;
  /** Le socle contient un `pnpm-workspace.yaml`. */
  readonly workspaceFile?: boolean;
}

/** Construit les fichiers d'infrastructure demandés par la stack. */
export function buildInfrastructure(
  entries: readonly RegistryEntry[],
  scripts: Readonly<Record<string, string>>,
  options: InfrastructureOptions = { projectName: 'app' },
): PlannedFile[] {
  const files: PlannedFile[] = [];
  const chosen = new Set(entries.map((entry) => entry.id));

  // Tri par identifiant : l'ordre des services ne doit pas dépendre de l'ordre
  // dans lequel l'utilisateur a fait ses choix.
  const services = [...entries]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((entry) => DOCKER_BY_ID.get(entry.id))
    .filter((service): service is DockerService => service !== undefined);

  if (services.length > 0) {
    files.push({
      path: 'docker-compose.yml',
      contents: dockerCompose(services),
      source: 'infra:docker-compose',
    });
  }

  if (chosen.has('docker') && canRunInContainer(scripts)) {
    files.push(
      {
        path: 'Dockerfile',
        contents: dockerfile(options.workspaceFile === true),
        source: 'infra:docker',
      },
      { path: '.dockerignore', contents: DOCKERIGNORE, source: 'infra:docker' },
    );
  }

  if (chosen.has('dev-container')) {
    const servicePorts = services
      .flatMap((service) => service.ports ?? [])
      .map((mapping) => Number.parseInt(mapping.split(':')[0] ?? '', 10))
      .filter((port) => Number.isInteger(port));
    files.push({
      path: '.devcontainer/devcontainer.json',
      contents: devcontainer(options.projectName, [APP_PORT, ...servicePorts]),
      source: 'infra:dev-container',
    });
  }

  if (chosen.has('github-actions')) {
    files.push({
      path: '.github/workflows/ci.yml',
      contents: githubWorkflow(scripts),
      source: 'infra:github-actions',
    });
  }

  return files;
}

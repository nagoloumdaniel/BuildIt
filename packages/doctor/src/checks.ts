import type { Check, CheckStatus, Fix, ProjectFacts, Report } from './facts.js';

/**
 * Les constats du §16. Chacun répond à une question qu'un développeur se pose
 * vraiment sur son projet, et rend une phrase qui dit **ce qui a été observé**,
 * pas seulement « OK » : un score sans constat ne sert à rien.
 */

/** Un constat possible, avec ce qu'il faut pour le rendre. */
interface Ruled {
  readonly id: string;
  readonly title: string;
  readonly status: CheckStatus;
  readonly detail: string;
  readonly fix?: Fix | undefined;
}

/**
 * Le catalogue, injecté : seul juge de ce qui existe (§11). Le Doctor ne
 * recopie aucune liste de technologies il demande le **nom lisible** au
 * catalogue. Le CLI construit cet adaptateur à partir du catalogue chargé.
 */
export interface Catalogue {
  /** Le nom lisible d'une fiche, quand elle existe au catalogue. */
  nameOf(id: string): string | undefined;
}

/** Les moteurs de base de données du catalogue. */
const ENGINES = ['postgresql', 'mysql', 'sqlite', 'mongodb'] as const;

/** Les limites de débit connues du catalogue, par paquet npm. */
const RATE_LIMITERS = ['rate-limiter-flexible', '@upstash/ratelimit', 'express-rate-limit'];

function envExampleFix(names: readonly string[]): Fix {
  const listed = [...names].sort().join('\n');
  return {
    path: '.env.example',
    action: 'create',
    content: `# Variables d'environnement du projet.
# Aucune valeur : ce fichier est versionné (§24). Copiez-le en .env et remplissez-le.
${listed}
`,
    reason: 'documenter les variables que le code lit, sans aucune valeur',
  };
}

/** `1 dépendance` / `2 dépendances` le constat se lit, il ne se déchiffre pas. */
function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

function typescriptCheck(facts: ProjectFacts): Ruled {
  if (facts.typescript) {
    return {
      id: 'typescript',
      title: 'TypeScript',
      status: 'pass',
      detail: 'Le projet est vérifié par TypeScript (tsconfig.json ou dépendance `typescript`).',
    };
  }
  return {
    id: 'typescript',
    title: 'TypeScript',
    status: 'warn',
    detail: 'Aucune configuration TypeScript : le projet n’a pas de filet de sécurité de types.',
  };
}

function dependenciesCheck(facts: ProjectFacts): Ruled {
  if (!facts.installed) {
    return {
      id: 'dependencies',
      title: 'Dépendances',
      status: 'fail',
      detail: facts.packageManager
        ? 'Rien d’installé : lancez l’installation du projet.'
        : 'Rien d’installé et aucun gestionnaire identifié : lancez l’installation à la main.',
    };
  }
  if (facts.dependencies.length === 0) {
    return {
      id: 'dependencies',
      title: 'Dépendances',
      status: 'warn',
      detail: 'Installé, mais aucune dépendance déclarée : vérifiez package.json.',
    };
  }
  const declared = new Set(facts.dependencies);
  const missing = facts.expectedPackages
    .filter((entry) => entry.packages.length > 0)
    .filter((entry) => !entry.packages.some((name) => declared.has(name)))
    .map((entry) => entry.id);
  if (missing.length > 0) {
    return {
      id: 'dependencies',
      title: 'Dépendances',
      status: 'warn',
      detail: `La pile annonce ${missing.join(', ')}, absent(s) des dépendances déclarées.`,
    };
  }
  return {
    id: 'dependencies',
    title: 'Dépendances',
    status: 'pass',
    detail: `${plural(facts.dependencies.length, 'dépendance déclarée et installée', 'dépendances déclarées et installées')}.`,
  };
}

function environmentCheck(facts: ProjectFacts): Ruled {
  if (facts.envUsed.length === 0) {
    return {
      id: 'environment-variables',
      title: 'Variables d’environnement',
      status: 'pass',
      detail: 'Aucune variable d’environnement lue par le code.',
    };
  }
  const list = facts.envUsed.join(', ');
  if (facts.envExample) {
    return {
      id: 'environment-variables',
      title: 'Variables d’environnement',
      status: 'pass',
      detail: `${plural(facts.envUsed.length, 'variable lue', 'variables lues')} (${list}) et documentée(s).`,
    };
  }
  return {
    id: 'environment-variables',
    title: 'Variables d’environnement',
    status: 'fail',
    detail: `${plural(facts.envUsed.length, 'variable lue', 'variables lues')} par le code (${list}) sans .env.example : personne ne sait quoi remplir.`,
    fix: envExampleFix(facts.envUsed),
  };
}

function databaseCheck(facts: ProjectFacts): Ruled {
  const engine = facts.technologies.find((id) => (ENGINES as readonly string[]).includes(id));
  if (engine === undefined) {
    return {
      id: 'database',
      title: 'Base de données',
      status: 'n/a',
      detail: 'Aucune base de données dans la pile.',
    };
  }
  return {
    id: 'database',
    title: 'Base de données',
    status: 'pass',
    detail: `${engine} déclarée au manifest.`,
  };
}

function dockerCheck(facts: ProjectFacts): Ruled {
  const declared = facts.technologies.includes('docker');
  if (!facts.docker && !declared) {
    return {
      id: 'docker',
      title: 'Docker',
      status: 'n/a',
      detail: 'Le projet ne conteneurise rien et ne le déclare pas.',
    };
  }
  if (!facts.docker) {
    return {
      id: 'docker',
      title: 'Docker',
      status: 'warn',
      detail: 'Annoncé au manifest, mais aucun Dockerfile ni compose dans le projet.',
    };
  }
  if (!facts.dockerignore) {
    return {
      id: 'docker',
      title: 'Docker',
      status: 'warn',
      detail:
        'Dockerfile présent sans .dockerignore : le contexte de build embarque node_modules et .git.',
      fix: {
        path: '.dockerignore',
        action: 'create',
        content: 'node_modules\n.git\n.next\ndist\ncoverage\n.env\n.env.*\n',
        reason: 'alléger le contexte de build et éviter d’y copier des secrets',
      },
    };
  }
  return {
    id: 'docker',
    title: 'Docker',
    status: 'pass',
    detail: 'Dockerfile et .dockerignore présents.',
  };
}

function testScriptFix(facts: ProjectFacts): Fix {
  return {
    path: 'package.json',
    action: 'merge-json',
    content: JSON.stringify({ scripts: { test: 'vitest run' } }),
    reason: 'donner une commande de test au projet',
  };
}

function testsCheck(facts: ProjectFacts): Ruled {
  if (!facts.tests) {
    return {
      id: 'tests',
      title: 'Tests',
      status: 'fail',
      detail: 'Aucun test ni script de test : rien ne prouve que le projet marche encore.',
      fix: testScriptFix(facts),
    };
  }
  if (!facts.scripts.includes('test')) {
    return {
      id: 'tests',
      title: 'Tests',
      status: 'warn',
      detail: 'Des fichiers de test existent, mais aucun script `test` ne les lance.',
      fix: testScriptFix(facts),
    };
  }
  return {
    id: 'tests',
    title: 'Tests',
    status: 'pass',
    detail: 'Des tests existent et le script `test` les lance.',
  };
}

function ciCheck(facts: ProjectFacts): Ruled {
  if (facts.ci) {
    return {
      id: 'ci',
      title: 'Intégration continue',
      status: 'pass',
      detail: 'Un workflow est versionné dans .github/workflows.',
    };
  }
  const run = facts.packageManager ? 'pnpm' : 'npm run';
  return {
    id: 'ci',
    title: 'Intégration continue',
    status: 'fail',
    detail:
      'Aucun workflow : le lint, les types et les tests ne tournent nulle part automatiquement.',
    fix: {
      path: '.github/workflows/ci.yml',
      action: 'create',
      content: `name: CI
on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: corepack enable
      - run: ${facts.packageManager ? 'pnpm install --frozen-lockfile' : 'npm ci'}
      - run: ${run} lint
      - run: ${run} typecheck
      - run: ${run} test
`,
      reason: 'faire tourner lint, types et tests à chaque poussée',
    },
  };
}

function monitoringCheck(facts: ProjectFacts): Ruled {
  const present = facts.catalogueIds.find((id) => id === 'sentry' || id === 'opentelemetry');
  if (present !== undefined) {
    return {
      id: 'monitoring',
      title: 'Monitoring d’erreurs',
      status: 'pass',
      detail: `${present} est dans la pile : les erreurs de production seront remontées.`,
    };
  }
  return {
    id: 'monitoring',
    title: 'Monitoring d’erreurs',
    status: 'warn',
    detail: 'Rien ne remonte les erreurs de production (Sentry, OpenTelemetry…).',
  };
}

function rateLimitingCheck(facts: ProjectFacts): Ruled {
  // Le constat se lit sur les **paquets**, jamais sur la catégorie : une
  // catégorie du catalogue peut être cumulative ou exclusive, et en déduire un
  // comportement est faux (leçon du registry, §11).
  const names = new Set([
    ...facts.dependencies,
    ...facts.expectedPackages.flatMap((entry) => entry.packages),
  ]);
  const present = RATE_LIMITERS.find((name) => names.has(name));
  if (present !== undefined) {
    return {
      id: 'rate-limiting',
      title: 'Limitation de débit',
      status: 'pass',
      detail: `${present} est déclaré par le projet.`,
    };
  }
  return {
    id: 'rate-limiting',
    title: 'Limitation de débit',
    status: 'warn',
    detail:
      'Aucune limitation de débit : une API exposée sans limite se fait épuiser par un seul client.',
  };
}

function healthCheck(facts: ProjectFacts): Ruled {
  if (facts.scripts.includes('health')) {
    return {
      id: 'health',
      title: 'Diagnostic du projet',
      status: 'pass',
      detail: 'Un script `health` est déclaré.',
    };
  }
  return {
    id: 'health',
    title: 'Diagnostic du projet',
    status: 'warn',
    detail: 'Aucun script `health` : rien à lancer pour savoir si le socle est sain.',
    fix: {
      path: 'package.json',
      action: 'merge-json',
      content: JSON.stringify({ scripts: { health: 'pf doctor' } }),
      reason: 'rendre le diagnostic rejouable d’une commande',
    },
  };
}

function readmeCheck(facts: ProjectFacts): Ruled {
  if (facts.readme) {
    return {
      id: 'readme',
      title: 'README',
      status: 'pass',
      detail: 'Un README est présent.',
    };
  }
  const runner = facts.packageManager ? 'pnpm' : 'npm run';
  return {
    id: 'readme',
    title: 'README',
    status: 'warn',
    detail: 'Aucun README : personne ne sait comment démarrer ce projet sans lire le code.',
    fix: {
      path: 'README.md',
      action: 'create',
      content: `# ${facts.name}

## Démarrer

\`\`\`bash
${facts.packageManager ? 'pnpm install' : 'npm install'}
${runner} dev
\`\`\`

## Vérifier

\`\`\`bash
${runner} lint
${runner} typecheck
${runner} test
\`\`\`
`,
      reason: 'donner les trois commandes qu’un nouveau doit lancer en arrivant',
    },
  };
}

/**
 * Le rapport complet. L'ordre des constats est fixe : deux diagnostics du même
 * projet rendent la même liste, donc le score est comparable dans le temps —
 * c'est ce que le §16 demande en parlant d'historique d'évolution.
 */
export function runDoctor(facts: ProjectFacts, catalogue: Catalogue): Report {
  const checks: readonly Check[] = [
    typescriptCheck(facts),
    dependenciesCheck(facts),
    environmentCheck(facts),
    databaseCheck(facts),
    dockerCheck(facts),
    testsCheck(facts),
    ciCheck(facts),
    monitoringCheck(facts),
    rateLimitingCheck(facts),
    healthCheck(facts),
    readmeCheck(facts),
  ];

  const counted = checks.filter((entry) => entry.status !== 'n/a');
  const satisfied = counted.reduce(
    (total, entry) => total + (entry.status === 'pass' ? 1 : entry.status === 'warn' ? 0.5 : 0),
    0,
  );
  const score = counted.length === 0 ? 100 : Math.round((satisfied / counted.length) * 100);

  return {
    score,
    checks,
    open: checks.filter((entry) => entry.status === 'fail' || entry.status === 'warn'),
  };
}

/** Le nom lisible d'une fiche, ou son identifiant pour l'en-tête du rapport. */
export function describeTechnology(catalogue: Catalogue, id: string): string {
  return catalogue.nameOf(id) ?? id;
}

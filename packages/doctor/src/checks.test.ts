import { describe, expect, it } from 'vitest';
import { describeTechnology, runDoctor } from './checks.js';
import type { ProjectFacts } from './facts.js';

/**
 * Un projet sain, celui que `pf create` + `pf add` devraient produire : sur lui,
 * le Doctor ne trouve rien à redire et le score est de 100. Chaque test dégrade
 * ensuite **un** fait à la fois, pour que le constat qui tombe soit sans
 * ambiguïté.
 */
const SAIN: ProjectFacts = {
  name: 'quai3',
  dependencies: [
    'next',
    'react',
    'typescript',
    'vitest',
    'docker',
    'express-rate-limit',
    'rate-limiter-flexible',
  ],
  scripts: ['dev', 'build', 'test', 'lint', 'typecheck', 'health'],
  typescript: true,
  packageManager: true,
  installed: true,
  gitignore: true,
  docker: true,
  dockerignore: true,
  tests: true,
  ci: true,
  envExample: true,
  envUsed: ['DATABASE_URL'],
  readme: true,
  technologies: ['next', 'postgresql', 'docker'],
  expectedPackages: [
    { id: 'next', packages: ['next'] },
    { id: 'rate-limiter-flexible', packages: ['rate-limiter-flexible'] },
  ],
  catalogueIds: ['next', 'postgresql', 'docker', 'sentry'],
};

const CATALOGUE = {
  nameOf: (id: string) => (id === 'next' ? 'Next.js' : undefined),
};

function report(overrides: Partial<ProjectFacts>) {
  return runDoctor({ ...SAIN, ...overrides }, CATALOGUE);
}

describe('Project Doctor', () => {
  it('donne 100 à un projet sain, sans aucun constat ouvert', () => {
    const result = report({});
    expect(result.score).toBe(100);
    expect(result.open).toEqual([]);
    expect(result.checks.map((entry) => entry.id)).toEqual([
      'typescript',
      'dependencies',
      'environment-variables',
      'database',
      'docker',
      'tests',
      'ci',
      'monitoring',
      'rate-limiting',
      'health',
      'readme',
    ]);
  });

  it('rend la même liste et le même score pour les mêmes faits', () => {
    // Le score sert d'historique : deux diagnostics identiques doivent être
    // comparables, donc l'ordre des constats ne dépend d'aucune itération
    // non déterministe.
    expect(report({})).toEqual(report({}));
  });

  it('compte un avertissement pour la moitié', () => {
    // Un seul constat en défaut, et c'est un avertissement : 10 satisfaits sur
    // 11 évaluables, plus la moitié pour l'avertissement → 95, pas 100.
    const result = report({ dockerignore: false });
    expect(result.checks.filter((entry) => entry.status === 'warn')).toHaveLength(1);
    expect(result.score).toBe(95);
  });

  it('les constats sans objet sortent de l’équation, pas du score', () => {
    // Un projet web sans base de données et sans conteneur : les deux constats
    // correspondants passent en `n/a`. Deux constats évaluables en moins, donc
    // 100 — un `n/a` mal compté ferait baisser le score d'un projet sain qui
    // n'a simplement pas ces briques.
    const result = runDoctor(
      {
        ...SAIN,
        docker: false,
        dockerignore: false,
        technologies: ['next'],
        expectedPackages: [
          { id: 'next', packages: ['next'] },
          { id: 'rate-limiter-flexible', packages: ['rate-limiter-flexible'] },
        ],
      },
      CATALOGUE,
    );
    expect(result.checks.find((entry) => entry.id === 'monitoring')?.status).toBe('pass');
    expect(result.checks.find((entry) => entry.id === 'database')?.status).toBe('n/a');
    expect(result.checks.filter((entry) => entry.status === 'pass')).toHaveLength(9);
    expect(result.checks.filter((entry) => entry.status === 'warn')).toHaveLength(0);
    expect(result.checks.filter((entry) => entry.status === 'fail')).toHaveLength(0);
    // Seuls deux constats sortent de l'équation (base de données, Docker) : le
    // score ne baisse que si un constat évaluable n'est pas satisfait.
    expect(result.score).toBe(100);
  });

  it('nomme les variables lues quand .env.example manque, et propose de le créer', () => {
    const result = report({ envExample: false, envUsed: ['DATABASE_URL', 'AUTH_SECRET'] });
    const environnement = result.checks.find((entry) => entry.id === 'environment-variables');
    expect(environnement?.status).toBe('fail');
    expect(environnement?.detail).toContain('AUTH_SECRET');
    expect(environnement?.detail).toContain('DATABASE_URL');
    expect(environnement?.fix?.path).toBe('.env.example');
    // Le fichier proposé ne contient que des **noms** : aucune valeur, jamais.
    expect(environnement?.fix?.content).toContain('AUTH_SECRET\n');
    expect(environnement?.fix?.content).not.toContain('=');
  });

  it('ne propose pas .env.example quand le code ne lit aucune variable', () => {
    const result = report({ envUsed: [] });
    expect(result.checks.find((entry) => entry.id === 'environment-variables')?.status).toBe(
      'pass',
    );
  });

  it('signale une technologie annoncée mais absente des dépendances', () => {
    const result = report({
      expectedPackages: [{ id: 'prisma', packages: ['@prisma/client'] }],
    });
    const dependances = result.checks.find((entry) => entry.id === 'dependencies');
    expect(dependances?.status).toBe('warn');
    expect(dependances?.detail).toContain('prisma');
  });

  it('échoue quand rien n’est installé, et le dit', () => {
    const result = report({ installed: false });
    expect(result.checks.find((entry) => entry.id === 'dependencies')?.status).toBe('fail');
    expect(result.score).toBeLessThan(100);
  });

  it('avertit quand rien n’est déclaré, alors que le projet est installé', () => {
    // Un `package.json` réduit à sa plus simple expression : installé, mais
    // aucune dépendance — il n'y a rien à comparer, et le dire vaut mieux que
    // d'afficher « 0 dépendance » comme un satisfecit.
    const result = report({ dependencies: [], expectedPackages: [] });
    const dependances = result.checks.find((entry) => entry.id === 'dependencies');
    expect(dependances?.status).toBe('warn');
    expect(dependances?.detail).toContain('aucune dépendance déclarée');
  });

  it('avertit quand le projet n’est pas vérifié par TypeScript', () => {
    const result = report({ typescript: false });
    const typescript = result.checks.find((entry) => entry.id === 'typescript');
    expect(typescript?.status).toBe('warn');
    expect(typescript?.detail).toContain('Aucune configuration TypeScript');
    expect(result.score).toBeLessThan(100);
  });

  it('avertit sur un Dockerfile sans .dockerignore, et propose le fichier', () => {
    const result = report({ dockerignore: false });
    const docker = result.checks.find((entry) => entry.id === 'docker');
    expect(docker?.status).toBe('warn');
    expect(docker?.fix?.path).toBe('.dockerignore');
  });

  it('sort Docker de l’équation quand la pile n’en contient pas', () => {
    const result = report({
      docker: false,
      dockerignore: false,
      technologies: ['next'],
      expectedPackages: [
        { id: 'next', packages: ['next'] },
        { id: 'rate-limiter-flexible', packages: ['rate-limiter-flexible'] },
      ],
    });
    expect(result.checks.find((entry) => entry.id === 'docker')?.status).toBe('n/a');
    expect(result.checks.find((entry) => entry.id === 'database')?.status).toBe('n/a');
    // Un constat sans objet ne fait pas baisser le score.
    expect(result.score).toBe(100);
  });

  it('propose un workflow de CI quand il n’y en a pas', () => {
    const result = report({ ci: false });
    const ci = result.checks.find((entry) => entry.id === 'ci');
    expect(ci?.status).toBe('fail');
    expect(ci?.fix?.path).toBe('.github/workflows/ci.yml');
    expect(ci?.fix?.content).toContain('pnpm install --frozen-lockfile');
    expect(ci?.fix?.content).toContain('run: pnpm test');
  });

  it('écrit le workflow npm quand le gestionnaire est npm', () => {
    const result = report({ ci: false, packageManager: false });
    expect(result.checks.find((entry) => entry.id === 'ci')?.fix?.content).toContain('npm ci');
    expect(result.checks.find((entry) => entry.id === 'ci')?.fix?.content).toContain(
      'npm run test',
    );
  });

  it('propose un script de test quand il manque', () => {
    const result = report({ tests: false });
    const tests = result.checks.find((entry) => entry.id === 'tests');
    expect(tests?.status).toBe('fail');
    expect(tests?.fix?.action).toBe('merge-json');
    expect(JSON.parse(tests?.fix?.content ?? '{}')).toEqual({ scripts: { test: 'vitest run' } });
  });

  it('distingue « des tests sans script » de « aucun test »', () => {
    const result = report({ tests: true, scripts: ['dev', 'lint'] });
    const tests = result.checks.find((entry) => entry.id === 'tests');
    expect(tests?.status).toBe('warn');
    expect(tests?.detail).toContain('aucun script');
  });

  it('propose un script health et un README, sans jamais écraser', () => {
    const result = report({ scripts: ['dev', 'test'], readme: false });
    const health = result.checks.find((entry) => entry.id === 'health');
    const readme = result.checks.find((entry) => entry.id === 'readme');
    expect(health?.fix?.action).toBe('merge-json');
    expect(readme?.fix?.action).toBe('create');
    expect(readme?.fix?.path).toBe('README.md');
    expect(readme?.fix?.content).toContain('# quai3');
  });

  it('reconnaît un limiteur de débit par paquet, pas par catégorie', () => {
    // `testing` est cumulative, `orm` exclusive : déduire un constat de la seule
    // catégorie est faux. Ici c'est le paquet installé qui tranche.
    const result = report({ dependencies: [...SAIN.dependencies, 'express-rate-limit'] });
    expect(result.checks.find((entry) => entry.id === 'rate-limiting')?.status).toBe('pass');
  });

  it('ne compte que ce que le catalogue connaît', () => {
    const result = report({ catalogueIds: ['next', 'technologie-inconnue'] });
    expect(result.checks.find((entry) => entry.id === 'monitoring')?.status).toBe('warn');
  });

  it('rend 100 quand rien n’est évaluable plutôt qu’un score trompeur', () => {
    const result = report({
      typescript: true,
      dependencies: [],
      installed: false,
      technologies: [],
      catalogueIds: [],
      expectedPackages: [],
      envUsed: [],
      tests: false,
      ci: false,
      docker: false,
      dockerignore: false,
      readme: false,
    });
    expect(result.score).toBeLessThan(100);
    expect(result.open.length).toBeGreaterThan(0);
  });
});

describe('describeTechnology', () => {
  it('préfère le nom du catalogue et retombe sur l’identifiant', () => {
    expect(describeTechnology(CATALOGUE, 'next')).toBe('Next.js');
    expect(describeTechnology(CATALOGUE, 'inconnue')).toBe('inconnue');
  });
});

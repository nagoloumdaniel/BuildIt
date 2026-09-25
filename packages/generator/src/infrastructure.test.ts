import type { RegistryEntry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { buildInfrastructure } from './infrastructure.js';

function entry(patch: Partial<RegistryEntry> & { id: string }): RegistryEntry {
  return {
    name: patch.id,
    category: 'frontend',
    targets: ['web'],
    status: 'stable',
    generation: 'declared',
    license: 'MIT',
    lastReviewedAt: '2026-09-23',
    ...patch,
  };
}

function fileNamed(files: readonly { path: string; contents: string }[], path: string): string {
  const found = files.find((file) => file.path === path);
  if (found === undefined) {
    throw new Error(`fichier absent : ${path} (présents : ${files.map((f) => f.path).join(', ')})`);
  }
  return found.contents;
}

const POSTGRES = entry({ id: 'postgresql', category: 'database' });
const REDIS = entry({ id: 'redis', category: 'cache' });
const ACTIONS = entry({ id: 'github-actions', category: 'ci-cd' });

describe('docker-compose.yml', () => {
  it('n’est pas généré sans service local', () => {
    const files = buildInfrastructure([entry({ id: 'next' })], {});
    expect(files.map((file) => file.path)).not.toContain('docker-compose.yml');
  });

  it('est généré dès qu’une technologie demande un service', () => {
    const files = buildInfrastructure([POSTGRES], {});
    expect(files.map((file) => file.path)).toContain('docker-compose.yml');
  });

  it('décrit le service de la technologie choisie', () => {
    const compose = fileNamed(buildInfrastructure([POSTGRES], {}), 'docker-compose.yml');
    expect(compose).toContain('postgres:');
    expect(compose).toContain('image: postgres:17-alpine');
    expect(compose).toContain('5432:5432');
  });

  it('réunit plusieurs services dans un seul fichier', () => {
    const compose = fileNamed(buildInfrastructure([POSTGRES, REDIS], {}), 'docker-compose.yml');
    expect(compose).toContain('postgres:');
    expect(compose).toContain('redis:');
  });

  it('déclare les volumes nommés utilisés', () => {
    const compose = fileNamed(buildInfrastructure([POSTGRES, REDIS], {}), 'docker-compose.yml');
    expect(compose).toContain('volumes:');
    expect(compose).toContain('postgres-data:');
    expect(compose).toContain('redis-data:');
  });

  it('ne déclare pas de section volumes quand aucun service n’en a', () => {
    const compose = fileNamed(
      buildInfrastructure([entry({ id: 'mongodb', category: 'database' })], {}),
      'docker-compose.yml',
    );
    expect(compose).toContain('mongo-data');
  });

  it('ajoute un healthcheck quand la technologie en déclare un', () => {
    const compose = fileNamed(buildInfrastructure([POSTGRES], {}), 'docker-compose.yml');
    expect(compose).toContain('healthcheck:');
    expect(compose).toContain('pg_isready');
  });

  it('produit un fichier stable quel que soit l’ordre des technologies', () => {
    const a = fileNamed(buildInfrastructure([POSTGRES, REDIS], {}), 'docker-compose.yml');
    const b = fileNamed(buildInfrastructure([REDIS, POSTGRES], {}), 'docker-compose.yml');
    expect(a).toBe(b);
  });

  it('indique son origine', () => {
    const file = buildInfrastructure([POSTGRES], {}).find(
      (candidate) => candidate.path === 'docker-compose.yml',
    );
    expect(file?.source).toContain('infra');
  });
});

/**
 * §24 : un fichier généré ne porte aucune valeur sensible. Les identifiants de
 * `docker-compose.yml` sont des valeurs de bac à sable pour un conteneur
 * éphémère local — ce que le fichier doit dire explicitement, pour que personne
 * ne les prenne pour des secrets à protéger ni ne les réutilise en production.
 */
describe('docker-compose et les identifiants', () => {
  it('avertit que les identifiants sont locaux', () => {
    const compose = fileNamed(buildInfrastructure([POSTGRES], {}), 'docker-compose.yml');
    expect(compose.toLowerCase()).toContain('local');
    expect(compose.toLowerCase()).toContain('production');
  });

  it('ne référence aucune variable du .env', () => {
    // Un compose qui lirait le .env ferait entrer de vrais secrets dans le
    // périmètre d'un fichier versionné.
    const compose = fileNamed(buildInfrastructure([POSTGRES], {}), 'docker-compose.yml');
    expect(compose).not.toContain('${');
    expect(compose).not.toContain('env_file');
  });
});

describe('intégration continue', () => {
  it('n’est pas générée sans outil de CI choisi', () => {
    const files = buildInfrastructure([POSTGRES], {});
    expect(files.map((file) => file.path)).not.toContain('.github/workflows/ci.yml');
  });

  it('est générée quand GitHub Actions est choisi', () => {
    const files = buildInfrastructure([ACTIONS], {});
    expect(files.map((file) => file.path)).toContain('.github/workflows/ci.yml');
  });

  it('exécute les scripts réellement présents dans le projet', () => {
    const ci = fileNamed(
      buildInfrastructure([ACTIONS], { lint: 'biome check .', test: 'vitest run' }),
      '.github/workflows/ci.yml',
    );
    expect(ci).toContain('pnpm run lint');
    expect(ci).toContain('pnpm run test');
  });

  it('n’invente pas un script absent', () => {
    const ci = fileNamed(
      buildInfrastructure([ACTIONS], { lint: 'biome check .' }),
      '.github/workflows/ci.yml',
    );
    expect(ci).toContain('pnpm run lint');
    expect(ci).not.toContain('pnpm run test');
  });

  it('installe toujours les dépendances', () => {
    const ci = fileNamed(buildInfrastructure([ACTIONS], {}), '.github/workflows/ci.yml');
    expect(ci).toContain('pnpm install');
  });

  it('exécute les scripts dans un ordre stable', () => {
    const a = fileNamed(
      buildInfrastructure([ACTIONS], { test: 'x', lint: 'y', build: 'z' }),
      '.github/workflows/ci.yml',
    );
    const b = fileNamed(
      buildInfrastructure([ACTIONS], { build: 'z', lint: 'y', test: 'x' }),
      '.github/workflows/ci.yml',
    );
    expect(a).toBe(b);
  });

  it('ne contient aucune valeur sensible', () => {
    const ci = fileNamed(
      buildInfrastructure([ACTIONS], { test: 'vitest run' }),
      '.github/workflows/ci.yml',
    );
    expect(ci).not.toMatch(/(password|secret|token)\s*[:=]\s*\S/i);
  });
});

describe('buildInfrastructure ne lève jamais', () => {
  it('sur une stack vide', () => {
    expect(() => buildInfrastructure([], {})).not.toThrow();
    expect(buildInfrastructure([], {})).toEqual([]);
  });

  it('sur une technologie sans intégration connue', () => {
    expect(() => buildInfrastructure([entry({ id: 'inconnue' })], {})).not.toThrow();
  });
});

/**
 * Deux défauts trouvés en lisant les fichiers générés, pas en lisant les tests.
 */
describe('défauts corrigés après lecture de la sortie', () => {
  it('monte chaque volume au chemin réel de la technologie', () => {
    // Un chemin dérivé du nom du service — /var/lib/postgres — monterait le
    // volume à côté des données, que PostgreSQL écrit dans
    // /var/lib/postgresql/data. Rien ne serait persisté, sans erreur visible.
    const compose = fileNamed(buildInfrastructure([POSTGRES], {}), 'docker-compose.yml');
    expect(compose).toContain('postgres-data:/var/lib/postgresql/data');
  });

  it('monte Redis à son propre chemin', () => {
    const compose = fileNamed(buildInfrastructure([REDIS], {}), 'docker-compose.yml');
    expect(compose).toContain('redis-data:/data');
  });

  it('ne lance pas les tests de bout en bout en CI', () => {
    // Playwright sans navigateurs installés donne une CI rouge au premier
    // passage, avant que l'utilisateur ait écrit une ligne.
    const ci = fileNamed(
      buildInfrastructure([ACTIONS], { test: 'vitest run', 'test:e2e': 'playwright test' }),
      '.github/workflows/ci.yml',
    );
    // L'assertion porte sur une vraie étape, pas sur une chaîne : le workflow
    // mentionne `test:e2e` dans un commentaire, et c'est voulu.
    const steps = ci.split('\n').filter((line) => /^\s*- run:/.test(line));
    expect(steps.some((step) => step.includes('test:e2e'))).toBe(false);
  });

  it('explique comment les activer plutôt que de les taire', () => {
    const ci = fileNamed(
      buildInfrastructure([ACTIONS], { 'test:e2e': 'playwright test' }),
      '.github/workflows/ci.yml',
    );
    expect(ci).toContain('playwright install --with-deps');
  });

  it('ne dit rien des tests de bout en bout quand il n’y en a pas', () => {
    const ci = fileNamed(buildInfrastructure([ACTIONS], { test: 'x' }), '.github/workflows/ci.yml');
    expect(ci).not.toContain('playwright');
  });
});

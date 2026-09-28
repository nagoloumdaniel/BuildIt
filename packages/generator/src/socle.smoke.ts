import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Manifest } from '@project-factory/manifest';
import { afterAll, describe, expect, it } from 'vitest';
import { CI_SCRIPTS } from './infrastructure.js';
import { generateProject, PIPELINE_STEPS } from './pipeline.js';

/**
 * Le gate M3 en vrai : générer → `pnpm install` → chaque script que la CI
 * générée lancera. Si ce test passe, le workflow du projet généré est vert au
 * premier push.
 *
 * Lancé par `pnpm test:smoke` et par un job CI dédié, jamais par `pnpm test` :
 * il a besoin du réseau. Hors-ligne, il échoue franchement plutôt que de faire
 * semblant.
 */

interface SmokeProject {
  readonly manifest: Manifest;
  /**
   * Aller-retour avec une vraie base, via le docker-compose.yml généré.
   * Exige Docker ; sans lui, le test le dit et saute cette partie seulement.
   */
  readonly database?: { readonly service: string; readonly url: string };
  /** Recettes appliquées : leurs templates sont vérifiés contre les vrais paquets. */
  readonly recipes?: readonly string[];
}

const PROJECTS: Record<string, SmokeProject> = {
  'preset SaaS, avec ses deux recettes': {
    recipes: ['better-auth-email-password', 'stripe-checkout'],
    database: { service: 'postgres', url: 'postgresql://postgres:postgres@localhost:5432/app' },
    manifest: {
      manifestVersion: 1,
      name: 'quai3',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
      database: { engine: 'postgresql', orm: 'prisma' },
      auth: { provider: 'better-auth' },
      services: ['stripe', 'resend'],
      quality: ['biome', 'vitest', 'playwright'],
      infra: ['vercel', 'github-actions', 'docker', 'dev-container'],
    },
  },
  'socle React + TypeScript': {
    manifest: {
      manifestVersion: 1,
      name: 'minimal-react',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'react', language: 'typescript' },
      quality: ['biome', 'vitest'],
    },
  },
};

const roots: string[] = [];

// Le runner CI n'a pas d'identité Git ; le pipeline n'en invente jamais une,
// c'est donc au test de la fournir, par l'environnement.
process.env['GIT_AUTHOR_NAME'] ??= 'Smoke Test';
process.env['GIT_AUTHOR_EMAIL'] ??= 'smoke@example.invalid';
process.env['GIT_COMMITTER_NAME'] ??= 'Smoke Test';
process.env['GIT_COMMITTER_EMAIL'] ??= 'smoke@example.invalid';

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}

const DOCKER = dockerAvailable();
const composed: string[] = [];

function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
  input?: string,
): string {
  try {
    return execFileSync(command, args, {
      cwd,
      stdio: 'pipe',
      ...(input === undefined ? {} : { input }),
      env: { ...process.env, ...env },
      timeout: 300_000,
    }).toString();
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `${command} ${args.join(' ')} a échoué :\n${failure.stdout?.toString() ?? ''}${failure.stderr?.toString() ?? ''}`,
    );
  }
}

/**
 * La configuration générée joint-elle vraiment une base ? Le service du
 * docker-compose.yml généré démarre, `prisma db push` y crée une table
 * déclarée dans un fichier de schéma ajouté, et une requête la retrouve.
 */
async function databaseRoundTrip(target: string, service: string, url: string): Promise<void> {
  composed.push(target);
  run('docker', ['compose', 'up', '-d', '--wait', service], target);
  await writeFile(
    join(target, 'prisma/schema/smoke.prisma'),
    'model SmokeCheck {\n  id Int @id @default(autoincrement())\n}\n',
  );
  run('pnpm', ['exec', 'prisma', 'db', 'push'], target, { DATABASE_URL: url });
  const query = (sql: string) =>
    run('pnpm', ['exec', 'prisma', 'db', 'execute', '--stdin'], target, { DATABASE_URL: url }, sql);

  expect(() => query('SELECT count(*) FROM "SmokeCheck";')).not.toThrow();
  // Sonde négative : sans elle, une commande qui n'exécuterait rien passerait.
  expect(() => query('SELECT count(*) FROM "TableAbsente";')).toThrow();
}

afterAll(async () => {
  for (const target of composed) {
    try {
      execFileSync('docker', ['compose', 'down', '-v'], { cwd: target, stdio: 'ignore' });
    } catch {
      // Le nettoyage ne doit pas masquer l'échec du test lui-même.
    }
  }
  for (const root of roots) {
    await rm(root, { recursive: true, force: true });
  }
});

describe('un projet généré passe sa propre CI — gate M3', () => {
  for (const [label, { manifest, recipes, database }] of Object.entries(PROJECTS)) {
    it(label, async () => {
      const root = await mkdtemp(join(tmpdir(), 'pf-smoke-'));
      roots.push(root);
      const target = join(root, manifest.name);

      // Le pipeline complet, avec le vrai exécuteur : pnpm install, git, puis
      // les scripts que la CI générée lancera.
      const result = await generateProject(manifest, target, {
        install: true,
        git: true,
        validate: true,
        ...(recipes === undefined ? {} : { recipes }),
      });

      expect(result.ok, result.ok ? '' : result.issues.map((i) => i.message).join('\n')).toBe(true);
      if (result.ok) {
        expect(result.value.completedSteps).toEqual(PIPELINE_STEPS);
      }

      // Le verrou est commité : la CI générée installe en --frozen-lockfile.
      const { scripts } = JSON.parse(await readFile(join(target, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      expect(CI_SCRIPTS.some((name) => scripts[name] !== undefined)).toBe(true);
      await expect(readFile(join(target, 'pnpm-lock.yaml'), 'utf8')).resolves.toBeTruthy();

      if (database !== undefined) {
        if (DOCKER) {
          await databaseRoundTrip(target, database.service, database.url);
        } else {
          // Dit, jamais tu : sans Docker, la preuve « base réelle » manque.
          console.warn(`${label} : Docker indisponible, aller-retour avec la base NON vérifié.`);
        }
      }
    });
  }
});

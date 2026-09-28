import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
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
 * Lancé par `pnpm test:smoke` — et par le hook pre-push quand le push touche
 * generator, registry ou recipes —, jamais par `pnpm test` :
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
  /**
   * Parcours d'authentification réel : l'application construite démarre
   * contre la base, un compte est créé puis utilisé pour se connecter.
   * Exige `database`.
   */
  readonly signUp?: boolean;
  /** Recettes appliquées : leurs templates sont vérifiés contre les vrais paquets. */
  readonly recipes?: readonly string[];
}

const PROJECTS: Record<string, SmokeProject> = {
  'preset SaaS, avec ses recettes': {
    recipes: ['resend-transactional', 'stripe-checkout'],
    database: { service: 'postgres', url: 'postgresql://postgres:postgres@localhost:5432/app' },
    signUp: true,
    manifest: {
      manifestVersion: 1,
      name: 'quai3',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
      database: { engine: 'postgresql', orm: 'prisma' },
      auth: { provider: 'better-auth' },
      services: ['stripe', 'resend', 'sentry', 'posthog'],
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
/**
 * Pannes du registre d'images, pas du projet : quota Docker Hub, réseau.
 *
 * Elles sautent l'aller-retour avec un avertissement, comme l'absence de
 * Docker. Toute autre erreur de téléchargement — une image mal nommée dans le
 * docker-compose.yml généré, par exemple — reste un échec : c'est un défaut du
 * générateur, il ne doit pas passer pour une panne d'infrastructure.
 */
const REGISTRY_OUTAGE =
  /rate limit|toomanyrequests|i\/o timeout|TLS handshake timeout|connection refused|no such host|network is unreachable/i;

/** Télécharge l'image du service ; `false` si le registre est indisponible. */
function pullImage(target: string, service: string): boolean {
  try {
    run('docker', ['compose', 'pull', service], target);
    return true;
  } catch (error) {
    if (REGISTRY_OUTAGE.test(String(error))) {
      return false;
    }
    throw error;
  }
}

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

/** Port de l'application pendant le test : loin du 3000 des développeurs. */
const APP_PORT = 3456;

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`${url} ne répond pas après ${timeoutMs} ms`);
}

/**
 * Inscription puis connexion, par l'API de Better Auth, sur l'application
 * construite par l'étape de validation. Preuve que l'adaptateur Prisma, les
 * tables et la route Next.js fonctionnent ensemble — pas seulement qu'ils se
 * typent.
 */
async function signUpAndSignIn(target: string, databaseUrl: string): Promise<void> {
  const base = `http://localhost:${APP_PORT}`;
  const server = spawn('pnpm', ['start'], {
    cwd: target,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    },
  });
  try {
    await waitFor(base, 60_000);
    const credentials = { email: 'smoke@example.invalid', password: 'mot-de-passe-de-test-1' };
    const post = (path: string, body: object) =>
      fetch(`${base}/api/auth/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: base },
        body: JSON.stringify(body),
      });

    const signUp = await post('sign-up/email', { ...credentials, name: 'Smoke' });
    expect(signUp.status, await signUp.clone().text()).toBe(200);

    const signIn = await post('sign-in/email', credentials);
    expect(signIn.status, await signIn.clone().text()).toBe(200);
    expect(signIn.headers.get('set-cookie')).toContain('better-auth.session_token');

    // Sonde négative : un mauvais mot de passe doit être refusé.
    const wrong = await post('sign-in/email', { ...credentials, password: 'faux-mot-de-passe' });
    expect(wrong.status).toBe(401);
  } finally {
    server.kill();
  }
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
  for (const [label, { manifest, recipes, database, signUp }] of Object.entries(PROJECTS)) {
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
        if (DOCKER && !pullImage(target, database.service)) {
          console.warn(
            `${label} : registre d’images indisponible (quota ou réseau), aller-retour avec la base NON vérifié.`,
          );
        } else if (DOCKER) {
          await databaseRoundTrip(target, database.service, database.url);
          if (signUp === true) {
            await signUpAndSignIn(target, database.url);
          }
        } else {
          // Dit, jamais tu : sans Docker, la preuve « base réelle » manque.
          console.warn(`${label} : Docker indisponible, aller-retour avec la base NON vérifié.`);
        }
      }
    });
  }
});

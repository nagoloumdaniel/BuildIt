import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
   * Exige Docker ; sans lui, le test échoue, sauf PF_SMOKE_SKIP_DOCKER=1.
   */
  readonly database?: { readonly service: string; readonly url: string };
  /**
   * Parcours d'authentification réel : l'application construite démarre
   * contre la base, un compte est créé puis utilisé pour se connecter.
   * Exige `database`.
   */
  readonly signUp?: boolean;
  /**
   * Parcours du tableau de bord : redirection sans session, puis pages
   * servies avec les vraies données d'un compte créé. Exige `database`.
   */
  readonly dashboard?: boolean;
  /** Chemins que l'application construite doit servir en 200, sans base. */
  readonly http?: readonly string[];
  /**
   * L'image du Dockerfile généré se construit, démarre, et sert ce chemin en
   * 200. Exige Docker.
   */
  readonly image?: string;
  /**
   * Aller-retour avec le Redis du docker-compose.yml généré, par le client
   * généré (`lib/redis.ts`), exécuté avec tsx. Exige Docker.
   */
  readonly cache?: { readonly service: string; readonly url: string };
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
  'preset Dashboard': {
    recipes: ['dashboard-admin'],
    database: { service: 'postgres', url: 'postgresql://postgres:postgres@localhost:5432/app' },
    dashboard: true,
    manifest: {
      manifestVersion: 1,
      name: 'tableau',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
      database: { engine: 'postgresql', orm: 'prisma' },
      auth: { provider: 'better-auth' },
      quality: ['biome', 'vitest', 'playwright'],
      infra: ['docker', 'github-actions'],
    },
  },
  'preset API': {
    database: { service: 'postgres', url: 'postgresql://postgres:postgres@localhost:5432/app' },
    http: ['/health', '/openapi.json'],
    image: '/health',
    cache: { service: 'redis', url: 'redis://localhost:6379' },
    manifest: {
      manifestVersion: 1,
      name: 'api-quai3',
      targets: ['api'],
      architecture: 'single-app',
      backend: { framework: 'hono', language: 'typescript' },
      database: { engine: 'postgresql', orm: 'prisma' },
      services: ['redis'],
      quality: ['biome', 'vitest'],
      infra: ['docker', 'github-actions'],
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
  /rate limit|toomanyrequests|too many requests|\b429\b|i\/o timeout|TLS handshake timeout|connection refused|no such host|network is unreachable/i;

/**
 * Télécharge l'image du service si elle manque. Une panne du registre (quota,
 * réseau) n'est pas un défaut du projet, mais la preuve manque quand même :
 * le test échoue en le disant, avec la marche à suivre.
 */
function requireImage(target: string, service: string): void {
  try {
    // `missing` : une image déjà présente ne recontacte pas le registre, donc
    // ne consomme pas de quota.
    run('docker', ['compose', 'pull', '--policy', 'missing', service], target);
  } catch (error) {
    if (REGISTRY_OUTAGE.test(String(error))) {
      throw new Error(
        `Registre d’images indisponible (quota ou réseau) pour « ${service} ». Relancez plus tard, ou PF_SMOKE_SKIP_DOCKER=1 pour sauter explicitement les preuves Docker — et dites-le dans la PR.`,
      );
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
 * Démarre l'application construite (`pnpm start`), attend qu'elle réponde,
 * exécute `check`, puis l'arrête.
 *
 * Le serveur tourne dans son propre groupe de processus : tuer `pnpm` seul
 * laisserait vivre le `node` qu'il a lancé, et le projet suivant trouverait le
 * port occupé.
 */
async function withRunningApp(
  target: string,
  env: NodeJS.ProcessEnv,
  check: (base: string) => Promise<void>,
): Promise<void> {
  const base = `http://localhost:${APP_PORT}`;
  // Un port qui répond déjà ferait tester une autre application — celle du
  // projet précédent, en train de s'arrêter — sans que rien ne le signale.
  const occupied = await fetch(base).then(
    () => true,
    () => false,
  );
  if (occupied) {
    throw new Error(`Le port ${APP_PORT} répond déjà : impossible de tester ${target}.`);
  }
  const server = spawn('pnpm', ['start'], {
    cwd: target,
    stdio: 'ignore',
    detached: true,
    env: { ...process.env, PORT: String(APP_PORT), ...env },
  });
  try {
    await waitFor(base, 60_000);
    await check(base);
  } finally {
    // Attendre la fin réelle du groupe : le projet suivant reprend ce port.
    const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()));
    if (server.pid !== undefined && server.exitCode === null) {
      process.kill(-server.pid, 'SIGTERM');
      await exited;
    }
    const deadline = Date.now() + 15_000;
    while (
      Date.now() < deadline &&
      (await fetch(base).then(
        () => true,
        () => false,
      ))
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

/**
 * Construit l'image du Dockerfile généré, la lance, vérifie un chemin.
 *
 * Derrière un proxy TLS d'entreprise, les conteneurs ne connaissent pas son
 * certificat : `PF_SMOKE_DOCKER_CA=<fichier.crt>` fait construire une **copie**
 * du Dockerfile qui lui fait confiance, sur le réseau de l'hôte (où vit le
 * proxy). Le Dockerfile généré n'est jamais modifié ; sans la variable, c'est
 * lui qui est construit, tel quel.
 */
async function imageServes(target: string, path: string): Promise<void> {
  const tag = `pf-smoke-${randomBytes(4).toString('hex')}`;
  const ca = process.env['PF_SMOKE_DOCKER_CA'];
  const args = ['build', '-t', tag];
  if (ca !== undefined && ca !== '') {
    await copyFile(ca, join(target, 'smoke-proxy-ca.crt'));
    const original = await readFile(join(target, 'Dockerfile'), 'utf8');
    await writeFile(
      join(target, 'Dockerfile.smoke'),
      original.replace(
        'WORKDIR /app',
        'COPY smoke-proxy-ca.crt /smoke-proxy-ca.crt\nENV NODE_EXTRA_CA_CERTS=/smoke-proxy-ca.crt\nWORKDIR /app',
      ),
    );
    args.push('-f', 'Dockerfile.smoke', '--network', 'host');
    for (const name of ['HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY']) {
      if (process.env[name] !== undefined) {
        args.push('--build-arg', name);
      }
    }
  }
  try {
    run('docker', [...args, '.'], target);
  } catch (error) {
    if (REGISTRY_OUTAGE.test(String(error))) {
      throw new Error(
        'Registre d’images indisponible (quota ou réseau) pour l’image de base du Dockerfile. Relancez plus tard, ou PF_SMOKE_SKIP_DOCKER=1 pour sauter explicitement les preuves Docker — et dites-le dans la PR.',
      );
    }
    throw error;
  }
  try {
    run('docker', ['run', '-d', '--name', tag, '-p', `${APP_PORT}:3000`, tag], target);
    const base = `http://localhost:${APP_PORT}`;
    await waitFor(base, 60_000);
    const response = await fetch(`${base}${path}`);
    expect(response.status, `${path} dans le conteneur`).toBe(200);
    // Jamais root dans le conteneur (§24).
    expect(run('docker', ['exec', tag, 'id', '-u'], target).trim()).not.toBe('0');
  } finally {
    try {
      execFileSync('docker', ['rm', '-f', tag], { stdio: 'ignore' });
      execFileSync('docker', ['rmi', '-f', tag], { stdio: 'ignore' });
    } catch {
      // Le nettoyage ne doit pas masquer l'échec du test lui-même.
    }
  }
}

/** Le client Redis généré se connecte et obtient PONG — pas seulement il se type. */
function cacheRoundTrip(target: string, service: string, url: string): void {
  composed.push(target);
  run('docker', ['compose', 'up', '-d', '--wait', service], target);
  const script =
    "import('./lib/redis.ts').then(async ({ redis }) => { const client = await redis(); " +
    'console.log(await client.ping()); await client.quit(); })';
  const output = run('pnpm', ['exec', 'tsx', '--eval', script], target, { REDIS_URL: url });
  expect(output).toContain('PONG');
}

/**
 * Le tableau de bord de bout en bout, sur l'application construite et une
 * vraie base : sans session, on est renvoyé à la connexion ; avec un compte
 * créé par l'API, chaque page s'affiche avec ses données.
 */
async function dashboardJourney(target: string, databaseUrl: string): Promise<void> {
  const env = {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: `http://localhost:${APP_PORT}`,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  };
  await withRunningApp(target, env, async (base) => {
    const anonymous = await fetch(`${base}/dashboard`);
    expect(new URL(anonymous.url).pathname, 'sans session').toBe('/sign-in');
    expect(await anonymous.text()).toContain('Connexion');

    const email = 'admin@example.invalid';
    const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: base },
      body: JSON.stringify({ email, password: 'mot-de-passe-de-test-1', name: 'Admin' }),
    });
    expect(signUp.status, await signUp.clone().text()).toBe(200);
    const cookie = signUp.headers
      .getSetCookie()
      .map((header) => header.split(';')[0])
      .join('; ');

    const page = async (path: string) => {
      const response = await fetch(`${base}${path}`, { headers: { cookie } });
      expect(response.status, path).toBe(200);
      expect(new URL(response.url).pathname, `${path} avec session`).toBe(path);
      return response.text();
    };
    expect(await page('/dashboard')).toContain('Vue d’ensemble');
    expect(await page('/dashboard/users')).toContain(email);
    expect(await page('/dashboard/settings')).toContain(email);
  });
}

/** Chaque chemin répond 200 : l'application construite démarre et sert ses routes. */
async function expectPaths(target: string, paths: readonly string[]): Promise<void> {
  await withRunningApp(target, {}, async (base) => {
    for (const path of paths) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, `${path} : ${await response.clone().text()}`).toBe(200);
    }
  });
}

/**
 * Inscription puis connexion, par l'API de Better Auth, sur l'application
 * construite par l'étape de validation. Preuve que l'adaptateur Prisma, les
 * tables et la route Next.js fonctionnent ensemble — pas seulement qu'ils se
 * typent.
 */
async function signUpAndSignIn(target: string, databaseUrl: string): Promise<void> {
  const env = {
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_URL: `http://localhost:${APP_PORT}`,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  };
  await withRunningApp(target, env, async (base) => {
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
  });
}

/** Arrête les services d'un projet : le suivant reprend les mêmes ports. */
function composeDown(target: string): void {
  try {
    execFileSync('docker', ['compose', 'down', '-v'], { cwd: target, stdio: 'ignore' });
  } catch {
    // Le nettoyage ne doit pas masquer l'échec du test lui-même.
  }
}

afterAll(async () => {
  // Filet : un projet arrêté en cours de route n'a pas pu nettoyer lui-même.
  for (const target of composed) {
    composeDown(target);
  }
  for (const root of roots) {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * Les preuves les plus fortes exigent Docker : base réelle, Redis, image. Sans
 * Docker, le test **échoue** — une réussite qui aurait sauté ses preuves en
 * silence serait un mensonge. `PF_SMOKE_SKIP_DOCKER=1` les saute
 * explicitement, et chacune apparaît alors comme « skipped » dans le compte.
 */
const SKIP_DOCKER = process.env['PF_SMOKE_SKIP_DOCKER'] === '1';

function requireDocker(): void {
  if (!DOCKER) {
    throw new Error(
      'Docker est indisponible : les preuves base de données, Redis et image ne peuvent pas tourner. Démarrez Docker, ou relancez avec PF_SMOKE_SKIP_DOCKER=1 pour les sauter explicitement — et dites-le dans la PR.',
    );
  }
}

describe('un projet généré passe sa propre CI — gate M3', () => {
  for (const [
    label,
    { manifest, recipes, database, signUp, dashboard, http, image, cache },
  ] of Object.entries(PROJECTS)) {
    describe(label, () => {
      let target = '';

      /** Les preuves suivantes portent sur le projet produit par la première. */
      function generated(): string {
        if (target === '') {
          throw new Error('Le projet n’a pas été généré : voir le premier test de ce groupe.');
        }
        return target;
      }

      it('génère, installe, et passe lint, typecheck, test et build', async () => {
        const root = await mkdtemp(join(tmpdir(), 'pf-smoke-'));
        roots.push(root);
        const destination = join(root, manifest.name);

        // Le pipeline complet, avec le vrai exécuteur : pnpm install, git, puis
        // les scripts que la CI générée lancera.
        const result = await generateProject(manifest, destination, {
          install: true,
          git: true,
          validate: true,
          ...(recipes === undefined ? {} : { recipes }),
        });

        expect(result.ok, result.ok ? '' : result.issues.map((i) => i.message).join('\n')).toBe(
          true,
        );
        if (result.ok) {
          expect(result.value.completedSteps).toEqual(PIPELINE_STEPS);
        }

        // Le verrou est commité : la CI générée installe en --frozen-lockfile.
        const { scripts } = JSON.parse(
          await readFile(join(destination, 'package.json'), 'utf8'),
        ) as { scripts: Record<string, string> };
        expect(CI_SCRIPTS.some((name) => scripts[name] !== undefined)).toBe(true);
        await expect(readFile(join(destination, 'pnpm-lock.yaml'), 'utf8')).resolves.toBeTruthy();
        target = destination;
      });

      if (http !== undefined) {
        it('l’application construite démarre et sert ses routes', async () => {
          await expectPaths(generated(), http);
        });
      }

      if (cache !== undefined) {
        it.skipIf(SKIP_DOCKER)('Redis réel : le client généré obtient PONG', () => {
          requireDocker();
          const project = generated();
          requireImage(project, cache.service);
          try {
            cacheRoundTrip(project, cache.service, cache.url);
          } finally {
            composeDown(project);
          }
        });
      }

      if (image !== undefined) {
        it.skipIf(SKIP_DOCKER)('image Docker : construite, démarrée, non root', async () => {
          requireDocker();
          await imageServes(generated(), image);
        });
      }

      if (database !== undefined) {
        const journey =
          signUp === true
            ? ', inscription et connexion'
            : dashboard === true
              ? ', parcours du tableau de bord'
              : '';
        it.skipIf(SKIP_DOCKER)(`PostgreSQL réel${journey}`, async () => {
          requireDocker();
          const project = generated();
          requireImage(project, database.service);
          try {
            await databaseRoundTrip(project, database.service, database.url);
            if (signUp === true) {
              await signUpAndSignIn(project, database.url);
            }
            if (dashboard === true) {
              await dashboardJourney(project, database.url);
            }
          } finally {
            composeDown(project);
          }
        });
      }
    });
  }
});

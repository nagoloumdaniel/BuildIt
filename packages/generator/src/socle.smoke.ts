import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Manifest } from '@project-factory/manifest';
import { afterAll, describe, expect, it } from 'vitest';
import { generateProject } from './pipeline.js';

/**
 * Le gate M3 en vrai : générer → `pnpm install` → chaque script que la CI
 * générée lancera. Si ce test passe, le workflow du projet généré est vert au
 * premier push.
 *
 * Lancé par `pnpm test:smoke` et par un job CI dédié, jamais par `pnpm test` :
 * il a besoin du réseau. Hors-ligne, il échoue franchement plutôt que de faire
 * semblant.
 */

/** Scripts lancés par la CI générée, dans le même ordre (infrastructure.ts). */
const CI_SCRIPTS = ['lint', 'typecheck', 'test', 'build'];

const PROJECTS: Record<string, Manifest> = {
  'preset SaaS': {
    manifestVersion: 1,
    name: 'quai3',
    targets: ['web'],
    architecture: 'single-app',
    frontend: { framework: 'next', language: 'typescript', styling: 'tailwind', ui: 'shadcn-ui' },
    database: { engine: 'postgresql', orm: 'prisma' },
    auth: { provider: 'better-auth' },
    services: ['stripe', 'resend'],
    quality: ['biome', 'vitest', 'playwright'],
    infra: ['vercel', 'github-actions'],
  },
  'socle React + TypeScript': {
    manifestVersion: 1,
    name: 'minimal-react',
    targets: ['web'],
    architecture: 'single-app',
    frontend: { framework: 'react', language: 'typescript' },
    quality: ['biome', 'vitest'],
  },
};

const roots: string[] = [];

afterAll(async () => {
  for (const root of roots) {
    await rm(root, { recursive: true, force: true });
  }
});

function pnpm(args: string[], cwd: string): void {
  try {
    execFileSync('pnpm', args, { cwd, stdio: 'pipe', env: { ...process.env, CI: 'true' } });
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `pnpm ${args.join(' ')} a échoué dans ${cwd} :\n${failure.stdout?.toString() ?? ''}${failure.stderr?.toString() ?? ''}`,
    );
  }
}

describe('un projet généré passe sa propre CI — gate M3', () => {
  for (const [label, manifest] of Object.entries(PROJECTS)) {
    it(label, async () => {
      const root = await mkdtemp(join(tmpdir(), 'pf-smoke-'));
      roots.push(root);
      const target = join(root, manifest.name);

      const result = await generateProject(manifest, target);
      expect(result.ok, result.ok ? '' : result.issues.map((i) => i.message).join(' | ')).toBe(
        true,
      );

      pnpm(['install'], target);

      const { scripts } = JSON.parse(await readFile(join(target, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      const ran = CI_SCRIPTS.filter((name) => scripts[name] !== undefined);
      // Un socle sans aucun script vérifiable ne prouverait rien.
      expect(ran.length).toBeGreaterThan(0);
      for (const name of ran) {
        pnpm(['run', name], target);
      }
    });
  }
});

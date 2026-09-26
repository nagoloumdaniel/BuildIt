import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Manifest } from '@project-factory/manifest';
import { afterEach, describe, expect, it } from 'vitest';
import { generateProject, planProject, selectionFromManifest } from './pipeline.js';
import { describePlan } from './plan.js';
import type { CommandResult, CommandRunner } from './postinstall.js';
import { nodeFileSystem } from './write.js';

/**
 * Le pipeline complet, du Manifest aux fichiers réellement posés sur le disque.
 *
 * C'est le seul test qui dit si le produit fait ce qu'il promet. Tous les
 * autres prouvent qu'un étage fait son travail ; celui-ci prouve qu'ils
 * s'enchaînent.
 */

const created: string[] = [];

async function tempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'pf-pipeline-'));
  created.push(path);
  return path;
}

afterEach(async () => {
  while (created.length > 0) {
    const path = created.pop();
    if (path !== undefined) {
      await rm(path, { recursive: true, force: true });
    }
  }
});

/** Le preset SaaS du §8, exprimé en manifest. */
const SAAS: Manifest = {
  manifestVersion: 1,
  name: 'quai3',
  targets: ['web'],
  architecture: 'single-app',
  frontend: {
    framework: 'next',
    language: 'typescript',
    styling: 'tailwind',
    ui: 'shadcn-ui',
  },
  database: { engine: 'postgresql', orm: 'prisma' },
  auth: { provider: 'better-auth' },
  services: ['stripe', 'resend'],
  quality: ['biome', 'vitest', 'playwright'],
  infra: ['vercel'],
};

describe('selectionFromManifest', () => {
  it('aplatit les rôles du manifest en un ensemble de technologies', () => {
    const selection = selectionFromManifest(SAAS);
    expect(selection.technologies).toContain('next');
    expect(selection.technologies).toContain('prisma');
    expect(selection.technologies).toContain('vitest');
    expect(selection.targets).toEqual(['web']);
  });

  it('ne répète pas une technologie citée deux fois', () => {
    const manifest: Manifest = {
      ...SAAS,
      services: ['vitest'],
      quality: ['vitest'],
    };
    const ids = selectionFromManifest(manifest).technologies;
    expect(ids.filter((id) => id === 'vitest')).toHaveLength(1);
  });

  it('gère un manifest minimal', () => {
    const minimal: Manifest = {
      manifestVersion: 1,
      name: 'x',
      targets: ['web'],
      architecture: 'single-app',
    };
    expect(selectionFromManifest(minimal).technologies).toEqual([]);
  });
});

describe('planProject — le dry-run', () => {
  it('produit un plan pour le preset SaaS', () => {
    const result = planProject(SAAS, '/cible');
    const problems = result.ok ? [] : result.issues.map((i) => `${i.code} : ${i.message}`);
    expect(problems).toEqual([]);
  });

  it('n’écrit rien', async () => {
    const target = await tempDir();
    planProject(SAAS, target);
    expect(await readdir(target)).toEqual([]);
  });

  it('rend une arborescence lisible', () => {
    const result = planProject(SAAS, '/cible');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const description = describePlan(result.value.plan);
      expect(description).toContain('package.json');
      expect(description).toContain('.env.example');
    }
  });

  it('signale une technologie inconnue avec les mots du compatibility engine', () => {
    const result = planProject({ ...SAAS, services: ['nexistepas'] }, '/cible');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('COMPAT_UNKNOWN_TECHNOLOGY');
    }
  });

  it('signale deux ORM avec les mots du compatibility engine', () => {
    const result = planProject({ ...SAAS, services: ['drizzle'] }, '/cible');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('COMPAT_EXCLUSIVE_CATEGORY');
    }
  });
});

describe('generateProject — le projet sur le disque', () => {
  it('écrit un projet complet', async () => {
    const target = join(await tempDir(), 'quai3');
    const result = await generateProject(SAAS, target);

    expect(result.ok).toBe(true);
    const files = (await readdir(target)).sort();
    // docker-compose.yml apparaît parce que PostgreSQL est dans la stack : le
    // projet est démarrable sans rien installer d'autre que Docker.
    expect(files).toEqual([
      '.env.example',
      '.gitignore',
      'README.md',
      'biome.json',
      'docker-compose.yml',
      'env.d.ts',
      'package.json',
      'pnpm-workspace.yaml',
      'tsconfig.json',
    ]);
  });

  it('écrit un package.json valide portant le nom du projet', async () => {
    const target = join(await tempDir(), 'quai3');
    await generateProject(SAAS, target);

    const json = JSON.parse(await readFile(join(target, 'package.json'), 'utf8')) as {
      name: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(json.name).toBe('quai3');
    expect(json.scripts['test']).toBe('vitest run --passWithNoTests');
    expect(json.scripts['lint']).toBe('biome check .');
    expect(json.dependencies['next']).toBeDefined();
  });

  it('écrit un .env.example sans aucune valeur — §24', async () => {
    const target = join(await tempDir(), 'quai3');
    await generateProject(SAAS, target);

    const contents = await readFile(join(target, '.env.example'), 'utf8');
    expect(contents).toContain('DATABASE_URL=');
    expect(contents).toContain('STRIPE_SECRET_KEY=');
    for (const line of contents.split('\n')) {
      if (line.length > 0 && !line.startsWith('#')) {
        expect(line.endsWith('='), `valeur présente : ${line}`).toBe(true);
      }
    }
  });

  it('écrit un README qui énonce la non-dépendance — §1', async () => {
    const target = join(await tempDir(), 'quai3');
    await generateProject(SAAS, target);

    const readme = await readFile(join(target, 'README.md'), 'utf8');
    expect(readme).toContain('quai3');
    expect(readme.toLowerCase()).toContain('autonome');
  });

  it('produit exactement ce que le dry-run annonçait', async () => {
    const target = join(await tempDir(), 'quai3');
    const plan = planProject(SAAS, target);
    expect(plan.ok).toBe(true);

    await generateProject(SAAS, target);

    if (plan.ok) {
      for (const file of plan.value.plan.files) {
        const written = await readFile(join(target, ...file.path.split('/')), 'utf8');
        expect(written, `divergence sur ${file.path}`).toBe(file.contents);
      }
    }
  });

  it('deux générations du même manifest produisent des fichiers identiques', async () => {
    const first = join(await tempDir(), 'a');
    const second = join(await tempDir(), 'b');
    await generateProject(SAAS, first);
    await generateProject(SAAS, second);

    for (const name of ['package.json', '.env.example', 'README.md']) {
      expect(await readFile(join(first, name), 'utf8')).toBe(
        await readFile(join(second, name), 'utf8'),
      );
    }
  });

  it('n’écrit rien quand un étage refuse', async () => {
    const parent = await tempDir();
    const target = join(parent, 'quai3');
    const result = await generateProject({ ...SAAS, services: ['drizzle'] }, target);

    expect(result.ok).toBe(false);
    expect(await readdir(parent)).toEqual([]);
  });

  it('accepte un système de fichiers injecté', async () => {
    const target = join(await tempDir(), 'quai3');
    const result = await generateProject(SAAS, target, { fs: nodeFileSystem });
    expect(result.ok).toBe(true);
  });

  it('ne lève jamais', async () => {
    const target = join(await tempDir(), 'quai3');
    await expect(
      generateProject({ ...SAAS, services: ['nexistepas'] }, target),
    ).resolves.toBeDefined();
  });
});

describe('le projet généré ne dépend pas de Project Factory — §1', () => {
  it('aucun fichier ne référence un paquet @project-factory', async () => {
    const target = join(await tempDir(), 'quai3');
    await generateProject(SAAS, target);

    for (const name of await readdir(target)) {
      const contents = await readFile(join(target, name), 'utf8');
      expect(contents, `dépendance résiduelle dans ${name}`).not.toContain('@project-factory/');
    }
  });

  it('le package.json ne contient aucune dépendance vers l’outil', async () => {
    const target = join(await tempDir(), 'quai3');
    await generateProject(SAAS, target);

    const json = JSON.parse(await readFile(join(target, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = { ...json.dependencies, ...json.devDependencies };
    for (const name of Object.keys(all)) {
      expect(name.startsWith('@project-factory/')).toBe(false);
    }
  });
});

describe('les avertissements remontent jusqu’au bout', () => {
  it('le plan porte l’avertissement de combinaison expérimentale', () => {
    const result = planProject(SAAS, '/cible');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings.map((w) => w.code)).toContain('COMPAT_EXPERIMENTAL_COMBINATION');
    }
  });

  it('toute la stack SaaS est épinglée — aucune version ouverte', () => {
    // Assertion plus forte que la propagation : elle porte sur les données
    // réelles. Si quelqu'un ajoute un paquet à une fiche du preset sans lui
    // donner de plage, ce test le dit — et la génération redeviendrait non
    // reproductible sans que personne ne s'en aperçoive.
    const result = planProject(SAAS, '/cible');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const unpinned = result.value.warnings
        .filter((warning) => warning.code === 'GEN_UNPINNED_DEPENDENCY')
        .map((warning) => warning.message);
      expect(unpinned).toEqual([]);
    }
  });

  it('aucun « * » dans le package.json généré', () => {
    const result = planProject(SAAS, '/cible');
    expect(result.ok).toBe(true);
    if (result.ok) {
      const packageJson = result.value.plan.files.find((file) => file.path === 'package.json');
      expect(packageJson?.contents).not.toContain('"*"');
    }
  });

  it('la génération les rend aussi — l’utilisateur les voit après écriture', async () => {
    const target = join(await tempDir(), 'quai3');
    const result = await generateProject(SAAS, target);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings.length).toBeGreaterThan(0);
      expect(result.value.report.written.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Les chemins d'erreur du pipeline. Ce sont ceux qui s'exécutent quand quelque
 * chose va mal — donc exactement ceux dont le comportement compte le plus.
 */
describe('chemins d’erreur', () => {
  it('remonte un conflit de script avec les mots du socle', () => {
    // vitest et jest réclament tous deux le script « test ».
    const result = planProject({ ...SAAS, quality: ['vitest', 'jest'] }, '/cible');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toContain('GEN_SCRIPT_CONFLICT');
    }
  });

  it('remonte un refus d’écriture avec les mots du générateur', async () => {
    const target = await tempDir();
    await writeFile(join(target, 'deja-la.txt'), 'important');

    const result = await generateProject(SAAS, target);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.code)).toContain('GEN_TARGET_NOT_EMPTY');
    }
  });

  it('un refus d’écriture laisse le contenu préexistant intact', async () => {
    const target = await tempDir();
    await writeFile(join(target, 'deja-la.txt'), 'important');
    await generateProject(SAAS, target);
    expect(await readFile(join(target, 'deja-la.txt'), 'utf8')).toBe('important');
  });
});

/**
 * Post Install, Validation et reprise (5B.2, 5B.3). L'exécuteur est factice :
 * aucun vrai pnpm, aucun vrai git.
 */
describe('post-install, validation et reprise — §22', () => {
  function fakeRunner(answers: Record<string, CommandResult> = {}): CommandRunner & {
    calls: string[];
  } {
    const calls: string[] = [];
    return {
      calls,
      async run(command, args) {
        const line = `${command} ${args.join(' ')}`;
        calls.push(line);
        return answers[line] ?? { exitCode: 0, output: '' };
      },
    };
  }
  const NOT_A_REPO: CommandResult = { exitCode: 128, output: 'fatal: not a git repository' };

  it('par défaut, aucune commande n’est lancée', async () => {
    const runner = fakeRunner();
    const result = await generateProject(SAAS, join(await tempDir(), 'p'), { runner });
    expect(result.ok).toBe(true);
    expect(runner.calls).toEqual([]);
    if (result.ok) {
      expect(result.value.completedSteps).toEqual(['plan', 'write']);
    }
  });

  it('enchaîne install → git → validation, dans cet ordre', async () => {
    const runner = fakeRunner({ 'git rev-parse --show-prefix': NOT_A_REPO });
    const result = await generateProject(SAAS, join(await tempDir(), 'p'), {
      runner,
      install: true,
      git: true,
      validate: true,
    });
    expect(result.ok).toBe(true);
    // Le commit suit l'installation : le fichier de verrouillage en fait partie,
    // et la CI générée l'exige (--frozen-lockfile).
    expect(runner.calls).toEqual([
      'pnpm install',
      'git rev-parse --show-prefix',
      'git init --initial-branch=main',
      'git add --all',
      'git commit --message chore: initial commit',
      'pnpm run lint',
      'pnpm run typecheck',
      'pnpm run test',
    ]);
    if (result.ok) {
      expect(result.value.completedSteps).toEqual(['plan', 'write', 'install', 'git', 'validate']);
    }
  });

  it('un échec réseau à l’installation est reprenable, et les fichiers restent', async () => {
    const target = join(await tempDir(), 'p');
    const result = await generateProject(SAAS, target, {
      runner: fakeRunner({ 'pnpm install': { exitCode: 1, output: 'ECONNRESET' } }),
      install: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedStep).toBe('install');
      expect(result.retryable).toBe(true);
      expect(result.completedSteps).toEqual(['plan', 'write']);
    }
    await expect(readFile(join(target, 'package.json'), 'utf8')).resolves.toContain('quai3');
  });

  it('reprise fromStep install : n’écrit rien, relance l’installation', async () => {
    const target = join(await tempDir(), 'p');
    await generateProject(SAAS, target);
    const before = (await readdir(target)).sort();

    const runner = fakeRunner();
    const resumed = await generateProject(SAAS, target, {
      runner,
      install: true,
      fromStep: 'install',
    });

    // Le dossier n'est plus vide : sans la reprise, l'écriture refuserait.
    expect(resumed.ok).toBe(true);
    expect(runner.calls).toEqual(['pnpm install']);
    expect((await readdir(target)).sort()).toEqual(before);
    if (resumed.ok) {
      expect(resumed.value.completedSteps).toEqual(['plan', 'install']);
      expect(resumed.value.report.written).toEqual([]);
    }
  });

  it('reprise fromStep validate : saute install et git même demandés', async () => {
    const target = join(await tempDir(), 'p');
    await generateProject(SAAS, target);
    const runner = fakeRunner();
    await generateProject(SAAS, target, {
      runner,
      install: true,
      git: true,
      validate: true,
      fromStep: 'validate',
    });
    expect(runner.calls.every((call) => call.startsWith('pnpm run'))).toBe(true);
  });

  it('un manifest refusé échoue à l’étage plan, sans reprise possible', async () => {
    const result = await generateProject(
      { ...SAAS, quality: ['vitest', 'jest'] },
      join(await tempDir(), 'p'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedStep).toBe('plan');
      expect(result.retryable).toBe(false);
      expect(result.completedSteps).toEqual([]);
    }
  });

  it('une écriture refusée échoue à l’étage write', async () => {
    const target = await tempDir();
    await writeFile(join(target, 'deja-la.txt'), 'important');
    const result = await generateProject(SAAS, target);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedStep).toBe('write');
    }
  });

  it('une validation qui échoue le dit, sans reprise : c’est un défaut du générateur', async () => {
    const result = await generateProject(SAAS, join(await tempDir(), 'p'), {
      runner: fakeRunner({ 'pnpm run typecheck': { exitCode: 2, output: 'error TS2322' } }),
      validate: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedStep).toBe('validate');
      expect(result.retryable).toBe(false);
      expect(result.issues[0]?.code).toBe('GEN_VALIDATION_FAILED');
    }
  });

  it('un git qui échoue nomme l’étage git', async () => {
    const result = await generateProject(SAAS, join(await tempDir(), 'p'), {
      runner: fakeRunner({
        'git rev-parse --show-prefix': NOT_A_REPO,
        'git commit --message chore: initial commit': { exitCode: 1, output: 'who are you' },
      }),
      git: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedStep).toBe('git');
    }
  });

  it('un projet dans un dépôt existant : avertissement, pas d’échec', async () => {
    const result = await generateProject(SAAS, join(await tempDir(), 'p'), {
      runner: fakeRunner({ 'git rev-parse --show-prefix': { exitCode: 0, output: 'apps/p/' } }),
      git: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings.map((warning) => warning.code)).toContain('GEN_GIT_NESTED');
      expect(result.value.completedSteps).not.toContain('git');
    }
  });
});

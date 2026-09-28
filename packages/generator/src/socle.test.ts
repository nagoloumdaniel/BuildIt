import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Manifest } from '@project-factory/manifest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateProject, planProject } from './pipeline.js';

/**
 * Le socle généré, soumis aux outils qu'il déclare — sans réseau.
 *
 * Les autres tests prouvent que chaque étage produit ce qu'on attend de lui.
 * Celui-ci prouve que le résultat **passe ses propres vérifications** : c'est
 * ce que 99 % de couverture n'avait pas vu (Phase 5B.1). Il utilise le `tsc` et
 * le `biome` du dépôt, ce qui le rend rapide et hors-ligne ; le test de fumée
 * (`pnpm test:smoke`) refait la même chose avec les versions installées par le
 * projet généré lui-même.
 */

const require = createRequire(import.meta.url);

function binary(pkg: string, name: string): string {
  const manifestPath = require.resolve(`${pkg}/package.json`);
  const bin = (require(manifestPath) as { bin: Record<string, string> }).bin[name];
  if (bin === undefined) {
    throw new Error(`binaire ${name} introuvable dans ${pkg}`);
  }
  return join(dirname(manifestPath), bin);
}

/** Lance un outil dans le projet généré ; renvoie sa sortie en cas d'échec. */
function run(bin: string, args: string[], cwd: string): string | undefined {
  try {
    execFileSync(process.execPath, [bin, ...args], { cwd, stdio: 'pipe' });
    return undefined;
  } catch (error) {
    const failure = error as { stdout?: Buffer; stderr?: Buffer };
    return `${failure.stdout?.toString() ?? ''}${failure.stderr?.toString() ?? ''}`;
  }
}

const SAAS: Manifest = {
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
};

let root: string;
let target: string;
/** Chemins produits par un template certifie — hors perimetre hors-ligne. */
let fromTemplates: string[] = [];

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'pf-socle-'));
  target = join(root, 'quai3');
  const planned = planProject(SAAS, target);
  if (planned.ok) {
    // Derive du plan plutot qu'ecrite en dur : la liste suit les templates
    // sans qu'on ait a la maintenir.
    fromTemplates = planned.value.plan.files
      .filter((file) => file.source.startsWith('template:'))
      .map((file) => file.path.split('/')[0] ?? file.path);
    // Le code d'une intégration par combinaison (`integration:prisma+postgresql`)
    // importe lui aussi des paquets — client Prisma, adaptateur : même
    // périmètre que les templates, fichier par fichier.
    fromTemplates.push(
      ...planned.value.plan.files
        .filter((file) => /^integration:[^+]+\+/.test(file.source))
        .map((file) => file.path),
    );
    fromTemplates = [...new Set(fromTemplates)];
  }
  const result = await generateProject(SAAS, target);
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(' | '));
  }
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('le socle SaaS passe ses propres vérifications — 5B.1', () => {
  it('typecheck : la configuration et les fichiers sans dépendance sont propres', () => {
    // Ce test tourne hors-ligne : le `node_modules` du projet généré n'existe
    // pas. Du code React ne peut donc pas être typé ici — ni ses imports, ni
    // `JSX.IntrinsicElements`, ni les types de ses props.
    //
    // J'ai d'abord filtré les codes d'erreur concernés. La liste s'allongeait à
    // chaque exécution : signe que le test cherchait à faire hors-ligne quelque
    // chose qui demande les dépendances. Le périmètre est donc explicite —
    // `app/` et `components/` appartiennent à `pnpm test:smoke`, qui installe
    // réellement. Ce qui reste ici garde tout son sens : tsconfig valide,
    // `env.d.ts` cohérent, aucune erreur de syntaxe dans un template.
    const scoped = join(target, 'tsconfig.socle.json');
    writeFileSync(
      scoped,
      `${JSON.stringify(
        { extends: './tsconfig.json', exclude: ['node_modules', 'dist', ...fromTemplates] },
        null,
        2,
      )}\n`,
    );
    const output = run(binary('typescript', 'tsc'), ['--noEmit', '-p', scoped], target) ?? '';
    rmSync(scoped);

    const errors = output.split('\n').filter((line) => line.includes('error TS'));
    expect(errors).toEqual([]);
  });

  it('sonde négative : une erreur de type autre qu’un module absent est vue', () => {
    // Sans cette sonde, le filtre ci-dessus pourrait tout masquer sans qu'on
    // le sache.
    const probe = join(target, 'sonde.ts');
    writeFileSync(probe, 'export const x: number = "pas un nombre";\n');
    const output = run(binary('typescript', 'tsc'), ['--noEmit', '-p', '.'], target) ?? '';
    rmSync(probe);
    expect(output).toContain('error TS2322');
  });

  it('lint : biome check passe avec la configuration générée', () => {
    expect(run(binary('@biomejs/biome', 'biome'), ['check', '.'], target)).toBeUndefined();
  });

  it('sonde négative : sans biome.json, le même contrôle échoue', async () => {
    // Le garde-fou n'est validé que s'il sait rejeter : retirer la
    // configuration doit faire retomber Biome sur les tabulations.
    await rm(join(target, 'biome.json'));
    expect(run(binary('@biomejs/biome', 'biome'), ['check', '.'], target)).toBeDefined();
  });
});

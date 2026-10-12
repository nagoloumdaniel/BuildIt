import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from '../../../lib/draft';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { generateProjectAction, previewManifestAction, workspaceRootAction } from '../../actions';

/**
 * L'exécution réelle de la chaîne Blueprint → Preview → Generate → Report :
 * le brouillon devient manifest canonique (`draftToManifest`), le plan est
 * annoncé **sans écriture** (`previewManifestAction`), puis le projet est
 * réellement écrit sous `PF_WEB_WORKSPACE` (`generateProjectAction`).
 *
 * Ce que ces tests prouvent n'est pas Next : c'est que l'écran Preview annonce
 * exactement ce que la génération écrit, que le dossier de destination n'existe
 * pas avant le clic, et qu'un dossier déjà pris est refusé sans être écrasé.
 */

const created: string[] = [];

afterEach(async () => {
  // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` interdit l'accès par point sur `process.env` (signature d'index) — les crochets sont obligatoires ici.
  delete process.env['PF_WEB_WORKSPACE'];
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  created.push(root);
  // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` interdit l'accès par point sur `process.env` (signature d'index) — les crochets sont obligatoires ici.
  process.env['PF_WEB_WORKSPACE'] = root;
  return root;
}

/** Le brouillon équivalent au preset SaaS, saisi aux écrans 1 à 9. */
function saasDraft(): DraftState {
  return {
    ...freshDraft(),
    step: 'generate',
    name: 'mon-projet',
    targets: ['web'],
    type: 'saas',
    architecture: 'single-app',
    technologies: [
      'next',
      'typescript',
      'tailwind',
      'shadcn-ui',
      'postgresql',
      'prisma',
      'better-auth',
      'biome',
      'vitest',
      'playwright',
      'vercel',
    ],
    capabilities: ['stripe', 'resend', 'sentry', 'posthog'],
    envVarNames: ['DATABASE_URL', 'BETTER_AUTH_SECRET'],
    infra: { docker: true, ci: true },
  };
}

describe('la chaîne Preview → Generate, exécutée pour de vrai', () => {
  it('écrit sous la racine affichée, et le plan annoncé est le plan écrit', async () => {
    const root = await temporaryRoot('pf-web-chaine-');
    expect(await workspaceRootAction()).toBe(root);

    const manifest = draftToManifest(saasDraft());
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) {
      return;
    }

    const preview = await previewManifestAction(manifest.value);
    expect(preview.files).toContain('package.json');
    expect(preview.files).toContain('Dockerfile');
    expect(preview.files).toContain('.github/workflows/ci.yml');

    // Avant l'appel, rien n'existe : l'aperçu est bien un dry-run.
    const directory = join(root, 'mon-projet');
    await expect(readFile(join(directory, 'package.json'), 'utf8')).rejects.toThrow();

    const report = await generateProjectAction(manifest.value);
    expect(report.ok).toBe(true);
    expect(report.directory).toBe(directory);
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.steps).toEqual(['plan', 'write']);

    // Le fichier est réellement là, et son nom est celui du projet.
    const packageJson = await readFile(join(directory, 'package.json'), 'utf8');
    expect(JSON.parse(packageJson).name).toBe('mon-projet');

    // Et l'écran Preview n'a annoncé aucun fichier qui n'existe pas.
    for (const file of preview.files) {
      const written = await readFile(join(directory, ...file.split('/')), 'utf8');
      expect(written.length).toBeGreaterThan(0);
    }
    for (const file of report.files) {
      expect(preview.files).toContain(file);
    }
  });

  it('refuse un dossier déjà pris, et laisse le premier projet intact', async () => {
    await temporaryRoot('pf-web-refus-');
    const manifest = draftToManifest(saasDraft());
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) {
      return;
    }

    const first = await generateProjectAction(manifest.value);
    expect(first.ok).toBe(true);

    const second = await generateProjectAction(manifest.value);
    expect(second.ok).toBe(false);
    expect(second.issues.join(' ')).toContain('existe déjà');
    expect(second.files).toEqual([]);

    // Un refus ne porte pas de dossier : `refused()` rend `directory: ''`.
    // L'écran Generate, lui, garde le dossier affiché avant l'écriture.
    expect(second.directory).toBe('');
    const packageJson = await readFile(join(first.directory, 'package.json'), 'utf8');
    expect(JSON.parse(packageJson).name).toBe('mon-projet');
  });

  it('un brouillon incomplet donne un manifest refusé, donc aucun refus d’écriture surprise', () => {
    const manifest = draftToManifest({ ...freshDraft(), name: 'mon-projet' });
    expect(manifest.ok).toBe(false);
  });
});

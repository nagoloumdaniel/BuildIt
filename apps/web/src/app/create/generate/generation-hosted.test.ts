import { readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from '../../../lib/draft';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { generateProjectAction } from '../../actions';

/**
 * Génération en mode hébergé (Phase 12, §3) : au lieu d'écrire dans le dossier
 * de travail partagé (`PF_WEB_WORKSPACE`), chaque requête écrit dans son
 * propre répertoire temporaire isolé (`fs.mkdtempSync`), produit une archive
 * `.zip`, puis nettoie ce répertoire — jamais d'écriture partagée entre
 * visiteurs anonymes.
 */

afterEach(() => {
  delete process.env['VERCEL'];
});

function saasDraft(): DraftState {
  return {
    ...freshDraft(),
    step: 'generate',
    name: 'mon-projet-heberge',
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

describe('generateProjectAction en mode hébergé (VERCEL=1)', () => {
  it('rend une archive zip plutôt que d’écrire sur un disque partagé', async () => {
    process.env['VERCEL'] = '1';
    const manifest = draftToManifest(saasDraft());
    expect(manifest.ok).toBe(true);
    if (!manifest.ok) {
      return;
    }

    const before = await readdir(tmpdir());
    const report = await generateProjectAction(manifest.value);

    expect(report.ok).toBe(true);
    expect(typeof report.zipBase64).toBe('string');
    expect(report.files).toContain('package.json');
    expect(report.bytes).toBeGreaterThan(0);

    const zip = Buffer.from(report.zipBase64 ?? '', 'base64');
    expect(zip.subarray(0, 4).toString('latin1')).toBe('PK\x03\x04');
    expect(zip.includes(Buffer.from('mon-projet-heberge'))).toBe(true);

    // Le répertoire temporaire isolé a été nettoyé : rien de nouveau ne traîne
    // sous `os.tmpdir()` après l'appel.
    const after = await readdir(tmpdir());
    const leftover = after.filter(
      (entry) => !before.includes(entry) && entry.startsWith('buildit-hosted-'),
    );
    expect(leftover).toEqual([]);
  });

  it('un brouillon invalide est refusé sans toucher au disque', async () => {
    process.env['VERCEL'] = '1';
    const report = await generateProjectAction({});
    expect(report.ok).toBe(false);
    expect(report.zipBase64).toBeUndefined();
  });
});

import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nodeFileSystem, selectionFromManifest } from '@buildit/generator';
import { parseManifest } from '@buildit/manifest';
import { getPreset } from '@buildit/presets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listPresets, previewPlan, resolveSelection, stackOptions } from './engine';

/**
 * L'adaptateur est testé contre le **vrai** catalogue et le **vrai** preset :
 * c'est la seule façon de voir qu'une signature du plan a dérivé des sources.
 */

describe('stackOptions', () => {
  it('liste les options d’une catégorie avec leur état', async () => {
    const options = await stackOptions('frontend', { targets: ['web'], technologies: ['next'] });

    expect(options.length).toBeGreaterThan(0);
    const next = options.find((option) => option.id === 'next');
    expect(next).toBeDefined();
    expect(next?.state).toBe('selected');
    expect(next?.label).toBeTruthy();
    expect(next?.category).toBe('frontend');
  });

  it('une option encore libre est disponible', async () => {
    const options = await stackOptions('frontend', { targets: ['web'], technologies: [] });
    const next = options.find((option) => option.id === 'next');
    expect(next?.state).toBe('available');
  });

  it('une option incompatible est bloquée avec une raison lisible (§5)', async () => {
    const options = await stackOptions('frontend', { targets: ['mobile'], technologies: [] });

    const blocked = options.filter((option) => option.state === 'blocked');
    expect(blocked.length).toBeGreaterThan(0);
    // L'invariant du §5 : bloquée *et* expliquée. Une option grisée sans raison
    // ne dit rien à l'utilisateur — c'est pire que de l'avoir masquée.
    for (const option of blocked) {
      expect(option.reason).toBeTruthy();
    }
  });
});

describe('resolveSelection', () => {
  it('la sélection du preset SaaS résout en certified, avec le vrai catalogue', async () => {
    const saas = getPreset('saas');
    expect(saas).toBeDefined();
    if (saas === undefined) return;

    const selection = selectionFromManifest(saas.manifest('essai'));
    const resolution = await resolveSelection(selection);

    expect(resolution.status).toBe('certified');
    expect(resolution.issues).toEqual([]);
  });

  it('une sélection incohérente rend des problèmes lisibles', async () => {
    const resolution = await resolveSelection({ targets: ['mobile'], technologies: ['next'] });

    expect(resolution.status).toBe('experimental');
    expect(resolution.issues.length).toBeGreaterThan(0);
    // Un message, pas un code : l'écran l'affiche tel quel (§12).
    expect(resolution.issues[0]).toMatch(/next/i);
    expect(resolution.issues[0]).not.toContain('[object');
  });

  /**
   * Bug rapporté : un framework frontend choisi seul affichait « Combinaison
   * certifiée », aucun problème — puis le Blueprint refusait le manifest
   * (`frontend.language` obligatoire, §10) sans que rien ne l'ait annoncé sur
   * l'écran où le choix a été fait. Le moteur de compatibilité ignore à bon
   * droit `language` (ce n'est pas un conflit de combinaison) ; c'est donc ici,
   * à la frontière web, que l'écart avec le schéma du manifest doit être dit.
   */
  it('un framework web choisi sans langage n’est plus « certifié » en silence', async () => {
    const resolution = await resolveSelection({ targets: ['web'], technologies: ['next'] });

    expect(resolution.issues.length).toBeGreaterThan(0);
    expect(resolution.issues.join(' ')).toMatch(/langage/i);
  });

  it('le langage choisi fait taire l’alerte — plus de faux positif une fois complet', async () => {
    const resolution = await resolveSelection({
      targets: ['web'],
      technologies: ['next', 'typescript'],
    });
    expect(resolution.status).toBe('certified');
    expect(resolution.issues).toEqual([]);
  });

  it('aucun framework choisi : pas d’alerte langage prématurée', async () => {
    const resolution = await resolveSelection({ targets: ['web'], technologies: [] });
    expect(resolution.issues.filter((issue) => /langage/i.test(issue))).toEqual([]);
  });
});

describe('listPresets', () => {
  it('expose les quatre presets certifiés', () => {
    const ids = listPresets().map((preset) => preset.id);
    expect(ids).toEqual(['saas', 'dashboard', 'api', 'fullstack']);
  });

  it('chaque preset porte un nom et une description affichables', () => {
    for (const preset of listPresets()) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
    }
  });
});

describe('previewPlan', () => {
  const created: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('décrit les fichiers du preset SaaS sans rien écrire sur le disque', async () => {
    const target = await mkdtemp(join(tmpdir(), 'pf-preview-'));
    created.push(target);

    // Sonde réaliste : ce sont les appels que fait l'écriture réelle
    // (`generate()` sur `nodeFileSystem`). Un dry-run qui écrirait les
    // déclencherait ; un aperçu qui n'écrit rien les laisse à zéro.
    const writeFile = vi.spyOn(nodeFileSystem, 'writeFile');
    const makeDir = vi.spyOn(nodeFileSystem, 'makeDir');
    const remove = vi.spyOn(nodeFileSystem, 'remove');

    const saas = getPreset('saas');
    expect(saas).toBeDefined();
    if (saas === undefined) return;

    const preview = await previewPlan(saas.manifest('apercu'), { targetDir: target });

    expect(preview.files).toContain('package.json');
    expect(preview.files.length).toBeGreaterThan(1);
    // Le dossier cible est resté vide : c'est la définition du dry-run (§22).
    expect(await readdir(target)).toEqual([]);
    expect(writeFile).not.toHaveBeenCalled();
    expect(makeDir).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('un manifest que le moteur refuse rend ses raisons, sans plan', async () => {
    const parsed = parseManifest({
      manifestVersion: 1,
      name: 'apercu-refuse',
      targets: ['api'],
      architecture: 'single-app',
      // Next ne vise pas `api` : le manifest a la bonne forme, la combinaison
      // est refusée par le moteur. C'est exactement le cas que l'écran doit
      // montrer au lieu d'un « aperçu » vide et muet.
      frontend: { framework: 'next', language: 'typescript' },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const preview = await previewPlan(parsed.value);

    expect(preview.files).toEqual([]);
    expect(preview.warnings.length).toBeGreaterThan(0);
    expect(preview.warnings[0]).toMatch(/next/i);
    expect(preview.warnings[0]).not.toContain('[object');
  });
});

describe('catalogue indisponible', () => {
  it('lève plutôt que de rendre une liste vide trompeuse', async () => {
    vi.resetModules();
    vi.doMock('@buildit/registry', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@buildit/registry')>();
      return {
        ...actual,
        loadCatalogue: () => ({
          ok: false as const,
          issues: [
            {
              code: 'REGISTRY_FIELD_REQUIRED' as const,
              path: [0, 'name'],
              message: 'La fiche 0 n’a pas de nom.',
            },
          ],
        }),
      };
    });

    try {
      const engine = await import('./engine');
      await expect(
        engine.stackOptions('frontend', { targets: ['web'], technologies: [] }),
      ).rejects.toThrow(/n’a pas de nom/);
    } finally {
      vi.doUnmock('@buildit/registry');
      vi.resetModules();
    }
  });
});

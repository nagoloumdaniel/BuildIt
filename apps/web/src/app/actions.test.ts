import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPreset } from '@buildit/presets';
import { afterEach, describe, expect, it } from 'vitest';
import {
  generateProjectAction,
  loadEnvVarsAction,
  loadGraphAction,
  loadOptionsAction,
  loadPresetsAction,
  previewManifestAction,
  workspaceRootAction,
} from './actions';

/**
 * Les Server Actions, appelées directement : ce sont des fonctions asynchrones
 * ordinaires. Ce que ces tests prouvent n'est pas Next (le build s'en charge),
 * c'est le **contrat** : rien de ce qui vient du client n'est cru sur parole,
 * et la génération écrit vraiment — mais jamais là où le client le demande.
 */

const created: string[] = [];

afterEach(async () => {
  delete process.env['PF_WEB_WORKSPACE'];
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('les vues du moteur', () => {
  it('rend les quatre presets certifiés', async () => {
    const presets = await loadPresetsAction();
    expect(presets.map((preset) => preset.id)).toEqual(['saas', 'dashboard', 'api', 'fullstack']);
  });

  it('rend les options réelles d’une catégorie, état compris', async () => {
    const options = await loadOptionsAction('frontend', { targets: ['web'], technologies: [] });
    expect(options.length).toBeGreaterThan(0);
    expect(options.find((option) => option.id === 'next')?.state).toBe('available');
  });

  it('réduit une entrée client hostile à une sélection sûre', async () => {
    // Ce que le navigateur pourrait envoyer à la place d'une sélection.
    const options = await loadOptionsAction('frontend', {
      targets: ['web', 42, null],
      technologies: 'next',
      injection: '../etc/passwd',
    });
    expect(options.length).toBeGreaterThan(0);
  });

  it('rend les noms de variables d’environnement, jamais de valeur', async () => {
    const vars = await loadEnvVarsAction({ targets: ['web'], technologies: ['postgresql'] });
    expect(vars.map((variable) => variable.name)).toContain('DATABASE_URL');
    expect(JSON.stringify(vars)).not.toContain('postgres://');
  });

  it('rend le graphe de la sélection', async () => {
    const graph = await loadGraphAction({ targets: ['web'], technologies: ['next'] });
    expect(graph.nodes.map((node) => node.id)).toContain('next');
  });
});

describe('previewManifestAction — un dry-run, même sur une entrée hostile', () => {
  it('refuse un manifest invalide avec des messages, sans lever', async () => {
    const preview = await previewManifestAction({ name: '///' });
    expect(preview.files).toEqual([]);
    expect(preview.warnings.length).toBeGreaterThan(0);
  });

  it('accepte le manifest d’un preset et liste ses fichiers', async () => {
    const saas = getPreset('saas');
    expect(saas).toBeDefined();
    if (saas === undefined) {
      return;
    }
    const preview = await previewManifestAction(saas.manifest('apercu'));
    expect(preview.files).toContain('package.json');
  });
});

describe('generateProjectAction — écrit vraiment, mais sous sa racine', () => {
  it('écrit le projet sous PF_WEB_WORKSPACE et rend son rapport', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-web-generate-'));
    created.push(root);
    process.env['PF_WEB_WORKSPACE'] = root;
    expect(await workspaceRootAction()).toBe(root);

    const saas = getPreset('saas');
    if (saas === undefined) {
      throw new Error('preset saas absent');
    }
    const result = await generateProjectAction(saas.manifest('genere'));

    expect(result.ok).toBe(true);
    expect(result.directory).toBe(join(root, 'genere'));
    expect(result.files).toContain('package.json');
    expect(result.bytes).toBeGreaterThan(0);
    // Le fichier est réellement là, et son contenu est celui du projet.
    const packageJson = await readFile(join(result.directory, 'package.json'), 'utf8');
    expect(JSON.parse(packageJson).name).toBe('genere');
  });

  it('refuse d’écraser un dossier existant, et le dit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-web-existe-'));
    created.push(root);
    process.env['PF_WEB_WORKSPACE'] = root;

    const saas = getPreset('saas');
    if (saas === undefined) {
      throw new Error('preset saas absent');
    }
    expect((await generateProjectAction(saas.manifest('deux-fois'))).ok).toBe(true);
    const second = await generateProjectAction(saas.manifest('deux-fois'));

    expect(second.ok).toBe(false);
    expect(second.issues.join(' ')).toContain('existe déjà');
  });

  it('refuse un manifest invalide sans rien écrire', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-web-invalide-'));
    created.push(root);
    process.env['PF_WEB_WORKSPACE'] = root;

    const result = await generateProjectAction({ name: '../../evade' });
    expect(result.ok).toBe(false);
    expect(result.files).toEqual([]);
  });
});

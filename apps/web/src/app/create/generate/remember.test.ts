import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from '../../../lib/draft';
import { loadProjects, type ProjectStorage } from '../../../lib/projects';
import type { GenerationView } from '../../actions';
import { rememberGeneratedProject } from './remember';

/**
 * « Un projet généré n'est plus un brouillon » (§6.14), prouvé sans navigateur.
 *
 * Le stockage est injectable (`ProjectStorage` : un `read` et un `write`) : la
 * règle se teste donc au repos, y compris le point qui compte — **un refus
 * n'écrit rien**, il ne peut pas faire apparaître un projet qui n'existe pas.
 */

function memoryStorage(): ProjectStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    read: (key) => data.get(key) ?? null,
    write: (key, value) => {
      data.set(key, value);
    },
  };
}

function draft(): DraftState {
  return {
    ...freshDraft(),
    step: 'generate',
    name: 'mon-projet',
    targets: ['web'],
    architecture: 'single-app',
    technologies: ['next', 'typescript'],
    capabilities: ['stripe'],
    infra: { docker: true, ci: false },
  };
}

const SUCCESS: GenerationView = {
  ok: true,
  directory: '/tmp/buildit/mon-projet',
  files: ['package.json', 'src/app/page.tsx', 'README.md'],
  bytes: 4096,
  warnings: [],
  steps: ['plan', 'write'],
  issues: [],
};

const REFUSED: GenerationView = {
  ok: false,
  directory: '',
  files: [],
  bytes: 0,
  warnings: [],
  steps: [],
  issues: ['Le dossier existe déjà : /tmp/buildit/mon-projet.'],
};

describe('rememberGeneratedProject', () => {
  it('inscrit le projet généré avec ce que la liste doit pouvoir rouvrir', () => {
    const storage = memoryStorage();
    const now = new Date('2026-10-12T10:00:00.000Z');

    rememberGeneratedProject(storage, draft(), SUCCESS, now);

    const [project] = loadProjects(storage);
    expect(project).toBeDefined();
    expect(project?.id).toBe(`mon-projet-${now.getTime()}`);
    expect(project?.name).toBe('mon-projet');
    expect(project?.directory).toBe('/tmp/buildit/mon-projet');
    expect(project?.fileCount).toBe(3);
    expect(project?.bytes).toBe(4096);
    expect(project?.generatedAt).toBe(now.toISOString());
    expect(project?.technologies).toEqual(['next', 'typescript']);
  });

  it('un refus n’écrit rien : aucun projet ne peut être présenté comme généré', () => {
    const storage = memoryStorage();

    const result = rememberGeneratedProject(storage, draft(), REFUSED);

    expect(result).toEqual([]);
    expect(loadProjects(storage)).toEqual([]);
    // Même la clé n'est pas créée : la mémoire des projets ignore un refus.
    expect(storage.data.size).toBe(0);
  });

  it('deux générations du même nom dans le même dossier se remplacent', () => {
    const storage = memoryStorage();
    const first = new Date('2026-10-12T10:00:00.000Z');
    const second = new Date('2026-10-12T11:00:00.000Z');

    rememberGeneratedProject(storage, draft(), SUCCESS, first);
    rememberGeneratedProject(storage, draft(), { ...SUCCESS, files: ['package.json'] }, second);

    const projects = loadProjects(storage);
    expect(projects).toHaveLength(1);
    expect(projects[0]?.generatedAt).toBe(second.toISOString());
    expect(projects[0]?.fileCount).toBe(1);
  });

  it('la liste conservée est une copie : modifier le brouillon après coup ne la change pas', () => {
    const storage = memoryStorage();
    const state = draft();

    rememberGeneratedProject(storage, state, SUCCESS);
    state.technologies.push('prisma');

    expect(loadProjects(storage)[0]?.technologies).toEqual(['next', 'typescript']);
  });

  it('l’écran de génération l’appelle, après l’enregistrement du rapport', () => {
    // Le seul endroit qui écrit la mémoire est l'écran de génération, et il le
    // fait après `saveReport` : l'ordre est la règle (« jamais avant un succès »).
    // Le manifest y est passé : c'est lui qui permet de refaire le projet.
    const source = readFileSync(fileURLToPath(new URL('page.tsx', import.meta.url)), 'utf8');
    const save = source.indexOf('saveReport(');
    const remember = source.indexOf(
      'rememberGeneratedProject(browserProjectStorage(), draft, result, new Date(), manifest.value)',
    );

    expect(save).toBeGreaterThan(-1);
    expect(remember).toBeGreaterThan(save);
  });
});

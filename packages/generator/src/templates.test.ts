import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { TemplateContext } from './template.js';
import { loadTemplateFiles, type TemplateRequest } from './templates.js';

/** Template Resolver (§22, 5.4) — sur un vrai disque, dans un dossier jetable. */

const created: string[] = [];

afterEach(async () => {
  while (created.length > 0) {
    await rm(created.pop() as string, { recursive: true, force: true });
  }
});

async function templatesRoot(files: Record<string, string | Buffer>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-templates-'));
  created.push(root);
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), contents);
  }
  return root;
}

const CONTEXT: TemplateContext = {
  projectName: 'quai3',
  packageName: 'quai3',
  scope: '@quai3',
  description: '',
  year: '2026',
  nodeVersion: '>=20.11.0',
  packageManager: 'pnpm@11.13.1',
};

function codes(root: string, requests: TemplateRequest[]): string[] {
  const result = loadTemplateFiles(root, requests, CONTEXT);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('template de technologie : un dossier recopié à la racine du projet', () => {
  it('parcourt l’arborescence, rend chaque fichier, trace la provenance', async () => {
    const root = await templatesRoot({
      'frontend/next/app/page.tsx':
        'export default function Page() { return "{{projectName}}"; }\n',
      'frontend/next/next.config.ts': 'export default {};\n',
    });
    const result = loadTemplateFiles(
      root,
      [{ kind: 'directory', template: 'frontend/next' }],
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((file) => file.path)).toEqual(['app/page.tsx', 'next.config.ts']);
      expect(result.value[0]?.contents).toContain('return "quai3"');
      expect(result.value.every((file) => file.source === 'template:frontend/next')).toBe(true);
    }
  });

  it('un template absent est une erreur, pas un projet silencieusement incomplet', async () => {
    const root = await templatesRoot({});
    expect(codes(root, [{ kind: 'directory', template: 'frontend/next' }])).toEqual([
      'GEN_TEMPLATE_MISSING',
    ]);
  });

  it('un dossier de template vide est une erreur', async () => {
    const root = await templatesRoot({});
    await mkdir(join(root, 'frontend/next'), { recursive: true });
    expect(codes(root, [{ kind: 'directory', template: 'frontend/next' }])).toEqual([
      'GEN_TEMPLATE_MISSING',
    ]);
  });

  it('refuse un fichier binaire : le rendu ne sait que du texte', async () => {
    const root = await templatesRoot({ 'x/logo.png': Buffer.from([0x89, 0x50, 0x00, 0x47]) });
    expect(codes(root, [{ kind: 'directory', template: 'x' }])).toEqual(['GEN_TEMPLATE_BINARY']);
  });

  it('refuse un lien symbolique : il pourrait pointer n’importe où sur la machine', async () => {
    const root = await templatesRoot({ 'x/a.ts': 'a\n' });
    await symlink('/etc/hosts', join(root, 'x/hosts'));
    expect(codes(root, [{ kind: 'directory', template: 'x' }])).toEqual(['GEN_TEMPLATE_SYMLINK']);
  });

  it('refuse un chemin de template qui sort de la racine', async () => {
    const root = await templatesRoot({});
    expect(codes(root, [{ kind: 'directory', template: '../..' }])).toEqual([
      'GEN_TEMPLATE_PATH_UNSAFE',
    ]);
  });

  it('transmet les erreurs du rendu avec les mots du rendu', async () => {
    const root = await templatesRoot({ 'x/a.ts': 'const x = "{{user.name}}";\n' });
    expect(codes(root, [{ kind: 'directory', template: 'x' }])).toEqual([
      'GEN_UNKNOWN_PLACEHOLDER',
    ]);
  });
});

describe('fichier de recette : un template vers une cible', () => {
  it('rend le fichier à la cible demandée, avec la recette pour origine', async () => {
    const root = await templatesRoot({ 'recipes/auth/auth.ts': '// {{projectName}}\n' });
    const result = loadTemplateFiles(
      root,
      [
        {
          kind: 'file',
          template: 'recipes/auth/auth.ts',
          target: 'lib/auth.ts',
          origin: 'recipe:auth',
        },
      ],
      CONTEXT,
    );
    expect(result.ok && result.value).toEqual([
      { path: 'lib/auth.ts', contents: '// quai3\n', source: 'recipe:auth' },
    ]);
  });

  it('un fichier absent est une erreur', async () => {
    const root = await templatesRoot({});
    expect(
      codes(root, [{ kind: 'file', template: 'recipes/a.ts', target: 'a.ts', origin: 'recipe:a' }]),
    ).toEqual(['GEN_TEMPLATE_MISSING']);
  });

  it('une cible qui sort du projet est refusée', async () => {
    const root = await templatesRoot({ 'recipes/a.ts': 'a\n' });
    expect(
      codes(root, [
        { kind: 'file', template: 'recipes/a.ts', target: '../../.bashrc', origin: 'recipe:a' },
      ]),
    ).toEqual(['GEN_TEMPLATE_PATH_UNSAFE']);
  });

  it('un template-fichier qui est un lien symbolique est refusé', async () => {
    const root = await templatesRoot({});
    await mkdir(join(root, 'recipes'));
    await symlink('/etc/hosts', join(root, 'recipes/a.ts'));
    expect(
      codes(root, [{ kind: 'file', template: 'recipes/a.ts', target: 'a.ts', origin: 'recipe:a' }]),
    ).toEqual(['GEN_TEMPLATE_SYMLINK']);
  });
});

describe('liens symboliques en chemin — revue sécurité', () => {
  it('refuse un dossier intermédiaire qui est un lien, pour un fichier de recette', async () => {
    const outside = await templatesRoot({ 'a.ts': 'dehors\n' });
    const root = await templatesRoot({});
    await symlink(outside, join(root, 'recipes'));
    expect(
      codes(root, [{ kind: 'file', template: 'recipes/a.ts', target: 'a.ts', origin: 'recipe:a' }]),
    ).toEqual(['GEN_TEMPLATE_SYMLINK']);
  });

  it('refuse un dossier intermédiaire qui est un lien, pour un template de fiche', async () => {
    const outside = await templatesRoot({ 'next/page.tsx': 'dehors\n' });
    const root = await templatesRoot({});
    await symlink(outside, join(root, 'frontend'));
    expect(codes(root, [{ kind: 'directory', template: 'frontend/next' }])).toEqual([
      'GEN_TEMPLATE_SYMLINK',
    ]);
  });
});

describe('ensemble', () => {
  it('aucune demande : aucun accès disque, aucun fichier', () => {
    expect(loadTemplateFiles('/racine/inexistante', [], CONTEXT)).toEqual({ ok: true, value: [] });
  });

  it('un problème d’une demande ne masque pas celui de la suivante', async () => {
    const root = await templatesRoot({ 'x/a.ts': 'a\n' });
    await symlink('/etc/hosts', join(root, 'x/hosts'));
    await mkdir(join(root, 'vide'));
    expect(
      codes(root, [
        { kind: 'directory', template: 'x' },
        { kind: 'directory', template: 'vide' },
      ]),
    ).toEqual(['GEN_TEMPLATE_SYMLINK', 'GEN_TEMPLATE_MISSING']);
  });

  it('un dossier qui ne contient qu’un lien refusé n’est pas dit vide en plus', async () => {
    const root = await templatesRoot({});
    await mkdir(join(root, 'x'));
    await symlink('/etc/hosts', join(root, 'x/hosts'));
    expect(codes(root, [{ kind: 'directory', template: 'x' }])).toEqual(['GEN_TEMPLATE_SYMLINK']);
  });

  it('rapporte tous les problèmes d’un coup', async () => {
    const root = await templatesRoot({});
    expect(
      codes(root, [
        { kind: 'directory', template: 'a' },
        { kind: 'directory', template: 'b' },
      ]),
    ).toEqual(['GEN_TEMPLATE_MISSING', 'GEN_TEMPLATE_MISSING']);
  });
});

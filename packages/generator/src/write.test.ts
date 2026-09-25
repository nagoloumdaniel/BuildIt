import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type PlannedFile, planFiles } from './plan.js';
import { type FileSystem, generate, nodeFileSystem } from './write.js';

/**
 * Ces tests écrivent réellement sur le disque, dans un dossier temporaire.
 *
 * Un système de fichiers entièrement simulé prouverait que le code appelle les
 * bonnes fonctions, pas qu'il produit le bon résultat. Pour la seule chose qui
 * compte ici — l'état du disque après une panne — il faut un vrai disque.
 */

const created: string[] = [];

async function tempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'pf-generator-'));
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

function file(path: string, contents = 'contenu\n'): PlannedFile {
  return { path, contents, source: 'test' };
}

function planOf(targetDir: string, files: PlannedFile[]) {
  const result = planFiles(targetDir, files);
  if (!result.ok) {
    throw new Error(`plan invalide : ${result.issues.map((i) => i.message).join(' | ')}`);
  }
  return result.value;
}

/** Système de fichiers qui échoue volontairement au n-ième fichier écrit. */
function failingAfter(count: number): FileSystem {
  let written = 0;
  return {
    ...nodeFileSystem,
    async writeFile(path, contents, executable) {
      written += 1;
      if (written > count) {
        throw new Error('panne simulée du disque');
      }
      await nodeFileSystem.writeFile(path, contents, executable);
    },
  };
}

describe('écriture nominale', () => {
  it('écrit les fichiers du plan', async () => {
    const target = join(await tempDir(), 'projet');
    const result = await generate(planOf(target, [file('README.md'), file('src/app.ts')]));

    expect(result.ok).toBe(true);
    expect(await readFile(join(target, 'README.md'), 'utf8')).toBe('contenu\n');
    expect(await readFile(join(target, 'src', 'app.ts'), 'utf8')).toBe('contenu\n');
  });

  it('crée les dossiers intermédiaires', async () => {
    const target = join(await tempDir(), 'projet');
    await generate(planOf(target, [file('a/b/c/d.ts')]));
    expect(await readFile(join(target, 'a', 'b', 'c', 'd.ts'), 'utf8')).toBe('contenu\n');
  });

  it('rend la liste de ce qui a été écrit', async () => {
    const target = join(await tempDir(), 'projet');
    const result = await generate(planOf(target, [file('README.md'), file('src/app.ts')]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.written).toEqual(['README.md', 'src/app.ts']);
      expect(result.value.rolledBack).toBe(false);
      expect(result.value.bytes).toBeGreaterThan(0);
    }
  });

  it('accepte un plan vide', async () => {
    const target = join(await tempDir(), 'projet');
    const result = await generate(planOf(target, []));
    expect(result.ok).toBe(true);
  });

  it('accepte un dossier cible existant mais vide', async () => {
    const target = join(await tempDir(), 'projet');
    await mkdir(target, { recursive: true });
    expect((await generate(planOf(target, [file('README.md')]))).ok).toBe(true);
  });

  it('refuse un dossier cible non vide — la génération n’écrase pas un projet', async () => {
    const target = await tempDir();
    await writeFile(join(target, 'deja-la.txt'), 'important');
    const result = await generate(planOf(target, [file('README.md')]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('GEN_TARGET_NOT_EMPTY');
    }
    expect(await readFile(join(target, 'deja-la.txt'), 'utf8')).toBe('important');
  });
});

/**
 * Le rollback est la fonctionnalité la plus facile à « croire faite ».
 * Il se prouve par injection de panne, jamais par relecture.
 */
describe('rollback par injection de panne', () => {
  it('restaure le dossier cible quand l’écriture échoue à mi-parcours', async () => {
    const parent = await tempDir();
    const target = join(parent, 'projet');

    const result = await generate(
      planOf(target, [file('a.ts'), file('b.ts'), file('c.ts'), file('d.ts')]),
      failingAfter(2),
    );

    expect(result.ok).toBe(false);
    // Le dossier cible n'existait pas avant : après annulation, il ne doit
    // pas exister non plus. Aucun demi-projet ne reste sur le disque.
    expect(await readdir(parent)).toEqual([]);
  });

  it('signale l’annulation plutôt que de la taire', async () => {
    const target = join(await tempDir(), 'projet');
    const result = await generate(planOf(target, [file('a.ts'), file('b.ts')]), failingAfter(1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('GEN_WRITE_FAILED');
      expect(result.issues[0]?.message).toContain('annulé');
    }
  });

  it('ne supprime pas un fichier préexistant', async () => {
    // Le journal ne contient que ce que le générateur a créé lui-même.
    // C'est précisément ce qui rend le rollback sûr.
    const target = join(await tempDir(), 'projet');
    await mkdir(join(target, 'garde'), { recursive: true });
    await writeFile(join(target, 'garde', 'precieux.txt'), 'à conserver');

    await generate(planOf(target, [file('a.ts'), file('b.ts')]), failingAfter(1));

    expect(await readFile(join(target, 'garde', 'precieux.txt'), 'utf8')).toBe('à conserver');
  });

  it('ne supprime pas un dossier préexistant', async () => {
    const target = join(await tempDir(), 'projet');
    await mkdir(join(target, 'garde'), { recursive: true });
    await writeFile(join(target, 'garde', 'x.txt'), 'x');

    await generate(planOf(target, [file('garde/a.ts'), file('b.ts')]), failingAfter(1));

    expect(await readdir(join(target, 'garde'))).toContain('x.txt');
  });

  it('supprime les dossiers qu’il a créés lui-même', async () => {
    const target = join(await tempDir(), 'projet');
    await mkdir(target, { recursive: true });

    await generate(planOf(target, [file('nouveau/a.ts'), file('nouveau/b.ts')]), failingAfter(1));

    expect(await readdir(target)).toEqual([]);
  });

  it('échoue dès le premier fichier sans rien laisser', async () => {
    const parent = await tempDir();
    const target = join(parent, 'projet');
    const result = await generate(planOf(target, [file('a.ts')]), failingAfter(0));
    expect(result.ok).toBe(false);
    expect(await readdir(parent)).toEqual([]);
  });
});

describe('generate ne lève jamais', () => {
  it('sur une panne d’écriture', async () => {
    const target = join(await tempDir(), 'projet');
    await expect(generate(planOf(target, [file('a.ts')]), failingAfter(0))).resolves.toBeDefined();
  });

  it('sur une panne d’annulation — l’erreur d’origine reste rapportée', async () => {
    const target = join(await tempDir(), 'projet');
    const brutal: FileSystem = {
      ...nodeFileSystem,
      writeFile: async () => {
        throw new Error('panne simulée');
      },
      remove: async () => {
        throw new Error('annulation impossible');
      },
    };
    const result = await generate(planOf(target, [file('a.ts')]), brutal);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.code)).toContain('GEN_ROLLBACK_FAILED');
    }
  });
});

describe('le plan seul n’écrit rien — dry-run', () => {
  it('construire un plan ne touche pas au disque', async () => {
    const target = await tempDir();
    planFiles(target, [file('README.md'), file('src/app.ts')]);
    expect(await readdir(target)).toEqual([]);
  });
});

describe('liens symboliques — §24', () => {
  it('refuse d’écrire à travers un dossier qui est un lien symbolique', async () => {
    const target = join(await tempDir(), 'projet');
    const linked: FileSystem = {
      ...nodeFileSystem,
      isSymlink: async (path) => path.endsWith('piege'),
    };
    const result = await generate(planOf(target, [file('piege/a.ts')]), linked);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('lien symbolique');
    }
  });

  it('écrit normalement quand aucun lien n’est traversé', async () => {
    const target = join(await tempDir(), 'projet');
    expect((await generate(planOf(target, [file('normal/a.ts')]))).ok).toBe(true);
  });
});

describe('dossier .git toléré', () => {
  it('accepte une cible contenant seulement .git', async () => {
    const target = await tempDir();
    await mkdir(join(target, '.git'), { recursive: true });
    await writeFile(join(target, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    const result = await generate(planOf(target, [file('README.md')]));
    expect(result.ok).toBe(true);
    expect(await readFile(join(target, '.git', 'HEAD'), 'utf8')).toContain('refs/heads/main');
  });
});

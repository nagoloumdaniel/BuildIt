import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { generateProject } from '@project-factory/generator';
import { PRESET_IDS, PRESETS } from '@project-factory/presets';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';

async function tree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name);
      files[relative(root, path)] = await readFile(path, 'utf8');
    }
  }
  return files;
}

const temp = (): Promise<string> => mkdtemp(join(tmpdir(), 'pf-create-'));

describe('pf create', () => {
  it('--help décrit chaque option', async () => {
    const io = fakeIo();
    expect(await run(['create', '--help'], io)).toBe(0);
    for (const flag of [
      '--preset',
      '--dir',
      '--no-install',
      '--no-git',
      '--dry-run',
      '--from',
      '--yes',
    ]) {
      expect(io.text().out).toContain(flag);
    }
  });

  it('hors terminal, un nom manquant est une erreur qui dit quoi taper', async () => {
    const io = fakeIo();
    expect(await run(['create', '--preset', 'api'], io)).toBe(2);
    expect(io.text().err).toContain('pf create <nom> --preset <preset>');
  });

  it('hors terminal, un preset manquant nomme le drapeau et les valeurs', async () => {
    const io = fakeIo();
    expect(await run(['create', 'demo'], io)).toBe(2);
    expect(io.text().err).toContain(`--preset <${PRESET_IDS.join('|')}>`);
  });

  it('--yes interdit les questions, même dans un terminal', async () => {
    const io = fakeIo({ interactive: true });
    expect(await run(['create', '--yes'], io)).toBe(2);
    expect(io.asked).toEqual([]);
  });

  it('refuse un nom de projet invalide, avec la règle', async () => {
    const io = fakeIo();
    expect(await run(['create', 'Mon Projet', '--preset', 'api'], io)).toBe(2);
    expect(io.text().err).toContain('minuscules, chiffres et tirets');
  });

  it('refuse deux noms', async () => {
    const io = fakeIo();
    expect(await run(['create', 'a', 'b', '--preset', 'api'], io)).toBe(2);
  });

  it('propose le preset le plus proche', async () => {
    const io = fakeIo();
    expect(await run(['create', 'demo', '--preset', 'apy'], io)).toBe(2);
    expect(io.text().err).toContain('Vouliez-vous dire « api » ?');
  });

  it('liste les presets quand rien n’est proche', async () => {
    const io = fakeIo();
    expect(await run(['create', 'demo', '--preset', 'zzzzzzzz'], io)).toBe(2);
    expect(io.text().err).toContain(`Presets disponibles : ${PRESET_IDS.join(', ')}.`);
  });

  it('refuse une étape de reprise inconnue', async () => {
    const io = fakeIo({ cwd: await temp() });
    expect(await run(['create', 'demo', '--preset', 'api', '--from', 'deploy'], io)).toBe(2);
    expect(io.text().err).toContain('write, install, git, validate');
  });

  it('dans un terminal, demande le nom et le preset', async () => {
    const cwd = await temp();
    const io = fakeIo({ cwd, interactive: true, answers: ['demo', 'dashboard'] });
    expect(await run(['create', '--dry-run'], io)).toBe(0);
    expect(io.asked).toEqual(['Nom du projet :', 'Quel type de projet ?']);
    expect(io.offered[0]?.map((choice) => choice.value)).toEqual([...PRESET_IDS]);
    expect(io.text().out).toContain('dans demo/');
  });

  it('--dry-run affiche l’arborescence et n’écrit rien', async () => {
    const cwd = await temp();
    const io = fakeIo({ cwd });
    expect(await run(['create', 'demo', '--preset', 'api', '--dry-run'], io)).toBe(0);
    expect(io.text().out).toContain("Aperçu — rien n'est écrit.");
    expect(io.text().out).toContain('package.json');
    expect(await readdir(cwd)).toEqual([]);
  });

  it('écrit dans --dir, et dit la suite : installer puis lancer', async () => {
    const cwd = await temp();
    const io = fakeIo({ cwd });
    const code = await run(
      ['create', 'demo', '--preset', 'api', '--dir', 'ailleurs', '--no-install', '--no-git'],
      io,
    );
    expect(code).toBe(0);
    expect(await readdir(cwd)).toEqual(['ailleurs']);
    expect(io.text().out).toMatch(/✓ \d+ fichiers écrits\./);
    expect(io.text().out).toContain('cd ailleurs\n  pnpm install\n  pnpm dev');
  });

  it('un échec du moteur donne le code 1 et ses propres mots', async () => {
    const cwd = await temp();
    const args = ['create', 'demo', '--preset', 'api', '--no-install', '--no-git'];
    expect(await run(args, fakeIo({ cwd }))).toBe(0);
    const io = fakeIo({ cwd });
    // Seconde génération au même endroit : le moteur refuse d'écraser.
    expect(await run(args, io)).toBe(1);
    expect(io.text().err).toContain("Échec à l'étape « write ».");
    expect(io.text().err).toMatch(/\(GEN_[A-Z_]+\)/);
  });

  it('--from write sur un dossier existant reprend sans tout refaire', async () => {
    const cwd = await temp();
    expect(
      await run(
        ['create', 'demo', '--preset', 'api', '--no-install', '--no-git', '--dir', '.'],
        fakeIo({ cwd }),
      ),
    ).toBe(0);
    const io = fakeIo({ cwd });
    expect(
      await run(
        [
          'create',
          'demo',
          '--preset',
          'api',
          '--no-install',
          '--no-git',
          '--dir',
          '.',
          '--from',
          'git',
        ],
        io,
      ),
    ).toBe(0);
    expect(io.text().out).not.toContain('fichiers écrits');
    expect(io.text().out).not.toContain('cd ');
  });

  // Gate M4 : même manifest ⇒ même projet, que l'on passe par le CLI ou par
  // le moteur directement (comme le fera l'UI).
  it.each(PRESETS.map((preset) => [preset.id, preset] as const))(
    'preset %s : octet pour octet identique au moteur appelé directement',
    async (_id, preset) => {
      const viaEngine = await temp();
      const direct = await generateProject(preset.manifest('demo'), viaEngine, {
        recipes: preset.recipes,
      });
      expect(direct.ok).toBe(true);

      const cwd = await temp();
      const code = await run(
        ['create', 'demo', '--preset', preset.id, '--no-install', '--no-git'],
        fakeIo({ cwd }),
      );
      expect(code).toBe(0);
      expect(await tree(join(cwd, 'demo'))).toEqual(await tree(viaEngine));
    },
  );
});

import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeManifest } from '@project-factory/manifest';
import { getPreset } from '@project-factory/presets';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';

const temp = (): Promise<string> => mkdtemp(join(tmpdir(), 'pf-generate-'));

describe('pf generate', () => {
  it('--help', async () => {
    const io = fakeIo();
    expect(await run(['generate', '--help'], io)).toBe(0);
    expect(io.text().out).toContain('--recipes');
  });

  it('exige un fichier, un seul', async () => {
    expect(await run(['generate'], fakeIo())).toBe(2);
    expect(await run(['generate', 'a.json', 'b.json'], fakeIo())).toBe(2);
  });

  it('un fichier absent : code 1 et la piste', async () => {
    const io = fakeIo({ cwd: await temp() });
    expect(await run(['generate', 'absent.json'], io)).toBe(1);
    expect(io.text().err).toContain('Impossible de lire « ');
    expect(io.text().err).toContain('pf create');
  });

  it('du JSON invalide : code 1', async () => {
    const cwd = await temp();
    await writeFile(join(cwd, 'm.json'), '{ pas du json');
    const io = fakeIo({ cwd });
    expect(await run(['generate', 'm.json'], io)).toBe(1);
    expect(io.text().err).toContain("n'est pas du JSON valide");
  });

  it('un manifest invalide : les problèmes du moteur, avec leur code', async () => {
    const cwd = await temp();
    await writeFile(join(cwd, 'm.json'), JSON.stringify({ manifestVersion: 1, name: 'X' }));
    const io = fakeIo({ cwd });
    expect(await run(['generate', 'm.json'], io)).toBe(1);
    expect(io.text().err).toMatch(/\(MANIFEST_[A-Z_]+\)/);
  });

  it('génère dans ./<nom du manifest>, recettes comprises', async () => {
    const cwd = await temp();
    const preset = getPreset('dashboard');
    await writeFile(
      join(cwd, 'm.json'),
      serializeManifest(preset?.manifest('tableau') ?? ({} as never)),
    );
    const io = fakeIo({ cwd });
    const code = await run(
      ['generate', 'm.json', '--recipes', 'dashboard-admin', '--no-install', '--no-git'],
      io,
    );
    expect(code).toBe(0);
    expect(await readdir(join(cwd, 'tableau', 'app'))).toContain('dashboard');
  });

  it('--dry-run et --dir : rien n’est écrit', async () => {
    const cwd = await temp();
    await writeFile(
      join(cwd, 'm.json'),
      serializeManifest(getPreset('api')?.manifest('x') ?? ({} as never)),
    );
    const io = fakeIo({ cwd });
    expect(await run(['generate', 'm.json', '--dir', 'cible', '--dry-run'], io)).toBe(0);
    expect(io.text().out).toContain('dans cible/');
    expect(await readdir(cwd)).toEqual(['m.json']);
  });

  it('une recette inconnue est refusée au plan', async () => {
    const cwd = await temp();
    await writeFile(
      join(cwd, 'm.json'),
      serializeManifest(getPreset('api')?.manifest('x') ?? ({} as never)),
    );
    const io = fakeIo({ cwd });
    expect(await run(['generate', 'm.json', '--recipes', 'inconnue', '--dry-run'], io)).toBe(1);
  });
});

import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseManifest, serializeManifest } from '@project-factory/manifest';
import { getPreset, PRESET_IDS } from '@project-factory/presets';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';

describe('pf template', () => {
  it('list : chaque preset, son nom et à quoi il sert', async () => {
    const io = fakeIo();
    expect(await run(['template', 'list'], io)).toBe(0);
    for (const id of PRESET_IDS) {
      expect(io.text().out).toContain(getPreset(id)?.description);
    }
  });

  it('show : seul le manifest va sur la sortie standard, redirigeable tel quel', async () => {
    const io = fakeIo();
    expect(await run(['template', 'show', 'saas', '--name', 'boutique'], io)).toBe(0);
    const parsed = parseManifest(JSON.parse(io.text().out));
    expect(parsed.ok).toBe(true);
    expect(`${io.text().out}\n`).toBe(
      serializeManifest(getPreset('saas')?.manifest('boutique') as never),
    );
    expect(io.text().err).toContain('--recipes resend-transactional,stripe-checkout');
  });

  it('show sans recette ne dit rien de plus', async () => {
    const io = fakeIo();
    expect(await run(['template', 'show', 'api'], io)).toBe(0);
    expect(io.stderr).toEqual([]);
    expect(io.text().out).toContain('"name": "mon-projet"');
  });

  it('show refuse un preset inconnu et un nom invalide', async () => {
    expect(await run(['template', 'show', 'nope'], fakeIo())).toBe(2);
    expect(await run(['template', 'show'], fakeIo())).toBe(2);
    expect(await run(['template', 'show', 'api', '--name', 'Pas Bon'], fakeIo())).toBe(2);
  });

  it('use : alias de pf create --preset', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'pf-template-'));
    const io = fakeIo({ cwd });
    expect(await run(['template', 'use', 'api', 'demo', '--dry-run'], io)).toBe(0);
    expect(io.text().out).toContain('dans demo/');
    expect(await readdir(cwd)).toEqual([]);
    expect(await run(['template', 'use'], fakeIo())).toBe(2);
  });

  it('sans action : l’aide, code 2 ; -h : 0 ; action inconnue : 2', async () => {
    expect(await run(['template'], fakeIo())).toBe(2);
    expect(await run(['template', '-h'], fakeIo())).toBe(0);
    expect(await run(['template', 'remove'], fakeIo())).toBe(2);
  });
});

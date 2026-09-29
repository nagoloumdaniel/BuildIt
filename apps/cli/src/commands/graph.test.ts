import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeManifest } from '@project-factory/manifest';
import { getPreset } from '@project-factory/presets';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';

const temp = (): Promise<string> => mkdtemp(join(tmpdir(), 'pf-graph-'));

describe('pf graph', () => {
  it('--help', async () => {
    const io = fakeIo();
    expect(await run(['graph', '-h'], io)).toBe(0);
    expect(io.text().out).toContain('pf.manifest.json');
  });

  it('un preset : chaque technologie, sa catégorie, le statut', async () => {
    const io = fakeIo();
    expect(await run(['graph', '--preset', 'api'], io)).toBe(0);
    const out = io.text().out;
    expect(out).toContain('stack certifiée');
    expect(out).toMatch(/✓ backend\s+Hono \(hono\)/);
    expect(out).toMatch(/✓ database\s+PostgreSQL \(postgresql\)/);
  });

  it('dit ce que le moteur ajoute, et qui l’exige', async () => {
    const cwd = await temp();
    await writeFile(
      join(cwd, 'pf.manifest.json'),
      JSON.stringify({
        manifestVersion: 1,
        name: 'demo',
        targets: ['web'],
        architecture: 'single-app',
        frontend: { framework: 'next', language: 'typescript', ui: 'shadcn-ui' },
      }),
    );
    const io = fakeIo({ cwd });
    expect(await run(['graph'], io)).toBe(0);
    const out = io.text().out;
    expect(out).toMatch(/Tailwind CSS \(tailwind\)\s+← ajoutée : exigée par shadcn-ui/);
    // Choisie par le manifest : jamais présentée comme ajoutée.
    expect(out).not.toMatch(/TypeScript \(typescript\)\s+←/);
  });

  it('une stack avec une technologie déclarée est expérimentale', async () => {
    const cwd = await temp();
    const manifest = getPreset('api')?.manifest('demo');
    await writeFile(
      join(cwd, 'm.json'),
      serializeManifest({ ...(manifest ?? ({} as never)), services: ['redis', 'meilisearch'] }),
    );
    const io = fakeIo({ cwd });
    expect(await run(['graph', 'm.json'], io)).toBe(0);
    expect(io.text().out).toContain('stack expérimentale');
    expect(io.text().out).toMatch(/· search\s+/);
  });

  it('une stack incompatible : code 1 et la raison', async () => {
    const cwd = await temp();
    await writeFile(
      join(cwd, 'm.json'),
      JSON.stringify({
        manifestVersion: 1,
        name: 'demo',
        targets: ['web'],
        architecture: 'single-app',
        frontend: { framework: 'next', language: 'typescript' },
        backend: { framework: 'hono' },
        database: { engine: 'postgresql', orm: 'prisma' },
        services: ['drizzle'],
      }),
    );
    const io = fakeIo({ cwd });
    expect(await run(['graph', 'm.json'], io)).toBe(1);
    expect(io.text().err).toMatch(/\(COMPAT_[A-Z_]+\)/);
  });

  it('refuse un manifest et un preset à la fois, et un preset inconnu', async () => {
    expect(await run(['graph', 'm.json', '--preset', 'api'], fakeIo())).toBe(2);
    expect(await run(['graph', '--preset', 'nope'], fakeIo())).toBe(2);
  });

  it('sans pf.manifest.json : code 1', async () => {
    expect(await run(['graph'], fakeIo({ cwd: await temp() }))).toBe(1);
  });
});

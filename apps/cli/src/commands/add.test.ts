import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Manifest, parseManifest, serializeManifest } from '@project-factory/manifest';
import { getPreset } from '@project-factory/presets';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';

const API = getPreset('api')?.manifest('demo') as Manifest;
const SAAS = getPreset('saas')?.manifest('demo') as Manifest;
const MINIMAL: Manifest = {
  manifestVersion: 1,
  name: 'demo',
  targets: ['api'],
  architecture: 'single-app',
};

const WEB: Manifest = {
  manifestVersion: 1,
  name: 'demo',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript', styling: 'tailwind' },
};

async function project(manifest: Manifest): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'pf-add-'));
  await writeFile(join(cwd, 'pf.manifest.json'), serializeManifest(manifest));
  return cwd;
}

async function manifestIn(cwd: string, file = 'pf.manifest.json'): Promise<Manifest> {
  const parsed = parseManifest(JSON.parse(await readFile(join(cwd, file), 'utf8')));
  if (!parsed.ok) {
    throw new Error('manifest invalide');
  }
  return parsed.value;
}

describe('pf add', () => {
  it('--help dit qu’il n’écrit qu’avec --yes', async () => {
    const io = fakeIo();
    expect(await run(['add', '--help'], io)).toBe(0);
    expect(io.text().out).toContain('--yes');
  });

  it('exige une technologie, une seule', async () => {
    expect(await run(['add'], fakeIo())).toBe(2);
    expect(await run(['add', 'a', 'b'], fakeIo())).toBe(2);
  });

  it('propose la technologie la plus proche', async () => {
    const io = fakeIo({ cwd: await project(API) });
    expect(await run(['add', 'stripee'], io)).toBe(2);
    expect(io.text().err).toContain('Vouliez-vous dire « stripe » ?');
  });

  it('une technologie sans voisine renvoie vers pf graph', async () => {
    const io = fakeIo({ cwd: await project(API) });
    expect(await run(['add', 'zzzzzzzzzzzz'], io)).toBe(2);
    expect(io.text().err).toContain('pf graph');
  });

  it('sans manifest : code 1', async () => {
    const io = fakeIo({ cwd: await mkdtemp(join(tmpdir(), 'pf-add-')) });
    expect(await run(['add', 'stripe'], io)).toBe(1);
  });

  it('déjà présente : rien à faire', async () => {
    const io = fakeIo({ cwd: await project(API) });
    expect(await run(['add', 'redis', '--yes'], io)).toBe(0);
    expect(io.text().out).toContain('déjà partie du projet');
  });

  it('sans --yes ni terminal, montre la modification et n’écrit rien', async () => {
    const cwd = await project(API);
    const before = await readFile(join(cwd, 'pf.manifest.json'), 'utf8');
    const io = fakeIo({ cwd });
    expect(await run(['add', 'stripe'], io)).toBe(0);
    expect(io.text().out).toContain('+ Stripe → services');
    expect(io.text().out).toContain('Relancez avec --yes');
    expect(await readFile(join(cwd, 'pf.manifest.json'), 'utf8')).toBe(before);
  });

  it('dans un terminal, demande confirmation ; non = rien d’écrit', async () => {
    const cwd = await project(API);
    const io = fakeIo({ cwd, interactive: true, answers: [false] });
    expect(await run(['add', 'stripe'], io)).toBe(0);
    expect(io.asked).toEqual(['Écrire pf.manifest.json ?']);
    expect((await manifestIn(cwd)).services).toEqual(['redis']);
  });

  it('--yes écrit un manifest canonique, dans le fichier nommé', async () => {
    const cwd = await project(API);
    await writeFile(join(cwd, 'autre.json'), serializeManifest(API));
    const io = fakeIo({ cwd });
    expect(await run(['add', 'stripe', '--manifest', 'autre.json', '--yes'], io)).toBe(0);
    const text = await readFile(join(cwd, 'autre.json'), 'utf8');
    const written = await manifestIn(cwd, 'autre.json');
    expect(written.services).toEqual(['redis', 'stripe']);
    expect(text).toBe(serializeManifest(written));
  });

  it('dit ce que la technologie entraîne', async () => {
    const cwd = await project({ ...SAAS, frontend: { framework: 'next', language: 'typescript' } });
    const io = fakeIo({ cwd });
    expect(await run(['add', 'shadcn-ui', '--yes'], io)).toBe(0);
    expect(io.text().out).toContain('+ shadcn/ui → frontend.ui');
    expect(io.text().out).toContain('+ tailwind — exigée par shadcn-ui');
  });

  it.each([
    ['vitest', MINIMAL, 'quality'],
    ['docker', MINIMAL, 'infra'],
    ['resend', MINIMAL, 'services'],
    ['hono', MINIMAL, 'backend.framework'],
    ['postgresql', MINIMAL, 'database.engine'],
    ['better-auth', WEB, 'auth.provider'],
    ['drizzle', API, 'database.orm (remplace prisma)'],
    ['remix', SAAS, 'frontend.framework (remplace next)'],
    ['css-modules', WEB, 'frontend.styling (remplace tailwind)'],
  ] as const)('%s va au bon champ', async (id, manifest, field) => {
    const io = fakeIo({ cwd: await project(manifest) });
    await run(['add', id], io);
    expect(io.text().out).toContain(`→ ${field}`);
  });

  it.each([
    ['remix', 'Aucune application web'],
    ['tailwind', 'application web'],
    ['shadcn-ui', 'application web'],
    ['prisma', 'pf add postgresql'],
    ['javascript', 'pf create'],
  ])('%s est refusée là où elle n’a pas de sens', async (id, reason) => {
    const io = fakeIo({ cwd: await project(MINIMAL) });
    expect(await run(['add', id], io)).toBe(2);
    expect(io.text().err).toContain(reason);
  });

  it('une addition incompatible est refusée : code 1, rien d’écrit', async () => {
    // shadcn/ui exige Tailwind : remplacer Tailwind ferait deux styles exclusifs.
    const cwd = await project(SAAS);
    const before = await readFile(join(cwd, 'pf.manifest.json'), 'utf8');
    const io = fakeIo({ cwd });
    expect(await run(['add', 'css-modules', '--yes'], io)).toBe(1);
    expect(io.text().err).toMatch(/\(COMPAT_[A-Z_]+\)/);
    expect(await readFile(join(cwd, 'pf.manifest.json'), 'utf8')).toBe(before);
  });
});

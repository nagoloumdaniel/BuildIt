import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeWorld } from '../fake-world.js';

const ok = () => ({ exitCode: 0, output: '' });

// Le chemin réel en monorepo : Next trace depuis la racine du dépôt.
const MONOREPO_SERVER = join('apps', 'web', '.next', 'standalone', 'apps', 'web', 'server.js');
// L'autre forme : l'application seule comme racine de traçage.
const FLAT_SERVER = join('apps', 'web', '.next', 'standalone', 'server.js');
// Le dossier de l'application bâtie : `next start` lit `.next` depuis là.
const WEB_DIR = join('apps', 'web');
const BUILD_ID = join(WEB_DIR, '.next', 'BUILD_ID');
const NEXT_BIN = join(WEB_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');

async function builtWebApp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-web-'));
  await mkdir(join(root, 'apps/web/.next/standalone/apps/web'), { recursive: true });
  await writeFile(join(root, MONOREPO_SERVER), '// serveur factice');
  return root;
}

/** Une application bâtie « normalement » : `next` installé et un BUILD_ID. */
async function nextStartApp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-web-next-'));
  await mkdir(join(root, 'apps/web/node_modules/next/dist/bin'), { recursive: true });
  await mkdir(join(root, 'apps/web/.next'), { recursive: true });
  await writeFile(join(root, NEXT_BIN), '// binaire factice');
  await writeFile(join(root, BUILD_ID), 'build-factice');
  return root;
}

/** Le premier appel au serveur : c'est `node`, jamais le navigateur. */
function serverCall(world: ReturnType<typeof fakeWorld>) {
  return world.calls.find((call) => call.command === 'node');
}

describe('pf web', () => {
  // Les quatre tests du plan (Task 8, Step 1).
  it('démarre le serveur standalone sur 127.0.0.1, jamais 0.0.0.0', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({ cwd: await builtWebApp(), runner: world, platform: 'win32' });
    expect(await run(['web', '--no-open'], io)).toBe(0);
    const server = world.calls.find((call) => call.command === 'node');
    expect(server).toBeDefined();
    expect(server?.args.join(' ')).toContain('127.0.0.1');
    expect(server?.args.join(' ')).not.toContain('0.0.0.0');
  });

  it('sans serveur construit, dit quoi faire', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-web-vide-'));
    const io = fakeIo({ cwd: root });
    expect(await run(['web'], io)).toBe(1);
    expect(io.text().out).toContain('pnpm build');
  });

  it('un port déjà servi est refusé, pas de second serveur', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      portProbe: async () => true,
    });
    expect(await run(['web', '--no-open'], io)).toBe(1);
    expect(world.calls.find((call) => call.command === 'node')).toBeUndefined();
    expect(io.text().out).toContain('répond déjà');
  });

  it('ouvre le navigateur sans --no-open, jamais via un shell', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      platform: 'win32',
      portProbe: async () => false,
    });
    expect(await run(['web'], io)).toBe(0);
    const open = world.calls.find((call) => call.command === 'explorer');
    expect(open).toBeDefined();
    expect(open?.args.join(' ')).toContain('http://127.0.0.1');
  });

  // Ce que le plan ajoute à la lettre : le chemin du serveur, l'environnement
  // de la commande seule, les refus et le choix du navigateur.
  it('lance le serveur construit, sous la racine du dossier courant', async () => {
    const world = fakeWorld({ node: ok });
    const root = await builtWebApp();
    const io = fakeIo({ cwd: root, runner: world, portProbe: async () => false });
    expect(await run(['web', '--no-open'], io)).toBe(0);
    expect(serverCall(world)?.cwd).toBe(root);
    expect(serverCall(world)?.args[0]?.endsWith(MONOREPO_SERVER)).toBe(true);
  });

  it('accepte aussi l’application construite seule, hors arborescence de monorepo', async () => {
    const world = fakeWorld({ node: ok });
    const root = await mkdtemp(join(tmpdir(), 'pf-web-seul-'));
    await mkdir(join(root, 'apps/web/.next/standalone'), { recursive: true });
    await writeFile(join(root, FLAT_SERVER), '// serveur factice');
    const io = fakeIo({ cwd: root, runner: world, portProbe: async () => false });
    expect(await run(['web', '--no-open'], io)).toBe(0);
    expect(serverCall(world)?.args[0]?.endsWith(FLAT_SERVER)).toBe(true);
  });

  it('porte HOSTNAME et PORT dans l’environnement de la commande seule', async () => {
    const world = fakeWorld({ node: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      env: { EXISTANT: 'oui' },
      portProbe: async () => false,
    });
    expect(await run(['web', '--no-open'], io)).toBe(0);
    expect(serverCall(world)?.options?.env).toEqual({ HOSTNAME: '127.0.0.1', PORT: '4173' });
    // L'environnement du CLI n'est jamais touché : `RunOptions.env` suffit.
    expect(io.env).toEqual({ EXISTANT: 'oui' });
    expect(JSON.stringify(serverCall(world)?.options?.env)).not.toContain('0.0.0.0');
  });

  it('avec --no-open, aucun navigateur n’est lancé', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      platform: 'win32',
      portProbe: async () => false,
    });
    expect(await run(['web', '--no-open'], io)).toBe(0);
    expect(world.calls.map((call) => call.command)).toEqual(['node']);
  });

  it('sonde le port demandé, sur 127.0.0.1', async () => {
    const world = fakeWorld({ node: ok });
    const probes: [string, number][] = [];
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      portProbe: async (host, port) => {
        probes.push([host, port]);
        return false;
      },
    });
    expect(await run(['web', '--port', '5000', '--no-open'], io)).toBe(0);
    expect(probes).toEqual([['127.0.0.1', 5000]]);
    expect(serverCall(world)?.options?.env).toEqual({ HOSTNAME: '127.0.0.1', PORT: '5000' });
    expect(serverCall(world)?.args.join(' ')).toContain('5000');
  });

  it('sans serveur construit, ne sonde rien et ne lance rien', async () => {
    const world = fakeWorld({ node: ok });
    const probes: string[] = [];
    const io = fakeIo({
      cwd: await mkdtemp(join(tmpdir(), 'pf-web-vide-')),
      runner: world,
      portProbe: async () => {
        probes.push('sonde');
        return false;
      },
    });
    expect(await run(['web'], io)).toBe(1);
    expect(io.text().out).toContain(BUILD_ID);
    expect(probes).toEqual([]);
    expect(world.calls).toEqual([]);
  });

  it('préfère `next start` à la sortie autonome, et sert depuis le dossier de l’app', async () => {
    // La sortie autonome recopie les liens pnpm : sous Windows, Node ne les
    // résout pas toujours (EPERM), et `.next/standalone` n'est pas nettoyé
    // entre deux builds. Sur une machine de développement, `next start` est le
    // mode qui marche le standalone reste le repli.
    const world = fakeWorld({ node: ok });
    const root = await nextStartApp();
    const io = fakeIo({ cwd: root, runner: world, portProbe: async () => false });

    expect(await run(['web', '--no-open', '--port', '4300'], io)).toBe(0);
    const call = serverCall(world);
    expect(call?.args[0]?.endsWith(NEXT_BIN)).toBe(true);
    expect(call?.args.slice(1)).toEqual(['start', '-H', '127.0.0.1', '-p', '4300']);
    expect(call?.cwd).toBe(join(root, WEB_DIR));
    expect(call?.options?.env).toEqual({ HOSTNAME: '127.0.0.1', PORT: '4300' });
  });

  it('sans `next` installé, retombe sur la sortie autonome', async () => {
    const world = fakeWorld({ node: ok });
    // Une application **distribuée** : la sortie autonome et son BUILD_ID,
    // sans `node_modules/next` c'est là que le standalone est le bon mode.
    const root = await mkdtemp(join(tmpdir(), 'pf-web-dist-'));
    await mkdir(join(root, 'apps/web/.next/standalone/apps/web'), { recursive: true });
    await writeFile(join(root, BUILD_ID), 'build-factice');
    await writeFile(join(root, MONOREPO_SERVER), '// serveur factice');
    const io = fakeIo({ cwd: root, runner: world, portProbe: async () => false });

    expect(await run(['web', '--no-open'], io)).toBe(0);
    expect(serverCall(world)?.args[0]?.endsWith(MONOREPO_SERVER)).toBe(true);
    expect(serverCall(world)?.cwd).toBe(root);
  });

  it('un port déjà servi n’ouvre pas non plus le navigateur', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      platform: 'win32',
      portProbe: async () => true,
    });
    expect(await run(['web'], io)).toBe(1);
    expect(world.calls).toEqual([]);
  });

  for (const [platform, expected] of [
    ['win32', 'explorer'],
    ['darwin', 'open'],
    ['linux', 'xdg-open'],
  ] as const) {
    it(`sur ${platform}, ouvre ${expected} avec l’URL en argument`, async () => {
      const world = fakeWorld({ node: ok, explorer: ok, open: ok, 'xdg-open': ok });
      const io = fakeIo({
        cwd: await builtWebApp(),
        runner: world,
        platform,
        portProbe: async () => false,
      });
      expect(await run(['web', '--port', '5000'], io)).toBe(0);
      const open = world.calls.find((call) => call.command === expected);
      expect(open).toBeDefined();
      // L'URL est un argument à part : rien n'est concaténé dans une ligne de
      // commande, donc aucun shell n'intervient.
      expect(open?.args).toEqual(['http://127.0.0.1:5000']);
    });
  }

  it('sur win32, explorer rend 1 sans que cela fasse échouer la commande', async () => {
    // explorer.exe sort en 1 même quand la page s'ouvre : ce code n'est pas un verdict.
    const world = fakeWorld({ node: ok, explorer: () => ({ exitCode: 1, output: '' }) });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      platform: 'win32',
      portProbe: async () => false,
    });
    expect(await run(['web'], io)).toBe(0);
    expect(io.text().out).not.toContain('Navigateur non ouvert');
  });

  it('un navigateur introuvable : le dit, mais le serveur reste lancé', async () => {
    // Aucune réponse scriptée pour xdg-open : le monde lève ENOENT.
    const world = fakeWorld({ node: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      platform: 'linux',
      portProbe: async () => false,
    });
    expect(await run(['web'], io)).toBe(0);
    expect(io.text().out).toContain('Ouvrez http://127.0.0.1:4173 vous-même.');
  });

  it('un serveur qui s’arrête en erreur : code 1, avec la sortie', async () => {
    const world = fakeWorld({
      node: () => ({ exitCode: 1, output: 'Error: listen EADDRINUSE: address already in use' }),
    });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      portProbe: async () => false,
    });
    expect(await run(['web', '--no-open'], io)).toBe(1);
    expect(io.text().err).toContain('code 1');
    expect(io.text().err).toContain('EADDRINUSE');
  });

  it('un serveur qui ne peut pas être lancé du tout : code 1', async () => {
    // Aucune réponse scriptée pour node : le monde lève ENOENT, comme un PATH sans node.
    const world = fakeWorld();
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      portProbe: async () => false,
    });
    expect(await run(['web', '--no-open'], io)).toBe(1);
    expect(io.text().err).toContain('ENOENT');
  });

  it('un serveur qui s’arrête sans rien dire : code 1 quand même', async () => {
    const world = fakeWorld({ node: () => ({ exitCode: 2, output: '' }) });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      portProbe: async () => false,
    });
    expect(await run(['web', '--no-open'], io)).toBe(1);
    expect(io.text().err).toContain('code 2');
  });

  it('--help décrit la commande, sans rien lancer', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({ runner: world, platform: 'win32' });
    expect(await run(['web', '--help'], io)).toBe(0);
    expect(io.text().out).toContain('pf web [--port <n>] [--no-open]');
    expect(io.text().out).toContain('4173');
    expect(world.calls).toEqual([]);
  });

  for (const args of [
    ['web', '--port', '0'],
    ['web', '--port', '70000'],
    ['web', '--port', 'abc'],
    ['web', '--port', ''],
    ['web', '--port'],
    ['web', '--port', '-1'],
    ['web', 'ailleurs'],
    ['web', '--open'],
  ]) {
    it(`mauvais usage : ${args.join(' ')}`, async () => {
      const world = fakeWorld({ node: ok });
      const io = fakeIo({ cwd: await builtWebApp(), runner: world, portProbe: async () => false });
      expect(await run(args, io)).toBe(2);
      expect(world.calls).toEqual([]);
    });
  }
});

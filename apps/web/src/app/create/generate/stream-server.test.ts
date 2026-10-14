import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CommandRunner, RunOptions } from '@buildit/exec';
import { afterEach, describe, expect, it } from 'vitest';
import { readRegistry } from '../../../lib/output-registry';
import type { SessionDeps } from '../../github/session';
import { saasManifest } from './fixtures';
import { type GenerateStreamEvent, runGenerateStream } from './stream-server';

/**
 * La logique de `POST /api/generate`, éprouvée sur un vrai disque temporaire
 * et un faux gestionnaire de paquets : ce qui est refusé avant d'écrire, ce
 * qui est annoncé pendant, et ce qui est dit à la fin, y compris quand
 * l'installation échoue après une écriture réussie.
 */

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function temporary(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  created.push(path);
  return path;
}

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly options?: RunOptions;
}

function fakeRunner(exitCode: number, calls: Call[] = []): CommandRunner {
  return {
    run: async (command, args, cwd, options) => {
      calls.push({ command, args, cwd, ...(options === undefined ? {} : { options }) });
      return { exitCode, output: exitCode === 0 ? '' : 'ERR_PNPM_FETCH_404 introuvable' };
    },
  };
}

async function run(
  body: unknown,
  options: { hosted?: boolean; runner?: CommandRunner; session?: SessionDeps } = {},
) {
  const registryRoot = await temporary('pf-gen-registre-');
  const events: GenerateStreamEvent[] = [];
  const done = await runGenerateStream(
    body,
    {
      hosted: options.hosted ?? false,
      registryRoot,
      runner: options.runner ?? fakeRunner(0),
      ...(options.session === undefined ? {} : { session: options.session }),
    },
    (event) => events.push(event),
  );
  return { done, events, registryRoot };
}

describe('runGenerateStream les refus, avant toute écriture', () => {
  it('refuse en mode hébergé, sans lire le chemin reçu', async () => {
    const parent = await temporary('pf-gen-heberge-');
    const { done, events } = await run(
      { manifest: saasManifest(), parent, install: true },
      { hosted: true },
    );
    expect(events).toEqual([done]);
    expect(done.ok).toBe(false);
    expect(done.issues.join(' ')).toContain('pf web');
    expect(await readdir(parent)).toEqual([]);
  });

  it('refuse un manifest invalide', async () => {
    const parent = await temporary('pf-gen-manifest-');
    const { done, events } = await run({ manifest: { name: '../evade' }, parent });
    expect(events).toHaveLength(1);
    expect(done.ok).toBe(false);
    expect(done.issues.length).toBeGreaterThan(0);
    expect(await readdir(parent)).toEqual([]);
  });

  it('refuse un corps qui n’est pas un objet', async () => {
    const { done } = await run('nimporte quoi');
    expect(done.ok).toBe(false);
  });

  it('refuse un parent relatif ou inaccessible', async () => {
    const relative = await run({ manifest: saasManifest(), parent: 'relatif/dossier' });
    expect(relative.done.ok).toBe(false);

    const missing = await run({
      manifest: saasManifest(),
      parent: join(tmpdir(), 'pf-gen-absent-zzz', 'nulle-part'),
    });
    expect(missing.done.ok).toBe(false);
    expect(missing.done.issues.join(' ')).toContain('n’est pas accessible');
  });

  it('refuse un dossier de projet déjà rempli, sans y toucher', async () => {
    const parent = await temporary('pf-gen-pris-');
    const taken = join(parent, 'mon-projet');
    await mkdir(taken);
    await writeFile(join(taken, 'a-moi.txt'), 'garde', 'utf8');

    const { done, events, registryRoot } = await run({ manifest: saasManifest(), parent });
    expect(events).toEqual([done]);
    expect(done.ok).toBe(false);
    expect(done.issues.join(' ')).toContain('n’est pas vide');
    expect(await readdir(taken)).toEqual(['a-moi.txt']);
    expect(await readRegistry(registryRoot)).toEqual([]);
  });
});

describe('runGenerateStream l’écriture et l’installation, annoncées dans l’ordre', () => {
  it('écrit sans installer : writing → written → done, et inscrit le dossier au registre', async () => {
    const parent = await temporary('pf-gen-ecrit-');
    const calls: Call[] = [];
    const { done, events, registryRoot } = await run(
      { manifest: saasManifest(), parent, install: false },
      { runner: fakeRunner(0, calls) },
    );
    const directory = join(parent, 'mon-projet');

    expect(events.map((event) => event.type)).toEqual(['phase', 'written', 'done']);
    expect(events[1]).toEqual({
      type: 'written',
      directory,
      files: done.files.length,
      bytes: done.bytes,
    });
    expect(done.ok).toBe(true);
    expect(done.directory).toBe(directory);
    expect(done.installRequested).toBe(false);
    expect(done.installed).toBe(false);
    expect(calls).toEqual([]);

    const packageJson = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    expect(packageJson.name).toBe('mon-projet');
    expect(await readRegistry(registryRoot)).toEqual([directory]);
  });

  it('accepte un dossier de projet vide déjà créé', async () => {
    const parent = await temporary('pf-gen-vide-');
    await mkdir(join(parent, 'mon-projet'));
    const { done } = await run({ manifest: saasManifest(), parent });
    expect(done.ok).toBe(true);
  });

  it('installe après l’écriture, annonce la commande, et ne transmet aucun secret', async () => {
    const parent = await temporary('pf-gen-installe-');
    const calls: Call[] = [];
    const { done, events } = await run(
      { manifest: saasManifest(), parent, install: true },
      { runner: fakeRunner(0, calls) },
    );

    expect(events.map((event) => event.type)).toEqual(['phase', 'written', 'phase', 'done']);
    const installing = events[2];
    expect(installing).toMatchObject({ type: 'phase', phase: 'installing' });
    expect(done.ok).toBe(true);
    expect(done.installRequested).toBe(true);
    expect(done.installed).toBe(true);
    expect(done.installIssues).toEqual([]);
    expect(done.steps).toContain('install');
    expect(done.installCommand).toBeDefined();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]?.cwd).toBe(join(parent, 'mon-projet'));
    expect(calls[0]?.options?.env?.['PF_GITHUB_TOKEN']).toBe('');
  });

  it('une installation en échec garde le projet écrit et le dit', async () => {
    const parent = await temporary('pf-gen-echec-');
    const { done } = await run(
      { manifest: saasManifest(), parent, install: true },
      { runner: fakeRunner(1) },
    );
    expect(done.ok).toBe(true);
    expect(done.installed).toBe(false);
    expect(done.installIssues.length).toBeGreaterThan(0);
    expect(done.steps).not.toContain('install');
    expect(await readFile(join(parent, 'mon-projet', 'package.json'), 'utf8')).toContain(
      'mon-projet',
    );
  });

  it('un gestionnaire introuvable n’est jamais pris pour une installation réussie', async () => {
    const parent = await temporary('pf-gen-absent-');
    const throwing: CommandRunner = {
      run: async () => {
        throw new Error('spawn pnpm ENOENT');
      },
    };
    const { done } = await run(
      { manifest: saasManifest(), parent, install: true },
      { runner: throwing },
    );
    expect(done.ok).toBe(true);
    expect(done.installed).toBe(false);
    expect(done.installIssues.length).toBeGreaterThan(0);
  });

  it('un registre impossible à écrire n’annule pas le projet, il le signale', async () => {
    const parent = await temporary('pf-gen-registre-ko-');
    // Un fichier là où le dossier de travail devrait être : le registre ne
    // peut pas être créé.
    const blocker = join(await temporary('pf-gen-bloque-'), 'fichier');
    await writeFile(blocker, 'pas un dossier', 'utf8');
    const events: GenerateStreamEvent[] = [];
    const done = await runGenerateStream(
      { manifest: saasManifest(), parent },
      { hosted: false, registryRoot: blocker, runner: fakeRunner(0) },
      (event) => events.push(event),
    );
    expect(done.ok).toBe(true);
    expect(done.warnings.join(' ')).toContain('registre');
  });
});

describe('runGenerateStream la connexion GitHub, un choix jamais une obligation', () => {
  function sessionWithoutToken(): SessionDeps {
    return {
      fetch: async () => {
        throw new Error('aucun réseau attendu sans jeton');
      },
      store: {
        get: async () => undefined,
        set: async () => undefined,
        delete: async () => undefined,
        location: 'test',
      },
      clientId: 'client-id',
    };
  }

  it('sans demande GitHub, rien n’est créé et aucun champ ne part', async () => {
    const parent = await temporary('pf-gen-sans-gh-');
    const { done } = await run({ manifest: saasManifest(), parent, install: false });
    expect(done.ok).toBe(true);
    expect(done.repositoryUrl).toBeUndefined();
    expect(done.githubIssues).toBeUndefined();
  });

  it('une demande GitHub sans session est signalée, le projet reste écrit', async () => {
    const parent = await temporary('pf-gen-gh-sans-session-');
    const { done } = await run({
      manifest: saasManifest(),
      parent,
      install: false,
      github: { name: 'mon-projet' },
    });
    expect(done.ok).toBe(true);
    expect(done.repositoryUrl).toBeUndefined();
    expect(done.githubIssues?.join(' ')).toContain('session');
  });

  it('une demande GitHub sans jeton échoue proprement, sans casser la génération', async () => {
    const parent = await temporary('pf-gen-gh-sans-jeton-');
    const { done } = await run(
      { manifest: saasManifest(), parent, install: false, github: { name: 'mon-projet' } },
      { session: sessionWithoutToken() },
    );
    expect(done.ok).toBe(true);
    expect(done.repositoryUrl).toBeUndefined();
    expect(done.githubIssues?.join(' ')).toContain('Connectez-vous à GitHub');
  });

  it('un nom de dépôt vide ou absent n’est pas pris pour une demande', async () => {
    const parent = await temporary('pf-gen-gh-vide-');
    const { done } = await run(
      { manifest: saasManifest(), parent, install: false, github: { name: '   ' } },
      { session: sessionWithoutToken() },
    );
    expect(done.ok).toBe(true);
    expect(done.repositoryUrl).toBeUndefined();
    expect(done.githubIssues).toBeUndefined();
  });
});

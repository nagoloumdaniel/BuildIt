import { mkdir, mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { CommandResult, CommandRunner, RunOptions } from '@buildit/exec';
import { parseRemote } from '@buildit/git';
import { afterEach, describe, expect, it } from 'vitest';
import { clonePreviewAction, cloneProjectAction } from '../actions-node';
import { cloneProject, planClone } from './clone';
import {
  defaultFolder,
  destinationState,
  resolveAbsoluteDestination,
  resolveDestination,
  webWorkspaceRoot,
} from './destination';

/**
 * Le clone, contre un **faux runner** : aucune commande Git réelle n'est lancée.
 * Le disque, lui, est réel un dossier temporaire parce que c'est justement
 * ce que `packages/git` doit laisser propre.
 */

const TOKEN = 'ghp_clone_0123456789abcdefghij';

interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly options?: RunOptions;
}

function fakeRunner(handler?: (call: Call) => Promise<CommandResult> | CommandResult): {
  readonly runner: CommandRunner;
  readonly calls: Call[];
} {
  const calls: Call[] = [];
  return {
    calls,
    runner: {
      async run(command, args, cwd, options) {
        const call: Call =
          options === undefined ? { command, args, cwd } : { command, args, cwd, options };
        calls.push(call);
        return handler === undefined ? { exitCode: 0, output: '' } : await handler(call);
      },
    },
  };
}

const created: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-web-clone-'));
  created.push(root);
  return root;
}

afterEach(async () => {
  delete process.env['PF_WEB_WORKSPACE'];
  delete process.env['PF_HOSTED'];
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('resolveDestination le repli relatif, seul admis en hébergé', () => {
  it('accepte un dossier simple ou imbriqué, sous la racine', async () => {
    const root = await tempRoot();
    expect(resolveDestination('mon-projet', root)).toEqual({
      ok: true,
      value: { folder: 'mon-projet', directory: resolve(root, 'mon-projet') },
    });
    expect(resolveDestination('a/b', root)).toEqual({
      ok: true,
      value: { folder: 'a/b', directory: resolve(root, 'a', 'b') },
    });
  });

  it('refuse un chemin absolu, une remontée et un nom vide', async () => {
    const root = await tempRoot();
    const absolu = resolveDestination(root, root);
    expect(absolu.ok).toBe(false);
    if (!absolu.ok) {
      expect(absolu.reason).toBe('folder');
      expect(absolu.issues.join(' ')).toContain('chemin absolu');
    }
    expect(resolveDestination('..', root).ok).toBe(false);
    expect(resolveDestination('a/../b', root).ok).toBe(false);
    expect(resolveDestination('..\\ailleurs', root).ok).toBe(false);
    expect(resolveDestination('', root).ok).toBe(false);
    expect(resolveDestination('   ', root).ok).toBe(false);
    expect(resolveDestination('a\u0000b', root).ok).toBe(false);
    expect(resolveDestination(42, root).ok).toBe(false);
  });

  it('refuse les contournements qui ne dépendent pas de la plateforme', async () => {
    const root = await tempRoot();
    // Une remontée déguisée reste une remontée, quel que soit le séparateur.
    expect(resolveDestination('a\\..\\..\\evade', root).ok).toBe(false);
    expect(resolveDestination('..\\..\\evade', root).ok).toBe(false);
    expect(resolveDestination('a/./../../evade', root).ok).toBe(false);
    // Pas de décodage d'URL : un segment percent-encodé n'est pas un nom valide.
    expect(resolveDestination('%2e%2e/evade', root).ok).toBe(false);
    // `~` n'est pas développé par Node : le refuser vaut mieux que de deviner.
    expect(resolveDestination('~/.ssh', root).ok).toBe(false);
    // Caractère de contrôle refusé avant toute résolution.
    expect(resolveDestination('a\u007fb', root).ok).toBe(false);
  });

  it.skipIf(process.platform !== 'win32')(
    'refuse UNC, lecteur, chemin étendu et unité relative (Windows)',
    async () => {
      const root = await tempRoot();
      const tentatives = [
        '\\\\serveur\\partage\\projet',
        '//serveur/partage/projet',
        '\\\\?\\C:\\Windows\\Temp\\evade',
        'C:\\Windows\\Temp\\evade',
        'C:..\\..\\evade',
        'C:/Windows/Temp/evade',
      ];
      for (const tentative of tentatives) {
        const resolved = resolveDestination(tentative, root);
        expect(resolved.ok, `« ${tentative} » doit être refusé`).toBe(false);
      }
    },
  );
});

describe('resolveAbsoluteDestination le parent choisi dans l’explorateur', () => {
  it('accepte un dossier parent absolu existant et pose le nom dedans', async () => {
    const parent = await tempRoot();

    expect(await resolveAbsoluteDestination(parent, 'mon-app')).toEqual({
      ok: true,
      value: { folder: 'mon-app', directory: join(parent, 'mon-app') },
    });
  });

  it('refuse un parent absent, un fichier, un chemin relatif ou vide', async () => {
    const parent = await tempRoot();
    const file = join(parent, 'fichier.txt');
    await writeFile(file, 'contenu');

    const absent = await resolveAbsoluteDestination(join(parent, 'absent'), 'mon-app');
    expect(absent.ok).toBe(false);
    if (!absent.ok) {
      expect(absent.reason).toBe('parent');
      expect(absent.issues.join(' ')).toContain('n’est pas accessible');
    }

    for (const rejected of [file, 'ailleurs', '']) {
      const resolved = await resolveAbsoluteDestination(rejected, 'mon-app');
      expect(resolved.ok, `« ${rejected} » doit être refusé`).toBe(false);
      if (!resolved.ok) {
        expect(resolved.reason).toBe('parent');
      }
    }
  });

  it('refuse un nom de sous-dossier qui n’est pas un simple segment', async () => {
    const parent = await tempRoot();

    for (const name of ['', 'a/b', 'a\\b', '..', 'C:\\Windows']) {
      const resolved = await resolveAbsoluteDestination(parent, name);
      expect(resolved.ok, `« ${name} » doit être refusé`).toBe(false);
      if (!resolved.ok) {
        expect(resolved.reason).toBe('folder');
      }
    }
  });
});

describe('destinationState sans rien écrire', () => {
  it('distingue absent, vide et occupé', async () => {
    const root = await tempRoot();
    const libre = join(root, 'libre');
    const vide = join(root, 'vide');
    const plein = join(root, 'plein');
    await mkdir(vide);
    await mkdir(plein);
    await writeFile(join(plein, 'fichier.txt'), 'contenu');

    expect(await destinationState(libre)).toBe('free');
    expect(await destinationState(vide)).toBe('empty');
    expect(await destinationState(plein)).toBe('taken');
    expect(await destinationState(join(plein, 'fichier.txt'))).toBe('taken');
  });

  it.skipIf(process.platform !== 'win32')(
    'suit un lien posé dans la racine constat M2 du rapport, non corrigé',
    async () => {
      // `stat` suit les liens : une jonction vers un dossier vide **hors** de la
      // racine de travail passe pour une destination libre. Ce test fige le
      // comportement constaté ; le correctif (comparer `realpath` à la racine,
      // dans `destination.ts` **et** `packages/git`) est décrit au rapport.
      const root = await tempRoot();
      const dehors = await tempRoot();
      const lien = join(root, 'lien');
      await symlink(dehors, lien, 'junction');

      expect(await destinationState(lien)).toBe('empty');
    },
  );
});

describe('defaultFolder', () => {
  it('déduit le nom du dépôt d’un lien GitHub', () => {
    const parsed = parseRemote('https://github.com/octocat/mon-app.git');
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(defaultFolder(parsed.value)).toBe('mon-app');
    }
  });
});

describe('planClone valider avant Git', () => {
  it('refuse un lien que Git lirait comme une option', async () => {
    const root = await tempRoot();
    const planned = await planClone('--upload-pack=evil', 'x', root);

    expect(planned.plan).toBeUndefined();
    expect(planned.view.ok).toBe(false);
    expect(planned.view.issues.join(' ')).toContain('commencer par');
  });

  it('refuse un dossier déjà occupé, et ne prépare rien', async () => {
    const root = await tempRoot();
    await mkdir(join(root, 'occupe'));
    await writeFile(join(root, 'occupe', 'a.txt'), 'a');

    const planned = await planClone('octocat/mon-app', 'occupe', root);

    expect(planned.plan).toBeUndefined();
    expect(planned.view.destination).toBe('taken');
    expect(planned.view.issues.join(' ')).toContain('n’écrase rien');
  });

  it('prépare la destination libre et déduit le dossier du lien', async () => {
    const root = await tempRoot();
    const planned = await planClone('octocat/mon-app', '', root);

    expect(planned.view.ok).toBe(true);
    expect(planned.view.folder).toBe('mon-app');
    expect(planned.view.label).toBe('octocat/mon-app');
    expect(planned.view.destination).toBe('free');
    expect(planned.plan?.remote.url).toBe('https://github.com/octocat/mon-app.git');
  });
});

describe('planClone la destination en local, choisie dans l’explorateur', () => {
  it('accepte un parent absolu existant et pose le sous-dossier dedans', async () => {
    const parent = await tempRoot();

    const planned = await planClone('octocat/mon-app', 'mon-app', { kind: 'parent', parent });

    expect(planned.view.ok).toBe(true);
    expect(planned.view.problem).toBeNull();
    expect(planned.view.directory).toBe(join(parent, 'mon-app'));
    expect(planned.plan?.directory).toBe(join(parent, 'mon-app'));
  });

  it('déduit le nom du sous-dossier du lien quand il n’est pas donné', async () => {
    const parent = await tempRoot();

    const planned = await planClone('octocat/mon-app', '', { kind: 'parent', parent });

    expect(planned.view.folder).toBe('mon-app');
    expect(planned.view.directory).toBe(join(parent, 'mon-app'));
  });

  it('refuse un parent absent en le nommant « pas accessible »', async () => {
    const parent = await tempRoot();

    const planned = await planClone('octocat/mon-app', 'mon-app', {
      kind: 'parent',
      parent: join(parent, 'absent'),
    });

    expect(planned.plan).toBeUndefined();
    expect(planned.view.problem).toBe('parent');
    expect(planned.view.directory).toBe('');
    expect(planned.view.issues.join(' ')).toContain('n’est pas accessible');
  });

  it('classe un dossier déjà occupé, avec son lot d’issues', async () => {
    const parent = await tempRoot();
    await mkdir(join(parent, 'occupe'));
    await writeFile(join(parent, 'occupe', 'a.txt'), 'a');

    const planned = await planClone('octocat/mon-app', 'occupe', { kind: 'parent', parent });

    expect(planned.plan).toBeUndefined();
    expect(planned.view.problem).toBe('occupied');
    expect(planned.view.destination).toBe('taken');
    expect(planned.view.issues.join(' ')).toContain('n’écrase rien');
  });
});

describe('cloneProject le clone, puis l’installation', () => {
  it('ne lance aucune commande quand le lien est refusé', async () => {
    const root = await tempRoot();
    const fake = fakeRunner();

    const result = await cloneProject({
      link: '--upload-pack=evil',
      folder: 'x',
      install: true,
      ignoreScripts: true,
      root,
      runner: fake.runner,
    });

    expect(result.ok).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it('clone sans installer, et ne met jamais le jeton dans un argument', async () => {
    const root = await tempRoot();
    const fake = fakeRunner();

    const result = await cloneProject({
      link: 'https://github.com/octocat/mon-app.git',
      folder: 'mon-app',
      install: false,
      ignoreScripts: true,
      root,
      runner: fake.runner,
      token: TOKEN,
    });

    expect(result.ok).toBe(true);
    expect(result.directory).toBe(join(root, 'mon-app'));
    await expect(stat(result.directory)).resolves.toBeDefined();
    expect(fake.calls).toHaveLength(1);
    const [call] = fake.calls;
    expect(call?.command).toBe('git');
    expect(call?.args).toContain('clone');
    expect(call?.args).toContain('https://github.com/octocat/mon-app.git');
    // Le jeton passe par l'environnement du processus Git, jamais par `ps`.
    expect(call?.args.join(' ')).not.toContain(TOKEN);
    expect(call?.options?.env?.['PF_GIT_TOKEN']).toBe(TOKEN);
  });

  it('clone directement sous le parent absolu choisi dans l’explorateur', async () => {
    const parent = await tempRoot();
    const fake = fakeRunner();

    const result = await cloneProject({
      link: 'https://github.com/octocat/mon-app.git',
      folder: 'mon-app',
      install: false,
      ignoreScripts: true,
      root: { kind: 'parent', parent },
      runner: fake.runner,
    });

    expect(result.ok).toBe(true);
    expect(result.directory).toBe(join(parent, 'mon-app'));
    await expect(stat(result.directory)).resolves.toBeDefined();
    expect(fake.calls[0]?.cwd).toBe(parent);
  });

  it('efface le dossier créé quand le clone échoue', async () => {
    const root = await tempRoot();
    const fake = fakeRunner(() => ({
      exitCode: 128,
      output: 'fatal: Authentication failed for repository',
    }));

    const result = await cloneProject({
      link: 'octocat/prive',
      folder: 'prive',
      install: false,
      ignoreScripts: true,
      root,
      runner: fake.runner,
    });

    expect(result.ok).toBe(false);
    expect(result.issues.join(' ')).toContain('accès refusé');
    await expect(stat(join(root, 'prive'))).rejects.toBeDefined();
  });

  it('installe après le clone avec le gestionnaire détecté', async () => {
    const root = await tempRoot();
    const fake = fakeRunner(async (call) => {
      if (call.args.includes('clone')) {
        const target = call.args[call.args.length - 1] ?? '';
        await writeFile(join(target, 'package.json'), JSON.stringify({ name: 'mon-app' }));
        await writeFile(join(target, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');
      }
      return { exitCode: 0, output: '' };
    });

    const result = await cloneProject({
      link: 'octocat/mon-app',
      folder: 'mon-app',
      install: true,
      ignoreScripts: true,
      root,
      runner: fake.runner,
    });

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.project?.packageManager).toBe('pnpm');
    expect(result.installCommand).toBe('pnpm install --ignore-scripts');
    const installCall = fake.calls[1];
    expect(installCall?.command).toBe('pnpm');
    expect(installCall?.args).toEqual(['install', '--ignore-scripts']);
    expect(installCall?.cwd).toBe(join(root, 'mon-app'));
  });

  it('un dépôt qui n’est pas un projet reconnu est un avertissement, pas un échec', async () => {
    const root = await tempRoot();
    const fake = fakeRunner();

    const result = await cloneProject({
      link: 'octocat/mon-app',
      folder: 'mon-app',
      install: true,
      ignoreScripts: true,
      root,
      runner: fake.runner,
    });

    expect(result.ok).toBe(true);
    expect(result.installed).toBe(false);
    expect(result.warnings.join(' ')).toContain('Aucun projet reconnu');
  });
});

describe('les Server Actions du clone validation avant tout accès', () => {
  it('refuse un lien invalide sans rien préparer', async () => {
    const preview = await clonePreviewAction('--upload-pack=evil', 'x');
    expect(preview.ok).toBe(false);
    expect(preview.issues.join(' ')).toContain('commencer par');

    const result = await cloneProjectAction({ link: '--upload-pack=evil', folder: 'x' });
    expect(result.ok).toBe(false);
    expect(result.installed).toBe(false);
  });

  it('accepte un parent absolu local quand il existe, et le refuse sinon', async () => {
    const parent = await tempRoot();

    const accepted = await clonePreviewAction('octocat/mon-app', 'mon-app', parent);
    expect(accepted.ok).toBe(true);
    expect(accepted.problem).toBeNull();
    expect(accepted.directory).toBe(join(parent, 'mon-app'));

    const absent = await clonePreviewAction('octocat/mon-app', 'mon-app', join(parent, 'absent'));
    expect(absent.ok).toBe(false);
    expect(absent.problem).toBe('parent');
    expect(absent.directory).toBe('');
    expect(absent.issues.join(' ')).toContain('n’est pas accessible');
  });

  it('refuse un parent qui est un fichier, pas un dossier', async () => {
    const parent = await tempRoot();
    const file = join(parent, 'fichier.txt');
    await writeFile(file, 'contenu');

    const preview = await clonePreviewAction('octocat/mon-app', 'mon-app', file);

    expect(preview.ok).toBe(false);
    expect(preview.problem).toBe('parent');
    expect(preview.issues.join(' ')).toContain('n’est pas un dossier');
  });

  it('refuse un dossier à séparateur de chemin dans le nom du sous-dossier', async () => {
    const parent = await tempRoot();

    const preview = await clonePreviewAction('octocat/mon-app', 'a/mon-app', parent);

    expect(preview.ok).toBe(false);
    expect(preview.problem).toBe('folder');
  });

  it('en hébergé, garde le repli relatif et refuse le chemin absolu', async () => {
    const root = await tempRoot();
    process.env['PF_WEB_WORKSPACE'] = root;
    process.env['PF_HOSTED'] = '1';

    // Un chemin absolu venu du navigateur serait une écriture arbitraire sur
    // le serveur : en hébergé, la racine de travail est la seule destination.
    const absolu = await clonePreviewAction('octocat/mon-app', resolve('ailleurs'));
    expect(absolu.ok).toBe(false);
    expect(absolu.problem).toBe('folder');
    expect(absolu.issues.join(' ')).toContain('chemin absolu');

    const relatif = await clonePreviewAction('octocat/mon-app', 'a/mon-app');
    expect(relatif.ok).toBe(true);
    expect(relatif.directory).toBe(join(webWorkspaceRoot(), 'a', 'mon-app'));
  });
});

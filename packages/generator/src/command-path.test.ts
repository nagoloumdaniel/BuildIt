import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveCommand } from './command-path.js';

/**
 * La sonde qui manquait au test de fumée.
 *
 * La première version de `socle.smoke.ts` lançait `pnpm` par `spawn` et
 * `execFileSync` directs. Sous Windows, `pnpm` est un `pnpm.cmd` : Node refuse
 * de l'exécuter sans shell, l'appel échoue en `ENOENT`, et 14 des 19 cas du
 * test de fumée tombaient — non pas à cause du code généré, mais du harnais.
 * Le gate M3 n'était donc plus vérifiable sur cette plateforme, et rien ne le
 * disait.
 *
 * Ce fichier ne génère rien et ne touche pas au réseau : il vérifie **la seule
 * chose qui manquait**, à savoir que la commande résolue s'exécute vraiment.
 * C'est ce qui rend le reste du test de fumée croyable là où il tourne.
 */
describe('la commande d’un projet généré est lançable (prérequis du gate M3)', () => {
  it('résout pnpm et l’exécute pour de vrai', () => {
    const resolved = resolveCommand('pnpm');
    // Jamais un `.cmd` ni un `.bat` : c'est précisément ce que Node refuse.
    expect(resolved.file.toLowerCase().endsWith('.cmd')).toBe(false);
    expect(resolved.file.toLowerCase().endsWith('.bat')).toBe(false);

    const version = execFileSync(resolved.file, [...resolved.prefix, '--version'], {
      stdio: 'pipe',
      timeout: 60_000,
    })
      .toString()
      .trim();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('résout une commande sans lanceur npm par un chemin, sans exception', () => {
    // `docker` n'a pas de lanceur npm : la résolution doit rendre soit un chemin
    // exécutable, soit la commande telle quelle. Dans les deux cas, elle ne
    // lève pas — c'est ce que le harnais appelle avant chaque commande.
    const resolved = resolveCommand('docker');
    expect(typeof resolved.file).toBe('string');
    expect(Array.isArray(resolved.prefix)).toBe(true);
  });

  it('laisse une commande inconnue intacte, pour que l’échec soit honnête', () => {
    // Une commande introuvable doit échouer avec son vrai nom dans le message,
    // jamais avec un chemin fabriqué : sinon le diagnostic est faux.
    const resolved = resolveCommand('pf-commande-qui-nexiste-pas');
    expect(resolved.file).toBe('pf-commande-qui-nexiste-pas');
    expect(resolved.prefix).toEqual([]);
  });

  it('ne touche à rien hors Windows', () => {
    // Sur une plateforme POSIX, `pnpm` est un script exécutable : la résolution
    // rend la commande telle quelle.
    expect(resolveCommand('pnpm', 'linux')).toEqual({ file: 'pnpm', prefix: [] });
    expect(resolveCommand('pnpm', 'darwin', '/usr/bin:/usr/local/bin')).toEqual({
      file: 'pnpm',
      prefix: [],
    });
  });

  it('trouve un exécutable `.exe` dans le PATH, sans passer par un lanceur', () => {
    // Chemin Windows simulé : un vrai fichier `.exe` (Node lui-même, copié) dans
    // un dossier temporaire. C'est la seule façon d'éprouver la première boucle
    // sans être sous Windows.
    const directory = mkdtempSync(join(tmpdir(), 'pf-path-'));
    try {
      const candidate = join(directory, 'outil.exe');
      copyFileSync(process.execPath, candidate);
      const resolved = resolveCommand('outil', 'win32', directory);
      expect(resolved.file).toBe(candidate);
      expect(resolved.prefix).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('préfère un `.exe` à un lanceur `.cmd` du même nom', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pf-path-'));
    try {
      copyFileSync(process.execPath, join(directory, 'outil.exe'));
      writeFileSync(join(directory, 'outil.cmd'), '@echo off\n', 'utf8');
      const resolved = resolveCommand('outil', 'win32', directory);
      expect(resolved.file).toBe(join(directory, 'outil.exe'));
      expect(resolved.prefix).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('remplace un lanceur `.cmd` par son script Node quand il en cache un', () => {
    // Le cas réel de pnpm : `pnpm.cmd` voisine `node_modules/pnpm/bin/pnpm.cjs`.
    // La résolution doit rendre Node + le script — jamais le `.cmd`, que Node
    // refuserait de lancer.
    const directory = mkdtempSync(join(tmpdir(), 'pf-path-'));
    try {
      const bin = join(directory, 'node_modules', 'pnpm', 'bin');
      mkdirSync(bin, { recursive: true });
      writeFileSync(join(directory, 'pnpm.cmd'), '@echo off\n', 'utf8');
      writeFileSync(join(bin, 'pnpm.cjs'), 'console.log("1.0.0");\n', 'utf8');
      const resolved = resolveCommand('pnpm', 'win32', directory);
      expect(resolved.file).toBe(process.execPath);
      expect(resolved.prefix).toEqual([join(bin, 'pnpm.cjs')]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rend la commande intacte quand un `.cmd` ne cache aucun script', () => {
    // Sans script trouvé, on ne fabrique pas un chemin : l'échec doit nommer la
    // vraie commande, pas un fichier inventé.
    const directory = mkdtempSync(join(tmpdir(), 'pf-path-'));
    try {
      writeFileSync(join(directory, 'outil.cmd'), '@echo off\n', 'utf8');
      expect(resolveCommand('outil', 'win32', directory)).toEqual({ file: 'outil', prefix: [] });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('ignore les segments vides d’un PATH, fréquents sous Windows', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pf-path-'));
    try {
      copyFileSync(process.execPath, join(directory, 'outil.exe'));
      // Un `;;` en tête est courant (variable non définie concaténée) : le
      // résoudre en `join('', …)` chercherait dans le dossier courant.
      expect(resolveCommand('outil', 'win32', `;;${directory};`).file).toBe(
        join(directory, 'outil.exe'),
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

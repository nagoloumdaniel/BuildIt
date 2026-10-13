import { describe, expect, it } from 'vitest';
import { classifyArchivePath, commonRoot, stripRoot } from './clone-paths';

/** La sûreté des chemins d'archive : rien ne sort du dossier choisi. */

describe('classifyArchivePath', () => {
  it('accepte un chemin relatif ordinaire, en segments', () => {
    expect(classifyArchivePath('src/app/page.tsx')).toEqual({
      kind: 'ok',
      path: 'src/app/page.tsx',
      segments: ['src', 'app', 'page.tsx'],
    });
    expect(classifyArchivePath('.github/workflows/ci.yml').kind).toBe('ok');
    expect(classifyArchivePath('.env.example').kind).toBe('ok');
  });

  it('refuse toute tentative de sortir du dossier (zip slip)', () => {
    for (const path of [
      '',
      '../evil',
      'a/../../evil',
      'a/./b',
      'a//b',
      '/etc/passwd',
      'C:/Windows/x',
      'c:evil',
      'a\\..\\b',
      'a/b\u0000c',
      'a/b\nc',
    ]) {
      expect(classifyArchivePath(path), path).toEqual({ kind: 'unsafe', path });
    }
  });

  it('écarte, sans refuser l’archive, ce que Windows n’écrit pas', () => {
    for (const path of [
      'docs/a:b.md',
      'what?.txt',
      'star*.txt',
      'pipe|x',
      'q"x',
      'lt<x',
      'gt>x',
      'aux',
      'src/CON.txt',
      'nul.tar.gz',
      'com1',
      'LPT9.log',
      'trailing.',
      'space ',
    ]) {
      expect(classifyArchivePath(path), path).toEqual({ kind: 'skip', path });
    }
    // Un nom qui ressemble seulement à un nom réservé reste valable.
    expect(classifyArchivePath('console.log').kind).toBe('ok');
    expect(classifyArchivePath('auxiliary/x').kind).toBe('ok');
  });
});

describe('commonRoot / stripRoot', () => {
  it('trouve le dossier racine de GitHub et le retire', () => {
    const names = ['octo-hello-1a2b/README.md', 'octo-hello-1a2b/src/a.ts'];
    const root = commonRoot(names);
    expect(root).toBe('octo-hello-1a2b');
    expect(stripRoot('octo-hello-1a2b/src/a.ts', root)).toBe('src/a.ts');
    expect(stripRoot('ailleurs/x', root)).toBe('ailleurs/x');
  });

  it('ne retire rien sans racine commune', () => {
    expect(commonRoot(['a/x', 'b/y'])).toBeUndefined();
    expect(commonRoot(['README.md', 'a/x'])).toBeUndefined();
    expect(commonRoot(['/abs'])).toBeUndefined();
    expect(commonRoot([])).toBeUndefined();
    expect(stripRoot('a/x', undefined)).toBe('a/x');
  });
});

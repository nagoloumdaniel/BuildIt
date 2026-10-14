import { describe, expect, it } from 'vitest';
import { formatBytes, targetDirectory } from './steps';

/**
 * Ce que l'écran Generation (§6.13) et le rapport (§6.14) affichent hors de
 * toute mesure du moteur : le poids, et le dossier montré avant d'écrire.
 */

describe('formatBytes le poids du rapport', () => {
  it.each([
    [0, '0 o'],
    [1, '1 o'],
    [512, '512 o'],
    [1024, '1,0 ko'],
    [1536, '1,5 ko'],
    [1048576, '1,0 Mo'],
    [5 * 1024 * 1024 * 1024, '5,0 Go'],
  ])('%i octets → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('un nombre négatif ou non fini ne casse pas l’écran', () => {
    expect(formatBytes(-1)).toBe('0 o');
    expect(formatBytes(Number.NaN)).toBe('0 o');
  });
});

describe('targetDirectory le dossier montré AVANT d’écrire', () => {
  it('compose un chemin POSIX', () => {
    expect(targetDirectory('/tmp/pf', 'mon-projet')).toBe('/tmp/pf/mon-projet');
  });

  it('compose un chemin Windows sans doubler le séparateur', () => {
    expect(targetDirectory('C:\\Users\\moi\\buildit\\', 'mon-projet')).toBe(
      'C:\\Users\\moi\\buildit\\mon-projet',
    );
  });

  it('garde la barre inverse d’un dossier Windows choisi dans l’explorateur', () => {
    expect(targetDirectory('D:\\Projets', 'mon-projet')).toBe('D:\\Projets\\mon-projet');
  });

  it('la racine « / » reste une racine', () => {
    expect(targetDirectory('/', 'mon-projet')).toBe('/mon-projet');
  });

  it('une racine vide rend le seul nom de projet', () => {
    expect(targetDirectory('', 'mon-projet')).toBe('mon-projet');
  });
});

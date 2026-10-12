import { describe, expect, it } from 'vitest';
import { deletionTarget, sameDirectory } from './delete-project';

/**
 * La règle de suppression, éprouvée sur ce qui compte : ce qu'elle **refuse**.
 *
 * Une suppression récursive pilotée par le navigateur est le geste le plus
 * dangereux de l'application. Les cas d'acceptation tiennent en deux lignes ;
 * tout le reste de ce fichier décrit des chemins que quelqu'un pourrait
 * fabriquer à la main et qui ne doivent pas passer.
 */

const ROOT = 'C:\\Users\\moi\\buildit';
const POSIX_ROOT = '/home/moi/buildit';

describe('deletionTarget — ce qui est supprimable', () => {
  it('accepte un enfant direct du dossier de travail', () => {
    const target = deletionTarget(`${ROOT}\\mon-app`, ROOT, false);

    expect(target).toEqual({ ok: true, directory: `${ROOT}\\mon-app` });
  });

  it('accepte la même chose sous un système à barres obliques', () => {
    expect(deletionTarget(`${POSIX_ROOT}/mon-app`, POSIX_ROOT, false).ok).toBe(true);
  });

  it('ignore la casse du dossier de travail — Windows ne la distingue pas', () => {
    expect(deletionTarget('c:\\users\\moi\\buildit\\mon-app', ROOT, false).ok).toBe(true);
  });

  it('accepte un séparateur doublé : c’est le même dossier', () => {
    expect(deletionTarget(`${ROOT}\\\\mon-app`, ROOT, false).ok).toBe(true);
  });
});

describe('deletionTarget — ce qui est refusé, et pourquoi', () => {
  it('refuse tout en mode hébergé : il n’y a pas de dossier à supprimer', () => {
    expect(deletionTarget(`${ROOT}\\mon-app`, ROOT, true)).toEqual({
      ok: false,
      reason: 'hosted',
    });
  });

  it('refuse un dossier vide ou absent', () => {
    expect(deletionTarget('', ROOT, false)).toEqual({ ok: false, reason: 'empty' });
    expect(deletionTarget('   ', ROOT, false)).toEqual({ ok: false, reason: 'empty' });
    expect(deletionTarget(undefined, ROOT, false)).toEqual({ ok: false, reason: 'empty' });
    expect(deletionTarget(42, ROOT, false)).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuse le dossier de travail lui-même', () => {
    expect(deletionTarget(ROOT, ROOT, false)).toEqual({ ok: false, reason: 'isWorkspace' });
  });

  it('refuse un petit-enfant : seul un projet posé à la racine part d’ici', () => {
    expect(deletionTarget(`${ROOT}\\mon-app\\src`, ROOT, false)).toEqual({
      ok: false,
      reason: 'notADirectChild',
    });
  });

  it('refuse un dossier qui n’est pas dans le dossier de travail', () => {
    expect(deletionTarget('C:\\Windows\\System32', ROOT, false).ok).toBe(false);
    expect(deletionTarget('C:\\Users\\moi\\autre\\mon-app', ROOT, false)).toEqual({
      ok: false,
      reason: 'notInWorkspace',
    });
  });

  it('refuse un voisin dont le nom commence comme le dossier de travail', () => {
    // `startsWith` sur les chaînes laisserait passer celui-ci : d'où la
    // comparaison segment par segment.
    expect(deletionTarget('C:\\Users\\moi\\buildit-autre\\mon-app', ROOT, false)).toEqual({
      ok: false,
      reason: 'notInWorkspace',
    });
  });

  it('refuse un chemin qui remonte, même s’il compte le bon nombre de segments', () => {
    expect(deletionTarget(`${ROOT}\\..\\mon-app`, ROOT, false)).toEqual({
      ok: false,
      reason: 'notInWorkspace',
    });
    expect(deletionTarget(`${ROOT}\\.\\mon-app`, ROOT, false)).toEqual({
      ok: false,
      reason: 'notInWorkspace',
    });
  });

  it('refuse la racine du disque', () => {
    expect(deletionTarget('C:\\', ROOT, false).ok).toBe(false);
    expect(deletionTarget('/', POSIX_ROOT, false).ok).toBe(false);
  });
});

describe('deletionTarget — un projet écrit ailleurs, inscrit au registre', () => {
  const ELSEWHERE = 'D:\\Projets\\mon-app';

  it('accepte un dossier hors du dossier de travail s’il est au registre', () => {
    expect(deletionTarget(ELSEWHERE, ROOT, false, [ELSEWHERE])).toEqual({
      ok: true,
      directory: ELSEWHERE,
    });
  });

  it('compare le registre au chemin normalisé : barres et casse mises à part', () => {
    expect(deletionTarget('d:/projets/MON-APP/', ROOT, false, [ELSEWHERE]).ok).toBe(true);
  });

  it('sans inscription, le même dossier reste refusé', () => {
    expect(deletionTarget(ELSEWHERE, ROOT, false, ['D:\\Projets\\autre'])).toEqual({
      ok: false,
      reason: 'notInWorkspace',
    });
  });

  it('un dossier contenu dans un projet inscrit n’est pas inscrit pour autant', () => {
    expect(deletionTarget(`${ELSEWHERE}\\src`, ROOT, false, [ELSEWHERE]).ok).toBe(false);
  });

  it('le registre ne lève aucun refus commun', () => {
    expect(deletionTarget(ELSEWHERE, ROOT, true, [ELSEWHERE])).toEqual({
      ok: false,
      reason: 'hosted',
    });
    expect(deletionTarget('', ROOT, false, [ELSEWHERE])).toEqual({ ok: false, reason: 'empty' });
    expect(deletionTarget(ROOT, ROOT, false, [ROOT])).toEqual({ ok: false, reason: 'isWorkspace' });
    expect(
      deletionTarget('D:\\Projets\\..\\mon-app', ROOT, false, ['D:\\Projets\\..\\mon-app']),
    ).toEqual({
      ok: false,
      reason: 'notInWorkspace',
    });
  });

  it('même inscrite, la racine d’un disque n’est jamais supprimable', () => {
    expect(deletionTarget('D:\\', ROOT, false, ['D:\\']).ok).toBe(false);
    expect(deletionTarget('/', POSIX_ROOT, false, ['/']).ok).toBe(false);
  });
});

describe('sameDirectory', () => {
  it('ignore les barres, les séparateurs doublés et la casse', () => {
    expect(sameDirectory('C:\\Users\\Moi\\app', 'c:/users/moi/app/')).toBe(true);
    expect(sameDirectory('C:\\Users\\moi\\app', 'C:\\Users\\moi\\app2')).toBe(false);
    expect(sameDirectory('C:\\a', 'C:\\a\\b')).toBe(false);
  });
});

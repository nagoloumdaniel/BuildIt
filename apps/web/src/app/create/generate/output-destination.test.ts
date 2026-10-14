import { describe, expect, it } from 'vitest';
import { type FolderOutputMode, folderOutputMode } from './output-destination';

/**
 * La matrice de la sortie dossier : deux faits **indépendants**, quatre cas.
 *
 * Le point de non-régression : en local, le sélecteur natif du serveur ne
 * dépend **pas** du navigateur. C'est ce qui rend « choisir un dossier et
 * installer » utilisable dans Brave, Firefox ou Safari quand BuildIt tourne sur
 * la machine de l'utilisateur — y compris en `vercel dev`, que Vercel marque
 * `VERCEL=1`, et qui redevient local par `VERCEL_ENV=development`.
 */

describe('folderOutputMode', () => {
  it('attend tant que le serveur n’a pas dit s’il est local', () => {
    expect(folderOutputMode(null, false)).toBe('pending');
    expect(folderOutputMode(null, true)).toBe('pending');
  });

  it('en local, passe par le serveur même sans API d’écriture dans le navigateur', () => {
    expect(folderOutputMode(true, false)).toBe('native');
    expect(folderOutputMode(true, true)).toBe('native');
  });

  it('en hébergé, écrit depuis le navigateur quand il en est capable', () => {
    expect(folderOutputMode(false, true)).toBe('browser');
  });

  it('en hébergé sans capacité d’écriture, ne propose que le ZIP', () => {
    expect(folderOutputMode(false, false)).toBe('zip');
  });

  it('ne rend que les quatre modes prévus', () => {
    const modes: readonly FolderOutputMode[] = [
      folderOutputMode(null, false),
      folderOutputMode(true, false),
      folderOutputMode(false, true),
      folderOutputMode(false, false),
    ];
    expect(new Set(modes)).toEqual(new Set(['pending', 'native', 'browser', 'zip']));
  });
});

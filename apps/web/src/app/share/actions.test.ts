import { afterEach, describe, expect, it } from 'vitest';
import { shareLinkBaseAction } from '../actions-share';

/**
 * La seule chose que le serveur ajoute au partage : l'origine publique, quand
 * l'UI est atteinte par un autre nom que `127.0.0.1`.
 *
 * Le manifest, lui, ne passe jamais par ici c'est le fragment qui le porte.
 */

afterEach(() => {
  delete process.env['PF_SHARE_BASE_URL'];
});

describe('shareLinkBaseAction', () => {
  it('ne propose rien sans configuration : le client garde son origine', async () => {
    expect(await shareLinkBaseAction()).toBe('');
    process.env['PF_SHARE_BASE_URL'] = '   ';
    expect(await shareLinkBaseAction()).toBe('');
  });

  it('rend une origine http ou https, sans barre finale', async () => {
    process.env['PF_SHARE_BASE_URL'] = 'http://127.0.0.1:4173';
    expect(await shareLinkBaseAction()).toBe('http://127.0.0.1:4173');

    process.env['PF_SHARE_BASE_URL'] = 'https://exemple.fr/';
    expect(await shareLinkBaseAction()).toBe('https://exemple.fr');
  });

  it('refuse un schéma, un chemin, une requête ou un fragment', async () => {
    for (const value of [
      'exemple.fr',
      'ftp://exemple.fr',
      'file:///tmp/x',
      'https://exemple.fr/pf',
      'https://exemple.fr?a=1',
      'https://exemple.fr#x',
    ]) {
      process.env['PF_SHARE_BASE_URL'] = value;
      expect(await shareLinkBaseAction()).toBe('');
    }
  });
});

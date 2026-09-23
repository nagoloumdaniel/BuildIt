import { describe, expect, it } from 'vitest';
import { suggest } from './suggest.js';

describe('suggest', () => {
  it('propose la valeur la plus proche sur une transposition', () => {
    expect(suggest('wbe', ['web', 'mobile', 'desktop'])).toBe('web');
  });

  it('propose la valeur la plus proche sur une lettre manquante', () => {
    expect(suggest('mobil', ['web', 'mobile', 'desktop'])).toBe('mobile');
  });

  it('propose la valeur la plus proche sur une lettre en trop', () => {
    expect(suggest('mobille', ['web', 'mobile', 'desktop'])).toBe('mobile');
  });

  it('propose la valeur la plus proche sur une substitution', () => {
    expect(suggest('meb', ['web', 'mobile'])).toBe('web');
  });

  it('rend la valeur exacte quand elle existe', () => {
    expect(suggest('web', ['web', 'mobile'])).toBe('web');
  });

  it('ne propose rien quand rien n’est proche', () => {
    expect(suggest('zzzzzzzz', ['web', 'mobile', 'desktop'])).toBeUndefined();
  });

  it('ne propose rien sur une liste vide', () => {
    expect(suggest('web', [])).toBeUndefined();
  });

  it('ne propose rien sur une saisie vide', () => {
    expect(suggest('', ['web', 'mobile'])).toBeUndefined();
  });

  it('ignore la casse', () => {
    expect(suggest('WEB', ['web', 'mobile'])).toBe('web');
  });

  it('choisit le plus proche quand plusieurs candidats sont dans la tolérance', () => {
    expect(suggest('postgresql', ['postgres', 'postgresql', 'mysql'])).toBe('postgresql');
  });

  it('tolère davantage sur un identifiant long', () => {
    expect(suggest('github-action', ['github-actions', 'gitlab-ci'])).toBe('github-actions');
  });
});

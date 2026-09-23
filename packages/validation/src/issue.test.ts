import { describe, expect, it } from 'vitest';
import { describeValue, isPlainObject, quoteValue, valueAt } from './issue.js';
import { createMessageFormatter } from './messages.js';

describe('isPlainObject', () => {
  it.each([
    ['objet', {}, true],
    ['objet peuplé', { a: 1 }, true],
    ['null', null, false],
    ['tableau', [], false],
    ['chaîne', 'x', false],
    ['nombre', 1, false],
    ['undefined', undefined, false],
  ])('%s → %s', (_label, value, expected) => {
    expect(isPlainObject(value)).toBe(expected);
  });
});

describe('valueAt', () => {
  const input = { a: { b: [10, 20] }, c: 'x' };

  it('lit une valeur racine', () => {
    expect(valueAt(input, ['c'])).toBe('x');
  });

  it('lit une valeur imbriquée', () => {
    expect(valueAt(input, ['a', 'b'])).toEqual([10, 20]);
  });

  it('lit un index de tableau', () => {
    expect(valueAt(input, ['a', 'b', 1])).toBe(20);
  });

  it('rend undefined sur un chemin absent', () => {
    expect(valueAt(input, ['inexistant'])).toBeUndefined();
  });

  it('rend undefined quand le chemin traverse une valeur atomique', () => {
    expect(valueAt(input, ['c', 'd'])).toBeUndefined();
  });

  it('rend undefined quand un index est appliqué à un objet', () => {
    expect(valueAt(input, ['a', 0])).toBeUndefined();
  });

  it('rend l’entrée elle-même sur un chemin vide', () => {
    expect(valueAt(input, [])).toBe(input);
  });
});

describe('describeValue', () => {
  it.each([
    [null, 'null'],
    [[], 'un tableau'],
    ['x', 'une chaîne'],
    [1, 'un nombre'],
    [true, 'un booléen'],
    [undefined, 'une valeur absente'],
    [Symbol('s'), 'une valeur inattendue'],
  ])('décrit %s', (value, expected) => {
    expect(describeValue(value)).toBe(expected);
  });
});

describe('quoteValue', () => {
  it('encadre une chaîne de guillemets français', () => {
    expect(quoteValue('web')).toBe('« web »');
  });

  it('rend les autres valeurs telles quelles', () => {
    expect(quoteValue(42)).toBe('42');
    expect(quoteValue(null)).toBe('null');
  });
});

describe('createMessageFormatter', () => {
  const format = createMessageFormatter({
    SIMPLE: 'rien à interpoler',
    UN: 'valeur : {value}',
    DEUX: '{value} parmi {expected}',
  });

  it('rend un message sans paramètre', () => {
    expect(format('SIMPLE', {})).toBe('rien à interpoler');
  });

  it('interpole un paramètre', () => {
    expect(format('UN', { value: 'web' })).toBe('valeur : web');
  });

  it('interpole plusieurs paramètres', () => {
    expect(format('DEUX', { value: 'wbe', expected: 'web, mobile' })).toBe('wbe parmi web, mobile');
  });

  it('remplace un paramètre manquant plutôt que de laisser le marqueur brut', () => {
    const message = format('DEUX', { value: 'wbe' });
    expect(message).not.toMatch(/\{[a-z]+\}/);
    expect(message).toContain('wbe');
  });

  it('ignore les paramètres superflus', () => {
    expect(format('UN', { value: 'web', inutile: 'x' })).toBe('valeur : web');
  });
});

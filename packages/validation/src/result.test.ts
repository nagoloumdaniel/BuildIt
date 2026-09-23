import { describe, expect, it } from 'vitest';
import type { Issue } from './issue.js';
import { fail, ok } from './result.js';

const issue: Issue = {
  code: 'NAME_INVALID',
  path: ['name'],
  message: 'peu importe',
};

describe('ok', () => {
  it('produit un résultat discriminé par ok: true', () => {
    const result = ok({ value: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ value: 1 });
    }
  });
});

describe('fail', () => {
  it('produit un résultat discriminé par ok: false', () => {
    const result = fail([issue]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.code).toBe('NAME_INVALID');
    }
  });

  it('accepte plusieurs problèmes — la validation ne s’arrête pas au premier', () => {
    const result = fail([issue, { ...issue, path: ['targets'] }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(2);
    }
  });

  it('refuse une liste vide — un échec sans raison est un bug', () => {
    expect(() => fail([])).toThrow();
  });
});

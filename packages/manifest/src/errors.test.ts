import { describe, expect, it } from 'vitest';
import { MANIFEST_ISSUE_CODES, type ManifestIssueCode, messageFor, suggest } from './errors.js';

describe('MANIFEST_ISSUE_CODES', () => {
  it('expose les codes du spec', () => {
    expect(MANIFEST_ISSUE_CODES).toContain('MANIFEST_NOT_AN_OBJECT');
    expect(MANIFEST_ISSUE_CODES).toContain('MANIFEST_VERSION_UNSUPPORTED');
    expect(MANIFEST_ISSUE_CODES).toContain('MANIFEST_DUPLICATE_ENTRY');
  });

  it('ne contient aucun doublon', () => {
    expect(new Set(MANIFEST_ISSUE_CODES).size).toBe(MANIFEST_ISSUE_CODES.length);
  });
});

describe('messageFor', () => {
  it('rend un message pour chaque code — aucun code orphelin', () => {
    for (const code of MANIFEST_ISSUE_CODES) {
      const message = messageFor(code, {});
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain('{');
    }
  });

  it('interpole les paramètres fournis', () => {
    const message = messageFor('MANIFEST_ENUM_UNKNOWN', {
      value: 'wbe',
      expected: 'web, mobile, desktop',
    });
    expect(message).toContain('wbe');
    expect(message).toContain('web, mobile, desktop');
  });

  it('ne laisse aucun marqueur non remplacé quand un paramètre manque', () => {
    const message = messageFor('MANIFEST_ENUM_UNKNOWN', {});
    expect(message).not.toMatch(/\{[a-z]+\}/);
  });
});

describe('suggest', () => {
  it('propose la valeur la plus proche sur une faute de frappe', () => {
    expect(suggest('wbe', ['web', 'mobile', 'desktop'])).toBe('web');
  });

  it('propose la valeur la plus proche sur une lettre manquante', () => {
    expect(suggest('mobil', ['web', 'mobile', 'desktop'])).toBe('mobile');
  });

  it('ne propose rien quand rien n’est proche', () => {
    expect(suggest('zzzzzzzz', ['web', 'mobile', 'desktop'])).toBeUndefined();
  });

  it('ne propose rien sur une liste vide', () => {
    expect(suggest('web', [])).toBeUndefined();
  });

  it('ignore la casse', () => {
    expect(suggest('WEB', ['web', 'mobile'])).toBe('web');
  });
});

describe('typage des codes', () => {
  it('accepte un code valide là où ManifestIssueCode est attendu', () => {
    const code: ManifestIssueCode = 'MANIFEST_NAME_INVALID';
    expect(MANIFEST_ISSUE_CODES).toContain(code);
  });
});

import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './return-to';

describe('safeReturnTo', () => {
  it('accepte une adresse interne relative', () => {
    expect(safeReturnTo('/create/generate')).toBe('/create/generate');
    expect(safeReturnTo('/github')).toBe('/github');
  });

  it('refuse une adresse vide ou qui n’est pas un chemin', () => {
    expect(safeReturnTo('')).toBeUndefined();
    expect(safeReturnTo('   ')).toBeUndefined();
    expect(safeReturnTo('create/generate')).toBeUndefined();
    expect(safeReturnTo(42)).toBeUndefined();
    expect(safeReturnTo(null)).toBeUndefined();
  });

  it('refuse une redirection vers un domaine tiers', () => {
    expect(safeReturnTo('//evil.example')).toBeUndefined();
    expect(safeReturnTo('https://evil.example')).toBeUndefined();
    expect(safeReturnTo('\\evil')).toBeUndefined();
  });

  it('refuse les caractères de contrôle', () => {
    expect(safeReturnTo('/create/\u0000')).toBeUndefined();
  });
});

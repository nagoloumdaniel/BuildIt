import { describe, expect, it } from 'vitest';
import { currentDeepLink, deepLinkParam } from './deep-link';

describe('deepLinkParam — la section visée par un crayon du plan', () => {
  it('lit le paramètre demandé, débarrassé de ses espaces', () => {
    expect(deepLinkParam('?category=orm', 'category')).toBe('orm');
    expect(deepLinkParam('?family=payments&x=1', 'family')).toBe('payments');
    expect(deepLinkParam('?section=%20hosting%20', 'section')).toBe('hosting');
  });

  it('rend `null` quand il est absent ou vide : l’écran s’ouvre comme avant', () => {
    expect(deepLinkParam('', 'category')).toBeNull();
    expect(deepLinkParam('?category=', 'category')).toBeNull();
    expect(deepLinkParam('?other=orm', 'category')).toBeNull();
  });

  it('hors navigateur, ne lit rien', () => {
    expect(currentDeepLink('category')).toBeNull();
  });
});

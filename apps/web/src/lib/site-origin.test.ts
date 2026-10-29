import { describe, expect, it } from 'vitest';
import { LOCAL_SITE_ORIGIN, siteOrigin } from './site-origin';

describe('siteOrigin', () => {
  it('retombe sur la boucle locale sans configuration', () => {
    expect(siteOrigin({})).toBe(LOCAL_SITE_ORIGIN);
  });
  it('préfère PF_SITE_URL', () => {
    expect(siteOrigin({ PF_SITE_URL: 'https://exemple.test/' })).toBe('https://exemple.test');
  });
  it('utilise le domaine de production Vercel en hébergé', () => {
    const env = {
      VERCEL: '1',
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'a.vercel.app',
    };
    expect(siteOrigin(env)).toBe('https://a.vercel.app');
  });
  it('ignore le domaine Vercel hors hébergement (vercel dev)', () => {
    const env = {
      VERCEL: '1',
      VERCEL_ENV: 'development',
      VERCEL_PROJECT_PRODUCTION_URL: 'a.vercel.app',
    };
    expect(siteOrigin(env)).toBe(LOCAL_SITE_ORIGIN);
  });
  it('ignore une PF_SITE_URL invalide', () => {
    expect(siteOrigin({ PF_SITE_URL: 'pas une url' })).toBe(LOCAL_SITE_ORIGIN);
  });
});

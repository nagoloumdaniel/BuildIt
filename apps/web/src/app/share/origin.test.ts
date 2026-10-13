import { describe, expect, it } from 'vitest';
import { cleanOrigin, isLoopbackOrigin, originFromRequest, publicShareBase } from './origin';

/**
 * L'origine d'un lien de partage. Une seule règle compte vraiment : depuis le
 * site hébergé, jamais de boucle locale dans un lien envoyé à quelqu'un d'autre.
 */

const HOSTED = { VERCEL: '1' } as const;
const PUBLIC_REQUEST = { proto: 'https', host: 'trybuildit.vercel.app' } as const;

describe('cleanOrigin', () => {
  it('rend une origine http ou https, sans barre finale', () => {
    expect(cleanOrigin('https://exemple.fr/')).toBe('https://exemple.fr');
    expect(cleanOrigin('http://127.0.0.1:4173')).toBe('http://127.0.0.1:4173');
  });

  it('refuse un schéma, un chemin, une requête ou un fragment', () => {
    for (const value of ['exemple.fr', 'ftp://x.fr', 'https://x.fr/pf', 'https://x.fr?a', '']) {
      expect(cleanOrigin(value)).toBe('');
    }
  });
});

describe('isLoopbackOrigin', () => {
  it('reconnaît les boucles locales, et seulement elles', () => {
    expect(isLoopbackOrigin('http://127.0.0.1:4173')).toBe(true);
    expect(isLoopbackOrigin('http://localhost:3000')).toBe(true);
    expect(isLoopbackOrigin('http://[::1]:4173')).toBe(true);
    expect(isLoopbackOrigin('https://trybuildit.vercel.app')).toBe(false);
  });
});

describe('originFromRequest', () => {
  it('assemble le schéma du proxy et l’hôte de la requête', () => {
    expect(originFromRequest(PUBLIC_REQUEST)).toBe('https://trybuildit.vercel.app');
    expect(originFromRequest({ proto: 'https, http', host: 'a.fr, b.fr' })).toBe('https://a.fr');
  });

  it('suppose https sans schéma lisible, et refuse un hôte douteux', () => {
    expect(originFromRequest({ proto: null, host: 'a.fr' })).toBe('https://a.fr');
    expect(originFromRequest({ proto: 'https', host: 'a.fr/x' })).toBe('');
    expect(originFromRequest({ proto: 'https', host: null })).toBe('');
    expect(originFromRequest(null)).toBe('');
  });
});

describe('publicShareBase', () => {
  it('en local, seule PF_SHARE_BASE_URL compte : sinon le navigateur garde son origine', () => {
    const request = { proto: 'http', host: '127.0.0.1:4173' };
    expect(publicShareBase({}, request)).toBe('');
    expect(publicShareBase({ PF_SHARE_BASE_URL: 'https://tunnel.fr' }, request)).toBe(
      'https://tunnel.fr',
    );
  });

  it('en hébergé, prend le nom sous lequel la requête est arrivée', () => {
    expect(publicShareBase(HOSTED, PUBLIC_REQUEST)).toBe('https://trybuildit.vercel.app');
  });

  it('en hébergé, écarte toute boucle locale, configurée ou non', () => {
    const env = {
      ...HOSTED,
      PF_SHARE_BASE_URL: 'http://127.0.0.1:4173',
      PF_SITE_URL: 'http://127.0.0.1:4173',
    };
    expect(publicShareBase(env, PUBLIC_REQUEST)).toBe('https://trybuildit.vercel.app');
  });

  it('en hébergé hors requête, retombe sur les domaines que Vercel pose', () => {
    const env = {
      ...HOSTED,
      VERCEL_PROJECT_PRODUCTION_URL: 'trybuildit.vercel.app',
      VERCEL_URL: 'x.vercel.app',
    };
    expect(publicShareBase(env, null)).toBe('https://trybuildit.vercel.app');
    expect(publicShareBase({ ...HOSTED, VERCEL_URL: 'x.vercel.app' }, null)).toBe(
      'https://x.vercel.app',
    );
    expect(publicShareBase(HOSTED, null)).toBe('');
  });
});

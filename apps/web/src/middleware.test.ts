import { afterEach, describe, expect, it } from 'vitest';
import { middleware } from './middleware';

/**
 * Le seul contrôle d'accès du serveur local (décision 8B.6, constat M4).
 *
 * Le configurateur écrit sur le disque et lit le trousseau : un navigateur qui
 * ouvre une page hostile peut faire résoudre un nom de domaine vers `127.0.0.1`
 * (DNS rebinding) et atteindre ce serveur avec l'origine de l'attaquant. Le
 * `Host` est la seule chose que l'attaquant ne contrôle pas — il doit donc être
 * refusé par un **test négatif**, pas par une relecture (trouvé en revue,
 * MAJOR-2 : le garde-fou n'avait aucune sonde).
 *
 * La sonde est un vrai `Headers` : c'est ce que `request.headers.get('host')`
 * rend, et une chaîne vide ne se comporte pas comme une en-tête absente.
 */
function host(value: string | null) {
  const headers = new Headers();
  if (value !== null) {
    headers.set('host', value);
  }
  return { headers } as unknown as Parameters<typeof middleware>[0];
}

describe('middleware — un seul hôte : le local', () => {
  it.each(['127.0.0.1', '127.0.0.1:4173', 'localhost', 'LOCALHOST:3000', '[::1]:4173', '[::1]'])(
    'laisse passer %s',
    (value) => {
      expect(middleware(host(value)).status).toBe(200);
    },
  );

  it.each([
    'attaquant.example',
    'attaquant.example:4173',
    // Le rebinding par sous-domaine : un hôte qui **contient** une adresse
    // locale n'est pas une adresse locale. Un `includes` au lieu d'un `has`
    // laisserait passer ce cas.
    '127.0.0.1.attaquant.example',
    'localhost.attaquant.example',
    '127.0.0.1.example.com:80',
    // Un suffixe de port n'est pas un nom : `replace(/:\d+$/)` laisse la
    // chaîne intacte ici, et le `has` refuse.
    'localhost:abc',
    '',
    // `::1` sans crochets ne se distingue pas d'un nom au port : refusé. Le
    // navigateur envoie `[::1]`, qui passe — et se tromper dans ce sens-là est
    // sans danger (fail-closed), contrairement à l'inverse.
    '::1',
  ])('refuse %s avec un 403 explicite', (value) => {
    const response = middleware(host(value));
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toContain('text/plain');
  });

  it('refuse une requête sans en-tête Host du tout', () => {
    // Sans en-tête, on ne sait pas à qui on parle : refuser est la seule
    // réponse sûre (fail-closed).
    expect(middleware(host(null)).status).toBe(403);
  });

  it('couvre toutes les routes, Server Actions et fichiers statiques compris', async () => {
    // Le `matcher` est la portée du garde-fou : s'il se réduisait aux pages,
    // une Server Action (`POST` avec en-tête `Next-Action`) passerait à côté.
    const { config } = await import('./middleware');
    expect(config.matcher).toBe('/:path*');
  });
});

describe('middleware — mode hébergé (Phase 12)', () => {
  const originalVercel = process.env['VERCEL'];
  const originalSiteUrl = process.env['PF_SITE_URL'];

  afterEach(() => {
    if (originalVercel === undefined) {
      delete process.env['VERCEL'];
    } else {
      process.env['VERCEL'] = originalVercel;
    }
    if (originalSiteUrl === undefined) {
      delete process.env['PF_SITE_URL'];
    } else {
      process.env['PF_SITE_URL'] = originalSiteUrl;
    }
  });

  it('refuse toujours un hôte d’attaquant, même avec VERCEL=1', () => {
    process.env['VERCEL'] = '1';
    process.env['PF_SITE_URL'] = 'https://trybuildit.vercel.app';
    expect(middleware(host('attaquant.example')).status).toBe(403);
  });

  it('laisse passer le domaine de PF_SITE_URL quand VERCEL=1', () => {
    process.env['VERCEL'] = '1';
    process.env['PF_SITE_URL'] = 'https://trybuildit.vercel.app';
    expect(middleware(host('trybuildit.vercel.app')).status).toBe(200);
  });

  it('n’élargit rien sans VERCEL=1, même si PF_SITE_URL est définie par erreur', () => {
    process.env['PF_SITE_URL'] = 'https://trybuildit.vercel.app';
    expect(middleware(host('trybuildit.vercel.app')).status).toBe(403);
    expect(middleware(host('127.0.0.1')).status).toBe(200);
  });
});

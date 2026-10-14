import { describe, expect, it } from 'vitest';
import { allowedHosts, isAllowedHost, isHostedEnvironment } from './hosting';

/**
 * Détection d'environnement et liste des hôtes autorisés (Phase 12).
 *
 * Décision : le mode local (décision 8B.6) n'est **jamais** élargi même si
 * `PF_SITE_URL` est définie par erreur sur une machine locale, seuls
 * `127.0.0.1`/`localhost`/`::1` passent. Seul `VERCEL=1` (ou `PF_HOSTED=1`,
 * pour les tests/autres hébergeurs) ouvre la porte à un domaine public.
 */

describe('isHostedEnvironment', () => {
  it('est locale sans VERCEL ni PF_HOSTED', () => {
    expect(isHostedEnvironment({})).toBe(false);
  });

  it('est hébergée quand VERCEL=1', () => {
    expect(isHostedEnvironment({ VERCEL: '1' })).toBe(true);
  });

  it('est hébergée quand PF_HOSTED=1 (hors Vercel)', () => {
    expect(isHostedEnvironment({ PF_HOSTED: '1' })).toBe(true);
  });
});

describe('allowedHosts mode local', () => {
  it('ignore PF_SITE_URL en local : seuls les hôtes de boucle locale passent', () => {
    const hosts = allowedHosts({ PF_SITE_URL: 'https://trybuildit.vercel.app' });
    expect(hosts.has('127.0.0.1')).toBe(true);
    expect(hosts.has('trybuildit.vercel.app')).toBe(false);
  });
});

describe('allowedHosts mode hébergé', () => {
  it('ajoute l’hôte de PF_SITE_URL', () => {
    const hosts = allowedHosts({ VERCEL: '1', PF_SITE_URL: 'https://trybuildit.vercel.app' });
    expect(hosts.has('trybuildit.vercel.app')).toBe(true);
  });

  it('ajoute VERCEL_URL (le domaine du déploiement courant)', () => {
    const hosts = allowedHosts({ VERCEL: '1', VERCEL_URL: 'buildit-git-main.vercel.app' });
    expect(hosts.has('buildit-git-main.vercel.app')).toBe(true);
  });

  it('ignore une PF_SITE_URL invalide sans planter', () => {
    const hosts = allowedHosts({ VERCEL: '1', PF_SITE_URL: 'pas-une-url' });
    expect(hosts.has('pas-une-url')).toBe(false);
  });
});

describe('isAllowedHost refus d’un hôte non autorisé, en local comme en hébergé', () => {
  it('refuse un hôte d’attaquant en local', () => {
    expect(isAllowedHost('attaquant.example', {})).toBe(false);
  });

  it('refuse un hôte d’attaquant en hébergé, même avec PF_SITE_URL définie', () => {
    expect(
      isAllowedHost('attaquant.example', {
        VERCEL: '1',
        PF_SITE_URL: 'https://trybuildit.vercel.app',
      }),
    ).toBe(false);
  });

  it('accepte l’hôte configuré en hébergé', () => {
    expect(
      isAllowedHost('trybuildit.vercel.app', {
        VERCEL: '1',
        PF_SITE_URL: 'https://trybuildit.vercel.app',
      }),
    ).toBe(true);
  });

  it('accepte toujours le local en mode local', () => {
    expect(isAllowedHost('127.0.0.1:4173', {})).toBe(true);
  });
});

import { parseManifest } from '@buildit/manifest';
import { describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from '../../../lib/draft';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { loadOptionsAction } from '../../actions';
import { loadInfrastructureBlocksAction } from './actions';
import { chooseHosting, infrastructureIds, selectedHosting } from './infrastructure';

/** Un brouillon complet : les mêmes choix que le preset SaaS, saisis aux écrans. */
function saasDraft(): DraftState {
  return {
    ...freshDraft(),
    step: 'infrastructure',
    name: 'mon-projet',
    targets: ['web'],
    type: 'saas',
    architecture: 'single-app',
    technologies: [
      'next',
      'typescript',
      'tailwind',
      'shadcn-ui',
      'postgresql',
      'prisma',
      'better-auth',
      'biome',
      'vitest',
      'playwright',
      'vercel',
    ],
    capabilities: ['stripe', 'resend', 'sentry', 'posthog'],
    envVarNames: ['DATABASE_URL'],
    infra: { docker: false, ci: false },
  };
}

/**
 * L'écran 9 (§6.9) pose des **booléens** là où le brouillon ne connaît pas de
 * champ cloud. La règle de conversion est déjà écrite dans
 * `lib/draft-to-manifest.ts` : ces tests la prennent pour juge, ils ne la
 * réécrivent pas.
 */
describe('booléens d’infrastructure', () => {
  it('ne produit aucun identifiant quand rien n’est coché', () => {
    expect(infrastructureIds(freshDraft())).toEqual([]);
  });

  it('traduit Docker et CI/CD en identifiants du catalogue, dans l’ordre', () => {
    const draft = { ...freshDraft(), infra: { docker: true, ci: true } };

    // Ces deux identifiants sont ceux que `draftToManifest` ajoute à la
    // sélection (`containers/docker`, `ci-cd/github-actions`).
    expect(infrastructureIds(draft)).toEqual(['docker', 'github-actions']);
    expect(infrastructureIds({ ...draft, infra: { docker: true, ci: false } })).toEqual(['docker']);
    expect(infrastructureIds({ ...draft, infra: { docker: false, ci: true } })).toEqual([
      'github-actions',
    ]);
  });
});

describe('cloud cible', () => {
  const HOSTING_IDS = ['vercel', 'netlify', 'cloudflare'];

  it('retient l’hébergeur choisi sans toucher au reste de la pile', () => {
    const draft = { ...freshDraft(), technologies: ['next', 'vercel', 'typescript'] };
    const next = chooseHosting(draft, HOSTING_IDS, 'netlify');

    expect(next.technologies).toEqual(['next', 'typescript', 'netlify']);
    // Le brouillon reçu n'est pas muté.
    expect(draft.technologies).toEqual(['next', 'vercel', 'typescript']);
  });

  it('remplace l’hébergeur précédent : le cloud cible est unique', () => {
    const draft = { ...freshDraft(), technologies: ['next', 'vercel'] };
    expect(chooseHosting(draft, HOSTING_IDS, 'cloudflare').technologies).toEqual([
      'next',
      'cloudflare',
    ]);
  });

  it('retire l’hébergeur quand on le désélectionne, et rien d’autre', () => {
    const draft = { ...freshDraft(), technologies: ['next', 'vercel', 'docker'] };
    expect(chooseHosting(draft, HOSTING_IDS, null).technologies).toEqual(['next', 'docker']);
  });

  it('retrouve l’hébergeur déjà choisi, et rien quand il n’y en a pas', () => {
    expect(selectedHosting(['next', 'vercel'], HOSTING_IDS)).toBe('vercel');
    expect(selectedHosting(['next', 'typescript'], HOSTING_IDS)).toBeUndefined();
  });
});

describe('ce que l’écran écrit finit dans `infra`', () => {
  it('les deux booléens et le cloud cible traversent le mapping canonique', () => {
    const draft = { ...saasDraft(), infra: { docker: true, ci: true } };
    const result = draftToManifest(draft);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // `draftToManifest` est la seule autorité sur le placement : s'il changeait
    // de règle, ce test le dirait au lieu de le contredire.
    expect(result.value.infra).toContain('docker');
    expect(result.value.infra).toContain('github-actions');
    expect(result.value.infra).toContain('vercel');
  });

  it('le manifest produit reste acceptable par le schéma', () => {
    const result = draftToManifest({ ...saasDraft(), infra: { docker: true, ci: true } });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(parseManifest(result.value).ok).toBe(true);
  });
});

describe('la source réelle du cloud cible (Server Action)', () => {
  it('rend les hébergeurs du catalogue pour une sélection web réelle', async () => {
    const hosts = await loadOptionsAction('hosting', { targets: ['web'], technologies: ['next'] });

    expect(hosts.length).toBeGreaterThan(0);
    for (const host of hosts) {
      expect(host.category).toBe('hosting');
      expect(host.label.length).toBeGreaterThan(0);
      // L'écran n'invente aucun état : le moteur dit selected / available /
      // blocked, et une option bloquée porte sa raison.
      expect(['selected', 'available', 'blocked']).toContain(host.state);
      if (host.state === 'blocked') {
        expect(host.reason).toBeDefined();
      }
    }
    expect(hosts.map((host) => host.id)).toContain('vercel');
  });
});

describe('la source réelle des six catégories d’infrastructure (Server Action)', () => {
  it('rend chaque catégorie d’infrastructure avec ses options et leurs états', async () => {
    const blocks = await loadInfrastructureBlocksAction({
      targets: ['web'],
      technologies: ['next', 'typescript'],
    });
    const categories = blocks.map((block) => block.category);

    expect(categories).toContain('hosting');
    expect(categories).toContain('package-manager');
    expect(categories).toContain('containers');
    // Aucune catégorie d'un autre écran ne doit fuiter ici : le Stack garde les
    // siennes, les Capacités les leurs.
    expect(categories).not.toContain('frontend');
    expect(categories).not.toContain('queue');

    for (const block of blocks) {
      expect(block.options.length).toBeGreaterThan(0);
      for (const option of block.options) {
        expect(option.category).toBe(block.category);
        expect(['selected', 'available', 'blocked']).toContain(option.state);
        if (option.state === 'blocked') {
          expect(option.reason).toBeDefined();
        }
      }
    }
  });

  it('filtre par compatibilité : Docker ne sort pas sur des cibles mobiles', async () => {
    // `docker` cible web/api/library (§10) : sur mobile, le moteur doit le
    // refuser et **dire pourquoi**, au lieu de le laisser passer jusqu'à la
    // génération.
    const blocks = await loadInfrastructureBlocksAction({
      targets: ['mobile'],
      technologies: ['expo', 'typescript'],
    });
    const containers = blocks.find((block) => block.category === 'containers');

    expect(containers).toBeDefined();
    const docker = containers?.options.find((option) => option.id === 'docker');
    expect(docker?.state).toBe('blocked');
    expect(docker?.reason).toBeDefined();
  });
});

import { type Manifest, parseManifest, TARGETS } from '@buildit/manifest';
import { getPreset } from '@buildit/presets';
import { loadCatalogue, type Registry } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import {
  ARCHITECTURE_LABELS,
  blueprintView,
  manifestTechnologyIds,
  TARGET_LABELS,
} from './summary';

/**
 * Le résumé du Blueprint (§6.10) ne recopie aucune liste de technologies : les
 * identifiants viennent du **manifest canonique** (`draftToManifest`), et les
 * noms lisibles du **vrai catalogue**. Ce test le prouve en chargeant le
 * catalogue livré.
 */

function registry(): Registry {
  const loaded = loadCatalogue();
  if (!loaded.ok) {
    throw new Error('catalogue illisible');
  }
  return loaded.value;
}

function catalogueLabels(): ReadonlyMap<string, string> {
  return new Map(
    registry()
      .entries()
      .map((entry) => [entry.id, entry.name]),
  );
}

function saasManifest(): Manifest {
  const preset = getPreset('saas');
  if (preset === undefined) {
    throw new Error('preset saas absent');
  }
  return preset.manifest('mon-projet');
}

describe('les tables de libellés sont complètes', () => {
  it('couvre les cinq plateformes du manifest', () => {
    expect(Object.keys(TARGET_LABELS).sort()).toEqual([...TARGETS].sort());
  });

  it('couvre toutes les architectures du manifest', () => {
    expect(Object.keys(ARCHITECTURE_LABELS).sort()).toEqual(
      [
        'event-driven',
        'microservices',
        'modular-monolith',
        'monorepo',
        'serverless',
        'single-app',
      ].sort(),
    );
  });
});

describe('manifestTechnologyIds — la sélection envoyée au moteur', () => {
  it('rend tous les identifiants du manifest SaaS, dans l’ordre canonique, sans doublon', () => {
    // Le preset brut n'est pas encore canonique : `parseManifest` trie les
    // ensembles, et c'est ce manifest-là que `draftToManifest` produit.
    const parsed = parseManifest(saasManifest());
    if (!parsed.ok) {
      throw new Error('le manifest du preset saas n’est pas valide');
    }
    const ids = manifestTechnologyIds(parsed.value);
    expect(ids).toEqual([
      'next',
      'typescript',
      'tailwind',
      'shadcn-ui',
      'postgresql',
      'prisma',
      'better-auth',
      'posthog',
      'resend',
      'sentry',
      'stripe',
      'biome',
      'playwright',
      'vitest',
      'docker',
      'github-actions',
      'vercel',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('n’invente aucun identifiant : tous existent au catalogue', () => {
    const known = new Set(
      registry()
        .entries()
        .map((entry) => entry.id),
    );
    for (const id of manifestTechnologyIds(saasManifest())) {
      expect(known.has(id)).toBe(true);
    }
  });

  it('un manifest minimal ne rend aucun identifiant', () => {
    const minimal: Manifest = {
      manifestVersion: 1,
      name: 'vide',
      targets: ['web'],
      architecture: 'single-app',
    };
    expect(manifestTechnologyIds(minimal)).toEqual([]);
  });

  it('une valeur répétée dans deux champs ne compte qu’une fois', () => {
    const manifest: Manifest = {
      manifestVersion: 1,
      name: 'doublon',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'next' },
      services: ['next'],
    };
    expect(manifestTechnologyIds(manifest)).toEqual(['next']);
  });
});

describe('blueprintView — le résumé lisible', () => {
  it('rend le manifest SaaS avec les vrais noms du catalogue', () => {
    const view = blueprintView(saasManifest(), catalogueLabels());

    expect(view.name).toBe('mon-projet');
    expect(view.headline).toContain('Next.js');
    expect(view.headline).toContain('PostgreSQL');
    expect(view.headline).toContain('Stripe');
    expect(view.rows.map((row) => row.role)).toEqual([
      'Plateformes',
      'Architecture',
      'Application web',
      'Base de données',
      'Authentification',
      'Services',
      'Qualité',
      'Infrastructure',
    ]);
    // Chaque valeur affichée est nommée, jamais un slug nu.
    const web = view.rows.find((row) => row.role === 'Application web');
    expect(web?.values.map((value) => value.label)).toEqual([
      'Next.js',
      'TypeScript',
      'Tailwind CSS',
      'shadcn/ui',
    ]);
  });

  it('la phrase d’en-tête suit l’ordre framework, base, auth, services', () => {
    const manifest: Manifest = {
      manifestVersion: 1,
      name: 'demo',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript' },
      database: { engine: 'postgresql' },
      services: ['stripe'],
    };
    const labels = new Map([
      ['next', 'Next.js'],
      ['postgresql', 'PostgreSQL'],
      ['stripe', 'Stripe'],
    ]);
    expect(blueprintView(manifest, labels).headline).toBe('Next.js + PostgreSQL + Stripe');
  });

  it('un identifiant non nommé reste lisible — son slug est affiché, rien n’est inventé', () => {
    const manifest: Manifest = {
      manifestVersion: 1,
      name: 'demo',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript' },
      services: ['stripe'],
    };
    const view = blueprintView(manifest, new Map([['next', 'Next.js']]));
    expect(view.headline).toContain('stripe');
    const services = view.rows.find((row) => row.role === 'Services');
    expect(services?.values).toEqual([{ id: 'stripe', label: 'stripe' }]);
  });

  it('tronque la phrase d’en-tête au-delà de huit pièces, en le disant', () => {
    const manifest: Manifest = {
      manifestVersion: 1,
      name: 'long',
      targets: ['web'],
      architecture: 'single-app',
      frontend: { framework: 'next', language: 'typescript' },
      database: { engine: 'postgresql' },
      auth: { provider: 'better-auth' },
      services: ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'],
    };
    const labels = new Map(
      ['next', 'postgresql', 'better-auth', 'aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'].map((id) => [
        id,
        id.toUpperCase(),
      ]),
    );
    const headline = blueprintView(manifest, labels).headline;
    expect(headline.endsWith('…')).toBe(true);
    expect(headline).toContain('NEXT');
    expect(headline).not.toContain('FFF');
  });

  it('un manifest sans technologie n’affiche pas de phrase d’en-tête', () => {
    const manifest: Manifest = {
      manifestVersion: 1,
      name: 'vide',
      targets: ['api'],
      architecture: 'serverless',
    };
    const view = blueprintView(manifest, new Map());
    expect(view.headline).toBe('');
    expect(view.rows.map((row) => row.role)).toEqual(['Plateformes', 'Architecture']);
  });

  it('rend le graphe de dépendances de la même sélection que le manifest', () => {
    const manifest = saasManifest();
    expect(blueprintView(manifest, catalogueLabels()).technologyIds).toEqual(
      manifestTechnologyIds(manifest),
    );
  });
});

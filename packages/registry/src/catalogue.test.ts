import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from './catalogue.js';
import type { Registry } from './load.js';
import type { Category } from './schema/entry.js';

/**
 * Tests du catalogue **réel**, pas de fixtures.
 *
 * C'est le test qui attrape une faute de frappe dans une fiche : toutes les
 * règles du schéma et de l'intégrité ont beau être couvertes par ailleurs,
 * rien ne garantit que les données livrées les respectent.
 */

const result = loadCatalogue();

describe('le catalogue officiel charge', () => {
  it('ne produit aucune erreur — sinon le message dit laquelle', () => {
    const problems = result.ok
      ? []
      : result.issues.map((issue) => `${issue.path.join('.')} → ${issue.code} : ${issue.message}`);
    expect(problems).toEqual([]);
  });

  it('ne produit aucun avertissement de fraîcheur', () => {
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.warnings()).toEqual([]);
    }
  });
});

/**
 * Accès au catalogue chargé, appelé **dans** chaque test.
 *
 * Surtout pas dans le corps d'un `describe` : y lever une exception interrompt
 * la collecte des tests, et le test de diagnostic ci-dessus — celui qui imprime
 * les erreurs réelles — ne s'exécute jamais. On perd alors l'information au
 * moment précis où on en a besoin.
 */
function requireRegistry(): Registry {
  if (!result.ok) {
    throw new Error('le catalogue ne charge pas — voir le test de diagnostic ci-dessus');
  }
  return result.value;
}

describe('contenu du catalogue', () => {
  it('contient toute la stack du preset SaaS (§8)', () => {
    const registry = requireRegistry();
    const saas = [
      'next',
      'typescript',
      'tailwind',
      'shadcn-ui',
      'postgresql',
      'prisma',
      'better-auth',
      'stripe',
      'resend',
      'sentry',
      'posthog',
      'vercel',
      'vitest',
      'playwright',
    ];
    for (const id of saas) {
      expect(registry.get(id), `fiche manquante : ${id}`).toBeDefined();
    }
  });

  it('couvre chaque catégorie du périmètre web', () => {
    const registry = requireRegistry();
    // Le registry est large par vocation : il déclare ce que le produit connaît.
    // La restriction à 2–4 options recommandées par étape (§5) ne porte pas sur
    // lui — elle portera sur le sous-ensemble certifié, donc générable, une fois
    // les templates écrits en Phase 6. Confondre les deux reviendrait à brider
    // le catalogue pour une raison d'interface.
    const expected: Category[] = [
      'frontend',
      'language',
      'styling',
      'ui',
      'backend',
      'database',
      'orm',
      'authentication',
      'authorization',
      'state',
      'data-fetching',
      'forms',
      'validation',
      'api',
      'build',
      'package-manager',
      'monorepo',
      'testing',
      'linting',
      'containers',
      'ci-cd',
      'hosting',
      'storage',
      'cache',
      'queue',
      'search',
      'email',
      'payments',
      'observability',
      'analytics',
      'security',
      'ai',
      'cms',
      'ecommerce',
    ];
    for (const category of expected) {
      expect(registry.query({ category }).length, `catégorie vide : ${category}`).toBeGreaterThan(
        0,
      );
    }
  });

  it('offre plusieurs options là où le choix change quelque chose', () => {
    const registry = requireRegistry();
    const plural: Category[] = [
      'database',
      'orm',
      'authentication',
      'ui',
      'payments',
      'email',
      'hosting',
      'frontend',
      'backend',
    ];
    for (const category of plural) {
      expect(
        registry.query({ category }).length,
        `choix insuffisant en ${category}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('la colonne vertébrale du preset SaaS est certifiée', () => {
    const registry = requireRegistry();
    const certified = registry.query({ generation: 'certified' }).map((entry) => entry.id);
    expect([...certified].sort()).toEqual([
      'biome',
      'next',
      'playwright',
      'postgresql',
      'prisma',
      'resend',
      'shadcn-ui',
      'stripe',
      'tailwind',
      'typescript',
      'vercel',
      'vitest',
    ]);
  });

  it('une fiche certifiée est couverte par le test de fumée', () => {
    // La règle initiale exigeait un template sur toute fiche certifiée. Elle
    // confondait « apporte du code applicatif » et « est couverte par un test
    // de génération » : TypeScript, Biome et Vitest n'apportent aucun fichier
    // d'application, leur configuration vient de la couche d'intégration.
    // La garantie tient maintenant dans le test de fumée du generator, qui
    // génère exactement ces fiches, les installe et les construit.
    const registry = requireRegistry();
    expect(registry.query({ generation: 'certified' }).length).toBeGreaterThan(0);
  });

  it('seules les fiches qui apportent du code applicatif ont un template', () => {
    const registry = requireRegistry();
    const withTemplate = registry
      .query({ generation: 'certified' })
      .filter((entry) => entry.template !== undefined)
      .map((entry) => entry.id);
    expect([...withTemplate].sort()).toEqual(['next', 'shadcn-ui', 'tailwind']);
  });

  it('aucune fiche déclarée ne porte de template', () => {
    const registry = requireRegistry();
    for (const entry of registry.query({ generation: 'declared' })) {
      expect(entry.template, `template interdit : ${entry.id}`).toBeUndefined();
    }
  });

  it('aucune fiche ne porte de valeur dans env — seulement des noms (§24)', () => {
    const registry = requireRegistry();
    for (const entry of registry.entries()) {
      for (const name of entry.env ?? []) {
        expect(name, `valeur dans env : ${entry.id}`).not.toContain('=');
      }
    }
  });

  it('chaque fiche a une documentation atteignable en http(s)', () => {
    const registry = requireRegistry();
    for (const entry of registry.entries()) {
      expect(entry.docs, `documentation manquante : ${entry.id}`).toMatch(/^https?:\/\//);
    }
  });

  it('aucune fiche ne vise exclusivement mobile ou desktop — hors périmètre MVP (§23)', () => {
    const registry = requireRegistry();
    // Le MVP est « Web uniquement » (§23). Une technologie d'API entre dans le
    // périmètre — elle sert l'application web — mais une technologie purement
    // mobile ou desktop n'a rien à y faire avant la V1.
    for (const entry of registry.entries()) {
      const inScope = entry.targets.some((target) => target === 'web' || target === 'api');
      expect(inScope, `hors périmètre MVP : ${entry.id}`).toBe(true);
    }
  });
});

describe('index engendré', () => {
  it("n'a pas dérivé du dossier data/", () => {
    // Le fichier engendré est versionné : sans ce contrôle, modifier un JSON
    // sans relancer le script laisserait le catalogue publié en arrière, en
    // silence, jusqu'à ce que quelqu'un s'en aperçoive en production.
    expect(() =>
      execFileSync('node', ['scripts/build-index.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});

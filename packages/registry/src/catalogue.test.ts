import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from './catalogue.js';
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

describe('contenu du catalogue', () => {
  const registry = (() => {
    if (!result.ok) {
      throw new Error('le catalogue ne charge pas');
    }
    return result.value;
  })();

  it('contient toute la stack du preset SaaS (§8)', () => {
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

  it('offre un vrai choix là où il compte, et un seul là où il n’en apporte pas', () => {
    // Décision produit : 2 à 4 options recommandées par étape (§5), mais
    // uniquement dans les catégories où le choix change quelque chose. Personne
    // ne change de vie parce que l'outil impose Biome plutôt qu'ESLint.
    const plural: Category[] = [
      'database',
      'orm',
      'authentication',
      'ui',
      'payments',
      'email',
      'hosting',
    ];
    for (const category of plural) {
      expect(
        registry.query({ category }).length,
        `choix insuffisant en ${category}`,
      ).toBeGreaterThanOrEqual(2);
    }

    const singular: Category[] = ['language', 'styling', 'linting', 'package-manager', 'monorepo'];
    for (const category of singular) {
      expect(registry.query({ category }).length, `choix superflu en ${category}`).toBe(1);
    }
  });

  it('aucune fiche n’est encore certifiée — les templates arrivent en Phase 6', () => {
    // Ce test tombera dès le premier template livré : c'est voulu. Il force à
    // relire la règle certifiée/déclarée au moment où elle commence à mordre.
    expect(registry.query({ generation: 'certified' })).toEqual([]);
  });

  it('chaque fiche certifiée porte un template', () => {
    for (const entry of registry.query({ generation: 'certified' })) {
      expect(entry.template, `template manquant : ${entry.id}`).toBeDefined();
    }
  });

  it('aucune fiche déclarée ne porte de template', () => {
    for (const entry of registry.query({ generation: 'declared' })) {
      expect(entry.template, `template interdit : ${entry.id}`).toBeUndefined();
    }
  });

  it('aucune fiche ne porte de valeur dans env — seulement des noms (§24)', () => {
    for (const entry of registry.entries()) {
      for (const name of entry.env ?? []) {
        expect(name, `valeur dans env : ${entry.id}`).not.toContain('=');
      }
    }
  });

  it('chaque fiche a une documentation atteignable en http(s)', () => {
    for (const entry of registry.entries()) {
      expect(entry.docs, `documentation manquante : ${entry.id}`).toMatch(/^https?:\/\//);
    }
  });

  it('toutes les fiches du périmètre MVP visent au moins le web', () => {
    for (const entry of registry.entries()) {
      expect(entry.targets, `hors périmètre web : ${entry.id}`).toContain('web');
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

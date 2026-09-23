import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from './catalogue.js';

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

  it('contient le cœur du preset SaaS', () => {
    for (const id of ['typescript', 'next', 'postgresql', 'prisma', 'better-auth']) {
      expect(registry.get(id), `fiche manquante : ${id}`).toBeDefined();
    }
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

import { TARGETS } from '@buildit/manifest';
import { describe, expect, it } from 'vitest';
import { loadCatalogue } from './catalogue.js';
import type { RegistryEntry } from './schema/entry.js';
import { FRAMEWORK_CATEGORIES, targetCoverage, targetsWithoutFramework } from './targets.js';

/**
 * La couverture des cibles se mesure sur le catalogue **réel** — c'est elle qui
 * décide ce que l'écran Target propose — et sur des fixtures pour prouver que la
 * règle lit les données au lieu de réciter une réponse.
 */

const result = loadCatalogue();

function requireEntries(): readonly RegistryEntry[] {
  if (!result.ok) {
    throw new Error('le catalogue ne charge pas — voir catalogue.test.ts');
  }
  return result.value.entries();
}

function entry(patch: Partial<RegistryEntry> & { id: string }): RegistryEntry {
  return {
    name: patch.id,
    category: 'frontend',
    targets: ['web'],
    status: 'stable',
    generation: 'declared',
    license: 'MIT',
    lastReviewedAt: '2026-09-23',
    ...patch,
  };
}

function coverageOf(target: string): { entries: number; frameworks: number } {
  const coverage = targetCoverage(requireEntries()).find((item) => item.target === target);
  if (coverage === undefined) {
    throw new Error(`cible hors de TARGETS : ${target}`);
  }
  return { entries: coverage.entries, frameworks: coverage.frameworks };
}

describe('catégories de framework', () => {
  it('sont dérivées de SLOTS, pas recopiées', () => {
    // La liste est écrite ici pour qu'un changement de rôle dans `slots.ts`
    // échoue bruyamment : c'est une décision de produit, pas un détail.
    expect([...FRAMEWORK_CATEGORIES]).toEqual(['frontend', 'backend']);
  });
});

describe('couverture du catalogue réel', () => {
  it('le web et l’API ont de quoi fournir un framework', () => {
    expect(coverageOf('web').frameworks).toBeGreaterThan(0);
    expect(coverageOf('api').frameworks).toBeGreaterThan(0);
  });

  it('mobile et desktop sont citées par des fiches, mais aucune ne peut en être le framework', () => {
    // Le chiffre qui trompe : 46 fiches citent chacune. Le chiffre qui décide :
    // zéro. Des linters, des CI et des langages ne font pas une application.
    expect(coverageOf('mobile').entries).toBeGreaterThan(0);
    expect(coverageOf('desktop').entries).toBeGreaterThan(0);
    expect(coverageOf('mobile').frameworks).toBe(0);
    expect(coverageOf('desktop').frameworks).toBe(0);
  });

  it('nomme les cibles sans framework, dans l’ordre du manifest', () => {
    // `library` en fait partie : le §10 ne la décrit par aucune application,
    // donc aucun framework ne lui est demandé. À l'appelant de croiser cette
    // réponse avec les cibles que le §10 décrit par une application.
    expect([...targetsWithoutFramework(requireEntries())]).toEqual([
      'mobile',
      'desktop',
      'library',
    ]);
  });
});

describe('la règle lit le catalogue', () => {
  it('une fiche frontend visant mobile couvre mobile', () => {
    const catalogue: RegistryEntry[] = [
      entry({ id: 'next', category: 'frontend', targets: ['web'] }),
      entry({ id: 'expo', category: 'frontend', targets: ['mobile'] }),
    ];

    // `api` n'a plus de framework non plus : le catalogue de ce test ne
    // contient que deux fiches, et la réponse se lit, elle ne se présume pas.
    expect([...targetsWithoutFramework(catalogue)]).toEqual(['desktop', 'api', 'library']);
  });

  it('une fiche language visant desktop ne couvre pas desktop', () => {
    // La catégorie décide du rôle : un langage remplit `language`, jamais
    // `framework` — sans quoi le manifest mobile/desktop passerait le schéma
    // avec un langage à la place d'un framework.
    const catalogue: RegistryEntry[] = [
      entry({ id: 'typescript', category: 'language', targets: ['mobile', 'desktop'] }),
    ];

    expect([...targetsWithoutFramework(catalogue)]).toEqual([
      'web',
      'mobile',
      'desktop',
      'api',
      'library',
    ]);
  });

  it('un catalogue vide ne couvre aucune cible', () => {
    expect(targetCoverage([]).map((item) => item.frameworks)).toEqual(TARGETS.map(() => 0));
    expect([...targetsWithoutFramework([])]).toEqual([...TARGETS]);
  });
});

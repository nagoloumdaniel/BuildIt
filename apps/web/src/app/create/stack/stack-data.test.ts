import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, type Category } from '@buildit/registry';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkSelectionAction, loadOptionsAction } from '../../actions';
import { loadStackBlocksAction } from './actions';
import type { StackOption } from './stack-view';

/**
 * Le contrat de données du Stack Builder, branché sur les vraies Server Actions.
 *
 * `stack-view.test.ts` prouve la logique du §5 sur des options fabriquées ;
 * ce fichier prouve que les options réelles ont bien la forme que la logique
 * attend c'est la seule chose que l'écran ne peut pas vérifier lui-même :
 * chaque catégorie du registry est interrogeable, un blocage porte toujours sa
 * raison, et le verdict de compatibilité a la forme que `lib/flow.ts` exige.
 */

const SELECTION = { targets: ['web'], technologies: [] };

let blocks: readonly { category: Category; options: readonly StackOption[] }[] = [];

beforeAll(async () => {
  blocks = await Promise.all(
    CATEGORIES.map(async (category) => ({
      category,
      options: await loadOptionsAction(category, SELECTION),
    })),
  );
});

describe('données du Stack Builder', () => {
  it('interroge chaque catégorie du registry sans lever', () => {
    expect(blocks).toHaveLength(CATEGORIES.length);
    expect(blocks.map((block) => block.category)).toEqual([...CATEGORIES]);
  });

  it('au moins une catégorie porte des fiches : l’écran n’est jamais vide à tort', () => {
    const filled = blocks.filter((block) => block.options.length > 0);
    expect(filled.length).toBeGreaterThan(0);
  });

  it('ne rend que des états connus, et jamais un blocage muet (§5, §12)', () => {
    const options = blocks.flatMap((block) => block.options);
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(['selected', 'available', 'blocked']).toContain(option.state);
      if (option.state === 'blocked') {
        expect(option.reason?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('un choix déjà fait revient marqué `selected`', async () => {
    const options = await loadOptionsAction('frontend', {
      targets: ['web'],
      technologies: ['next'],
    });
    expect(options.find((option) => option.id === 'next')?.state).toBe('selected');
  });

  it('le verdict de compatibilité a la forme que le brouillon attend', async () => {
    const resolution = await checkSelectionAction({ targets: ['web'], technologies: ['next'] });
    expect(['certified', 'experimental']).toContain(resolution.status);
    expect(Array.isArray(resolution.issues)).toBe(true);
  });
});

/**
 * Le chargement unique (§8bis) : une seule action pour les 37 catégories.
 *
 * Ces tests ne vérifient pas « ça va plus vite » (c'est la mesure qui le dit) :
 * ils vérifient que le raccourci n'a **rien changé** au comportement, et que le
 * moteur reste la seule autorité sur la compatibilité.
 */
describe('chargement unique du catalogue', () => {
  it('couvre exactement les catégories non vides du registry', async () => {
    const loaded = await loadStackBlocksAction(SELECTION);
    const expected = blocks.filter((block) => block.options.length > 0);

    expect(loaded.map((block) => block.category)).toEqual(expected.map((block) => block.category));
    expect(new Set(loaded.map((block) => block.category)).size).toBe(loaded.length);
  });

  it('rend, catégorie par catégorie, ce que le chargement par action rendait', async () => {
    const selection = { targets: ['web'], technologies: ['next'] };
    const loaded = await loadStackBlocksAction(selection);
    const perCategory = blocks.filter((block) => block.options.length > 0);

    for (const block of perCategory) {
      const batched = loaded.find((item) => item.category === block.category);
      expect(batched).toBeDefined();
      expect(batched?.options).toEqual(await loadOptionsAction(block.category, selection));
    }
  });

  /**
   * Le point qui compte : l'état et la raison d'un blocage viennent du moteur.
   *
   * Le test ne compare pas à une chaîne écrite ici il compare à ce que
   * `checkSelectionAction` (donc `resolve()`) répond pour la **même** sélection,
   * et à ce que `optionsFor` rend pour la même catégorie. Un écran qui
   * fabriquerait « compatible » ou « bloqué » de son côté échouerait ici.
   */
  it('laisse le moteur trancher la compatibilité, raison comprise', async () => {
    const selection = { targets: ['web'], technologies: ['next'] };
    const loaded = await loadStackBlocksAction(selection);
    const options = loaded.flatMap((block) => block.options);
    const blocked = options.filter((option) => option.state === 'blocked');

    expect(blocked.length).toBeGreaterThan(0);
    for (const option of blocked) {
      expect(option.reason?.trim().length ?? 0).toBeGreaterThan(0);
    }

    const frontend = await loadOptionsAction('frontend', selection);
    const blockedHere = frontend.filter((option) => option.state === 'blocked');
    const sentBack = loaded.find((block) => block.category === 'frontend');
    expect(sentBack?.options).toEqual(frontend);
    expect(blockedHere.length).toBeGreaterThan(0);

    // Le verdict de la sélection est celui du moteur et, depuis la sonde
    // de `engine.test.ts`, de la complétude vue par l'écran : `next` sans
    // langage choisi est un problème visible, pas un « certifié » en silence
    // qui n'échouerait qu'au Blueprint (bug rapporté, corrigé ici).
    const resolution = await checkSelectionAction(selection);
    expect(resolution.issues.length).toBeGreaterThan(0);
    expect(resolution.issues.join(' ')).toMatch(/langage/i);
    expect(['certified', 'experimental']).toContain(resolution.status);
  });
});

/**
 * La garde du 8B.2 : un composant client ne tire jamais le moteur dans son
 * bundle. Le build Next le refuse (`server-only`), mais un build échoue tard et
 * avec un message qui ne dit pas quel fichier a dérivé : ce test statique le dit
 * tout de suite, et il échoue si `page.tsx` importe `lib/engine` en direct.
 */
describe('garde-fou du 8B.2', () => {
  const clientFiles = ['page.tsx', 'stack-options.tsx'];

  /**
   * Les deux formes d'import comptent : `import ... from 'x'` **et** l'import
   * à effet de bord `import 'x'` c'est cette seconde forme qu'utilise
   * `lib/engine.ts` pour `server-only`, et elle passait sous le premier jet de
   * ce garde-fou (vérifié en l'injectant, puis en le retirant).
   */
  function imports(source: string, fragment: string): boolean {
    const quoted = fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return (
      new RegExp(`from\\s+['"][^'"]*${quoted}[^'"]*['"]`).test(source) ||
      new RegExp(`import\\s+['"][^'"]*${quoted}[^'"]*['"]`).test(source)
    );
  }

  it('aucun fichier client de l’écran n’importe le moteur ni `server-only`', () => {
    for (const name of clientFiles) {
      const source = readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

      expect(imports(source, 'lib/engine')).toBe(false);
      expect(imports(source, 'server-only')).toBe(false);
      // Le seul chemin vers le moteur reste `actions.ts`.
      expect(imports(source, '@buildit/compatibility')).toBe(false);
      expect(imports(source, '@buildit/generator')).toBe(false);
    }
  });

  it('le chargement unique passe bien par une Server Action', () => {
    const source = readFileSync(fileURLToPath(new URL('actions.ts', import.meta.url)), 'utf8');
    expect(source.startsWith("'use server';")).toBe(true);
    // Il délègue au chargement existant : il ne recopie aucune règle du moteur.
    expect(source).toContain("from '../../actions'");
  });
});

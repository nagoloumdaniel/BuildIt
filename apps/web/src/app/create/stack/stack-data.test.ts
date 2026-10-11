import { CATEGORIES, type Category } from '@project-factory/registry';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkSelectionAction, loadOptionsAction } from '../../actions';
import type { StackOption } from './stack-view';

/**
 * Le contrat de données du Stack Builder, branché sur les vraies Server Actions.
 *
 * `stack-view.test.ts` prouve la logique du §5 sur des options fabriquées ;
 * ce fichier prouve que les options réelles ont bien la forme que la logique
 * attend — c'est la seule chose que l'écran ne peut pas vérifier lui-même :
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

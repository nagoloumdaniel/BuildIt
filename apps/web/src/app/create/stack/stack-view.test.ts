import { CATEGORIES } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { FR } from '../../../lib/i18n/messages';
import {
  type CategoryBlock,
  categoryLabel,
  categoryProgress,
  filterCatalogue,
  filterOptions,
  GUIDED_MAX,
  matchesQuery,
  normalizeText,
  type OptionState,
  optionReason,
  recommendedOptions,
  type StackOption,
} from './stack-view';

/**
 * Le §5 (progressive disclosure) se joue ici, pas dans le JSX : recommandation,
 * budget de 2 à 4, options bloquées jamais masquées, recherche, filtre de
 * compatibilité. Le composant ne fait que rendre ce que ces fonctions décident.
 */

function option(id: string, state: OptionState, extra: Partial<StackOption> = {}): StackOption {
  return { id, label: id, category: 'frontend', state, ...extra };
}

function block(
  category: CategoryBlock['category'],
  options: readonly StackOption[],
): CategoryBlock {
  return { category, options };
}

describe('normalizeText', () => {
  it('ignore la casse, les accents et les espaces autour', () => {
    expect(normalizeText('  Éditeur ')).toBe('editeur');
    expect(normalizeText('Drizzle ORM')).toBe('drizzle orm');
  });
});

describe('matchesQuery', () => {
  it('cherche dans le libellé et dans l’identifiant, sans casse ni accents', () => {
    expect(matchesQuery(option('nextjs', 'available', { label: 'Next.js' }), 'NEXT')).toBe(true);
    expect(matchesQuery(option('expo', 'available', { label: 'Expo' }), 'expo')).toBe(true);
    expect(matchesQuery(option('nestjs', 'available', { label: 'NestJS' }), 'react')).toBe(false);
  });

  it('une recherche vide ne filtre rien', () => {
    expect(matchesQuery(option('expo', 'available'), '   ')).toBe(true);
  });
});

describe('recommendedOptions : l’étoile du mode guidé', () => {
  const catalogue = [
    option('a', 'available'),
    option('b', 'selected'),
    option('c', 'blocked', { reason: 'Ne sort pas sur mobile.' }),
    option('d', 'available'),
    option('e', 'available'),
    option('f', 'available'),
    option('g', 'blocked'),
  ];

  it('recommande d’abord les choix faits, puis les disponibles, sans dépasser le budget', () => {
    const recommended = recommendedOptions(catalogue);
    expect(recommended.map((item) => item.id)).toEqual(['b', 'a', 'd', 'e']);
    expect(recommended).toHaveLength(GUIDED_MAX);
  });

  it('ne met jamais une option bloquée dans les recommandations', () => {
    expect(recommendedOptions(catalogue).some((item) => item.state === 'blocked')).toBe(false);
  });

  it('garde une option choisie même au-delà du budget : c’est elle qu’on vient défaire', () => {
    const many = [
      option('a', 'selected'),
      option('b', 'selected'),
      option('c', 'selected'),
      option('d', 'selected'),
      option('e', 'selected'),
      option('f', 'available'),
    ];
    expect(recommendedOptions(many).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('sur un catalogue plus petit que le budget, recommande tout ce qui est disponible', () => {
    expect(recommendedOptions([option('a', 'selected'), option('b', 'available')])).toHaveLength(2);
  });
});

describe('filterOptions', () => {
  const options = [
    option('react', 'available', { label: 'React' }),
    option('vue', 'blocked', { label: 'Vue', reason: 'Ne sort pas sur mobile.' }),
    option('svelte', 'available', { label: 'Svelte' }),
  ];

  it('« compatible seulement » retire les bloquées et dit combien', () => {
    const filtered = filterOptions(options, { query: '', compatibleOnly: true });
    expect(filtered.shown.map((item) => item.id)).toEqual(['react', 'svelte']);
    expect(filtered.hiddenBlocked).toBe(1);
  });

  it('sans le filtre, les bloquées restent dans la liste', () => {
    const filtered = filterOptions(options, { query: '', compatibleOnly: false });
    expect(filtered.shown.map((item) => item.id)).toEqual(['react', 'vue', 'svelte']);
    expect(filtered.hiddenBlocked).toBe(0);
  });

  it('ne compte que les bloquées réellement écartées par le filtre', () => {
    const filtered = filterOptions(options, { query: 'react', compatibleOnly: true });
    expect(filtered.shown.map((item) => item.id)).toEqual(['react']);
    expect(filtered.hiddenBlocked).toBe(0);
  });
});

describe('filterCatalogue', () => {
  const blocks = [
    block('frontend', [
      option('react', 'available', { label: 'React' }),
      option('vue', 'blocked', { label: 'Vue', reason: 'Ne sort pas sur mobile.' }),
    ]),
    block('database', [option('postgres', 'available', { label: 'PostgreSQL' })]),
  ];

  it('la recherche garde l’ordre des catégories et écarte les catégories sans résultat', () => {
    const result = filterCatalogue(blocks, { query: 'react', compatibleOnly: false });
    expect(result.blocks.map((item) => item.category)).toEqual(['frontend']);
    expect(result.blocks[0]?.options.map((item) => item.id)).toEqual(['react']);
  });

  it('une recherche vide laisse le catalogue intact', () => {
    const result = filterCatalogue(blocks, { query: '', compatibleOnly: false });
    expect(result.blocks.map((item) => item.category)).toEqual(['frontend', 'database']);
    expect(result.hiddenBlocked).toBe(0);
  });

  it('le filtre de compatibilité traverse toutes les catégories et totalise les masquées', () => {
    const result = filterCatalogue(blocks, { query: '', compatibleOnly: true });
    expect(result.blocks.map((item) => item.category)).toEqual(['frontend', 'database']);
    expect(result.blocks[0]?.options.map((item) => item.id)).toEqual(['react']);
    expect(result.hiddenBlocked).toBe(1);
  });

  it('écarte une catégorie dont toutes les options sont masquées', () => {
    const onlyBlocked = [block('ui', [option('mui', 'blocked', { label: 'Material UI' })])];
    const result = filterCatalogue(onlyBlocked, { query: '', compatibleOnly: true });
    expect(result.blocks).toEqual([]);
    expect(result.hiddenBlocked).toBe(1);
  });
});

describe('optionReason', () => {
  const fallback = FR.wizard.stack.blockedFallback;

  it('dit toujours pourquoi une option est bloquée', () => {
    expect(optionReason(option('x', 'blocked'), fallback)).toBe(
      'Incompatible avec la sélection en cours.',
    );
    expect(
      optionReason(option('x', 'blocked', { reason: 'Ne sort pas sur mobile.' }), fallback),
    ).toBe('Ne sort pas sur mobile.');
    expect(optionReason(option('x', 'available'), fallback)).toBeUndefined();
  });
});

describe('categoryProgress', () => {
  const options = [option('a', 'selected'), option('b', 'available'), option('c', 'blocked')];

  it('compte les choix faits et la taille de la catégorie', () => {
    expect(categoryProgress(options)).toEqual({ selected: 1, total: 3 });
  });
});

describe('libellés de catégories', () => {
  it('donne un libellé, jamais un slug nu, à chaque catégorie du registry', () => {
    // La table vit au dictionnaire : elle est donc traduite, et complète
    // (`satisfies Record<Category, string>` au dictionnaire, vérifié au rendu).
    for (const category of CATEGORIES) {
      const label = categoryLabel(FR, category);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toBe(category);
    }
  });
});

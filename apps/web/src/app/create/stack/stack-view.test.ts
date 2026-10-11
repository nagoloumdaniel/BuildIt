import { CATEGORIES } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import {
  CATEGORY_LABELS,
  type CategoryBlock,
  categoryLabel,
  categoryProgress,
  defaultCategory,
  filterCatalogue,
  filterOptions,
  GUIDED_MAX,
  guidedView,
  matchesQuery,
  normalizeText,
  type OptionState,
  optionReason,
  type StackOption,
  selectedCount,
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

describe('guidedView', () => {
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
    const view = guidedView(catalogue);
    expect(view.recommended.map((item) => item.id)).toEqual(['b', 'a', 'd', 'e']);
    expect(view.recommended).toHaveLength(GUIDED_MAX);
  });

  it('ne met jamais une option bloquée dans les recommandations', () => {
    expect(guidedView(catalogue).recommended.some((item) => item.state === 'blocked')).toBe(false);
  });

  it('expose le reste des disponibles derrière « Voir toutes les options »', () => {
    expect(guidedView(catalogue).hidden.map((item) => item.id)).toEqual(['f']);
  });

  it('garde toutes les options bloquées visibles, avec leur raison', () => {
    expect(guidedView(catalogue).blocked.map((item) => item.id)).toEqual(['c', 'g']);
  });

  it('garde une option choisie même au-delà du budget : la masquer empêcherait de la retirer', () => {
    const many = [
      option('a', 'selected'),
      option('b', 'selected'),
      option('c', 'selected'),
      option('d', 'selected'),
      option('e', 'selected'),
      option('f', 'available'),
    ];
    const view = guidedView(many);
    expect(view.recommended.map((item) => item.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(view.hidden.map((item) => item.id)).toEqual(['f']);
  });

  it('sur un catalogue plus petit que le budget, recommande tout ce qui est disponible', () => {
    const view = guidedView([option('a', 'selected'), option('b', 'available')]);
    expect(view.recommended.map((item) => item.id)).toEqual(['a', 'b']);
    expect(view.hidden).toEqual([]);
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
  it('dit toujours pourquoi une option est bloquée', () => {
    expect(optionReason(option('x', 'blocked'))).toBe('Incompatible avec la sélection en cours.');
    expect(optionReason(option('x', 'blocked', { reason: 'Ne sort pas sur mobile.' }))).toBe(
      'Ne sort pas sur mobile.',
    );
    expect(optionReason(option('x', 'available'))).toBeUndefined();
  });
});

describe('categoryProgress', () => {
  const options = [option('a', 'selected'), option('b', 'available'), option('c', 'blocked')];

  it('compte les choix faits et la taille de la catégorie', () => {
    expect(categoryProgress(options)).toEqual({ selected: 1, total: 3 });
  });

  it('totalise les choix de tout le catalogue', () => {
    const blocks = [
      block('frontend', [option('react', 'selected'), option('vue', 'available')]),
      block('database', [option('postgres', 'selected')]),
    ];
    expect(selectedCount(blocks)).toBe(2);
  });
});

describe('defaultCategory', () => {
  it('ouvre la première catégorie qui porte déjà un choix', () => {
    const blocks = [
      block('frontend', [option('react', 'available')]),
      block('database', [option('postgres', 'selected')]),
    ];
    expect(defaultCategory(blocks)).toBe('database');
  });

  it('retombe sur la première catégorie avec des fiches', () => {
    expect(defaultCategory([block('frontend', [option('react', 'available')])])).toBe('frontend');
  });

  it('sans fiche, ne choisit rien', () => {
    expect(defaultCategory([])).toBeUndefined();
  });
});

describe('libellés de catégories', () => {
  it('donne un libellé français à chaque catégorie du registry', () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
      expect(categoryLabel(category)).toBe(CATEGORY_LABELS[category]);
    }
  });
});

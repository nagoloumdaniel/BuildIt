import { describe, expect, it } from 'vitest';
import { EN, FR } from '../../lib/i18n/messages';
import {
  describeEdge,
  explainGraph,
  graphText,
  layoutGraph,
  type RelationEdge,
  type RelationNode,
  relationLabel,
  sortedEdges,
  sortedNodes,
  stateLabel,
} from './relations';

/**
 * Le Dependency Graph (§6.11) doit rester **stable** et **lisible sans voir le
 * dessin** : l'ordre ne dépend pas de l'ordre d'arrivée des nœuds, et chaque
 * relation a une phrase et une ligne de tableau. Ces fonctions sont pures, donc
 * l'accessibilité du rendu se prouve ici, pas à l'œil.
 *
 * Les mots viennent du dictionnaire : c'est lui qui est passé, dans les deux
 * langues — un graphe anglais ne doit pas garder les phrases françaises.
 */

const NODES: readonly RelationNode[] = [
  { id: 'postgresql', label: 'PostgreSQL', category: 'database', state: 'selected' },
  { id: 'next', label: 'Next.js', category: 'frontend', state: 'selected' },
  { id: 'typescript', label: 'TypeScript', category: 'language', state: 'added' },
];

const EDGES: readonly RelationEdge[] = [
  { from: 'next', to: 'typescript', kind: 'requires' },
  { from: 'next', to: 'postgresql', kind: 'compatibleWith' },
];

const LABELS = new Map(NODES.map((node) => [node.id, node.label]));

describe('les libellés du graphe', () => {
  it('nomme les deux natures d’arête en clair', () => {
    expect(relationLabel('requires', FR.graph)).toBe('exige');
    expect(relationLabel('compatibleWith', FR.graph)).toBe('compatible avec');
  });

  it('distingue un nœud choisi d’un nœud ajouté par le moteur', () => {
    expect(stateLabel('selected', FR.graph)).toBe('Choisi');
    expect(stateLabel('added', FR.graph)).toBe('Ajouté par le moteur');
  });

  it('suit la langue du dictionnaire passé', () => {
    expect(relationLabel('requires', EN.graph)).toBe('requires');
    expect(stateLabel('added', EN.graph)).toBe('Added by the engine');
  });
});

describe('l’ordre est stable, quel que soit l’ordre reçu', () => {
  it('trie les nœuds par identifiant', () => {
    expect(sortedNodes([...NODES].reverse()).map((node) => node.id)).toEqual([
      'next',
      'postgresql',
      'typescript',
    ]);
  });

  it('trie les arêtes par origine, puis destination, puis nature', () => {
    const edges = sortedEdges([...EDGES].reverse());
    expect(edges.map((edge) => `${edge.from}>${edge.to}:${edge.kind}`)).toEqual([
      'next>postgresql:compatibleWith',
      'next>typescript:requires',
    ]);
  });

  it.each([0, 1, 2, 3])('l’entrée mélangée %i donne le même rendu', (offset) => {
    const shuffled = [...NODES.slice(offset), ...NODES.slice(0, offset)];
    expect(sortedNodes(shuffled)).toEqual(sortedNodes(NODES));
    expect(layoutGraph(shuffled, EDGES)).toEqual(layoutGraph(NODES, EDGES));
  });
});

describe('describeEdge — une phrase complète pour chaque relation', () => {
  it('rend « A exige B. »', () => {
    const edge = EDGES[0];
    if (edge === undefined) {
      throw new Error('arête absente');
    }
    expect(describeEdge(edge, LABELS, FR.graph)).toBe('Next.js exige TypeScript.');
  });

  it('rend « A compatible avec B. »', () => {
    const edge = EDGES[1];
    if (edge === undefined) {
      throw new Error('arête absente');
    }
    expect(describeEdge(edge, LABELS, FR.graph)).toBe('Next.js compatible avec PostgreSQL.');
  });

  it('retombe sur l’identifiant quand le catalogue ne nomme pas le nœud', () => {
    const edge: RelationEdge = { from: 'inconnu', to: 'next', kind: 'requires' };
    expect(describeEdge(edge, LABELS, FR.graph)).toBe('inconnu exige Next.js.');
  });

  it('rend la phrase anglaise avec le dictionnaire anglais', () => {
    const edge: RelationEdge = { from: 'next', to: 'typescript', kind: 'compatibleWith' };
    expect(describeEdge(edge, LABELS, EN.graph)).toBe('Next.js compatible with TypeScript.');
  });
});

describe('graphText — l’équivalent textuel complet', () => {
  it('nomme chaque nœud avec son état et chaque arête', () => {
    const lines = graphText(NODES, EDGES, LABELS, FR.graph);
    const text = lines.join('\n');

    for (const node of NODES) {
      expect(text).toContain(node.label);
      expect(text).toContain(stateLabel(node.state, FR.graph));
    }
    expect(text).toContain('Next.js exige TypeScript.');
    expect(text).toContain('Next.js compatible avec PostgreSQL.');
  });

  it('un graphe vide ne produit aucune ligne', () => {
    expect(graphText([], [], LABELS, FR.graph)).toEqual([]);
  });
});

describe('layoutGraph — une mise en page déterministe', () => {
  it('place chaque nœud une fois, à une position distincte, dans les bornes', () => {
    const layout = layoutGraph(NODES, EDGES);

    expect(layout.nodes.map((placed) => placed.node.id)).toEqual([
      'next',
      'postgresql',
      'typescript',
    ]);
    const positions = new Set(layout.nodes.map((placed) => `${placed.x}:${placed.y}`));
    expect(positions.size).toBe(NODES.length);
    for (const placed of layout.nodes) {
      expect(placed.x).toBeGreaterThanOrEqual(0);
      expect(placed.y).toBeGreaterThanOrEqual(0);
      expect(placed.x).toBeLessThanOrEqual(layout.width);
      expect(placed.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it('trace une arête par relation entre deux nœuds présents', () => {
    const layout = layoutGraph(NODES, EDGES);
    expect(layout.edges).toHaveLength(2);
    // Une arête vers un nœud absent du graphe n'est pas dessinée.
    const orphaned = layoutGraph(NODES, [{ from: 'next', to: 'absent', kind: 'requires' }]);
    expect(orphaned.edges).toEqual([]);
  });

  it('un graphe vide reste dessinable', () => {
    const layout = layoutGraph([], []);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });
});

describe('layoutGraph — des colonnes d’exigence', () => {
  it('place ce qui est exigé à droite de ce qui l’exige', () => {
    const layout = layoutGraph(NODES, EDGES);
    const at = new Map(layout.nodes.map((placed) => [placed.node.id, placed]));
    expect(at.get('next')?.rank).toBe(0);
    expect(at.get('typescript')?.rank).toBe(1);
    expect(at.get('typescript')?.x ?? 0).toBeGreaterThan(at.get('next')?.x ?? 0);
  });

  it('ne trace qu’une fois une compatibilité déclarée dans les deux sens', () => {
    const layout = layoutGraph(NODES, [
      { from: 'next', to: 'postgresql', kind: 'compatibleWith' },
      { from: 'postgresql', to: 'next', kind: 'compatibleWith' },
    ]);
    expect(layout.edges).toHaveLength(1);
  });

  it('un cycle déclaré par erreur ne bloque pas la mise en page', () => {
    const layout = layoutGraph(NODES, [
      { from: 'next', to: 'typescript', kind: 'requires' },
      { from: 'typescript', to: 'next', kind: 'requires' },
    ]);
    expect(layout.nodes).toHaveLength(NODES.length);
    expect(layout.edges).toHaveLength(2);
  });

  it('donne la même taille à toutes les pastilles', () => {
    const layout = layoutGraph(NODES, EDGES);
    expect(layout.pillWidth).toBeGreaterThan(0);
    expect(layout.pillHeight).toBeGreaterThan(0);
  });
});

describe('explainGraph — ce que dit le graphe affiché', () => {
  const edges: readonly RelationEdge[] = [
    ...EDGES,
    { from: 'postgresql', to: 'typescript', kind: 'requires' },
  ];

  it('sépare les choix des additions', () => {
    const explanation = explainGraph(NODES, edges);
    expect(explanation.chosen.map((node) => node.id)).toEqual(['next', 'postgresql']);
    expect(explanation.added.map((entry) => entry.node.id)).toEqual(['typescript']);
  });

  it('donne, pour chaque addition, ce qui l’exige', () => {
    const [typescript] = explainGraph(NODES, edges).added;
    expect(typescript?.requiredBy.map((node) => node.label)).toEqual(['Next.js', 'PostgreSQL']);
  });

  it('choisit pour exemple une exigence d’un choix vers une addition', () => {
    const { example } = explainGraph(NODES, edges);
    expect(example?.from.id).toBe('next');
    expect(example?.to.id).toBe('typescript');
  });

  it('signale la présence d’une compatibilité', () => {
    expect(explainGraph(NODES, EDGES).hasCompatibility).toBe(true);
    expect(explainGraph(NODES, [EDGES[0] as RelationEdge]).hasCompatibility).toBe(false);
  });

  it('les phrases suivent la langue', () => {
    expect(FR.graphGuide.requiredBy(['Next.js', 'Prisma'])).toBe('exigé par Next.js et Prisma');
    expect(EN.graphGuide.requiredBy(['Next.js', 'Prisma'])).toBe('required by Next.js and Prisma');
  });
});

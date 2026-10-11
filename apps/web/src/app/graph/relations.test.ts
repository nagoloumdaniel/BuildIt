import { describe, expect, it } from 'vitest';
import {
  describeEdge,
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
    expect(relationLabel('requires')).toBe('exige');
    expect(relationLabel('compatibleWith')).toBe('compatible avec');
  });

  it('distingue un nœud choisi d’un nœud ajouté par le moteur', () => {
    expect(stateLabel('selected')).toBe('Choisi');
    expect(stateLabel('added')).toBe('Ajouté par le moteur');
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
    expect(describeEdge(edge, LABELS)).toBe('Next.js exige TypeScript.');
  });

  it('rend « A compatible avec B. »', () => {
    const edge = EDGES[1];
    if (edge === undefined) {
      throw new Error('arête absente');
    }
    expect(describeEdge(edge, LABELS)).toBe('Next.js compatible avec PostgreSQL.');
  });

  it('retombe sur l’identifiant quand le catalogue ne nomme pas le nœud', () => {
    const edge: RelationEdge = { from: 'inconnu', to: 'next', kind: 'requires' };
    expect(describeEdge(edge, LABELS)).toBe('inconnu exige Next.js.');
  });
});

describe('graphText — l’équivalent textuel complet', () => {
  it('nomme chaque nœud avec son état et chaque arête', () => {
    const lines = graphText(NODES, EDGES, LABELS);
    const text = lines.join('\n');

    for (const node of NODES) {
      expect(text).toContain(node.label);
      expect(text).toContain(stateLabel(node.state));
    }
    expect(text).toContain('Next.js exige TypeScript.');
    expect(text).toContain('Next.js compatible avec PostgreSQL.');
  });

  it('un graphe vide ne produit aucune ligne', () => {
    expect(graphText([], [], LABELS)).toEqual([]);
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

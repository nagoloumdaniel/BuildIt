import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphDiagram } from './GraphDiagram';
import { GraphEdgesTable, GraphNodesTable } from './GraphTables';
import { layoutGraph, type RelationEdge, type RelationNode } from './relations';

const NODES: readonly RelationNode[] = [
  { id: 'next', label: 'Next.js', category: 'frontend', state: 'selected' },
  { id: 'typescript', label: 'TypeScript', category: 'language', state: 'added' },
];

const EDGES: readonly RelationEdge[] = [{ from: 'next', to: 'typescript', kind: 'requires' }];

const LABELS = new Map(NODES.map((node) => [node.id, node.label]));

/**
 * Le graphe doit être lisible **sans le voir** : les tableaux sont l'équivalent
 * textuel complet (§6.11), le dessin n'ajoute qu'une vue. Ces tests vérifient
 * les deux, sans navigateur.
 *
 * Les composants lisent leur texte dans le dictionnaire (`useMessages()`) : ils
 * sont donc rendus comme des éléments, pas appelés comme des fonctions — hors
 * fournisseur, le dictionnaire rend le français, ce qui est le cas ici.
 */
describe('GraphNodesTable', () => {
  it('dit, pour chaque nœud, s’il est choisi ou ajouté', () => {
    const html = renderToStaticMarkup(createElement(GraphNodesTable, { nodes: NODES }));
    expect(html).toContain('Next.js');
    expect(html).toContain('Choisi');
    expect(html).toContain('TypeScript');
    expect(html).toContain('Ajouté par le moteur');
    expect(html).toContain('scope="col"');
    expect(html).toContain('class="pf-table"');
  });
});

describe('GraphEdgesTable', () => {
  it('nomme la nature de chaque relation', () => {
    const html = renderToStaticMarkup(
      createElement(GraphEdgesTable, { edges: EDGES, labels: LABELS }),
    );
    expect(html).toContain('Next.js');
    expect(html).toContain('TypeScript');
    expect(html).toContain('exige');
  });

  it('nomme aussi les compatibilités', () => {
    const html = renderToStaticMarkup(
      createElement(GraphEdgesTable, {
        edges: [{ from: 'next', to: 'typescript', kind: 'compatibleWith' }],
        labels: LABELS,
      }),
    );
    expect(html).toContain('compatible avec');
  });

  it('sans relation, le dit au lieu de rendre un tableau muet', () => {
    const html = renderToStaticMarkup(
      createElement(GraphEdgesTable, { edges: [], labels: LABELS }),
    );
    expect(html).toContain('Aucune relation déclarée');
  });
});

describe('GraphDiagram', () => {
  it('décrit le graphe pour les lecteurs d’écran', () => {
    const html = renderToStaticMarkup(
      createElement(GraphDiagram, { layout: layoutGraph(NODES, EDGES), labels: LABELS }),
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('Next.js exige TypeScript.');
    expect(html).toContain('viewBox');
  });
});

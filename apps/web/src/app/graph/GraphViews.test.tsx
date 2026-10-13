import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GraphDiagram } from './GraphDiagram';
import { GraphGuide } from './GraphGuide';
import { layoutGraph, type RelationEdge, type RelationNode } from './relations';

const NODES: readonly RelationNode[] = [
  { id: 'next', label: 'Next.js', category: 'frontend', state: 'selected' },
  { id: 'prisma', label: 'Prisma', category: 'orm', state: 'selected' },
  { id: 'typescript', label: 'TypeScript', category: 'language', state: 'added' },
];

const EDGES: readonly RelationEdge[] = [
  { from: 'next', to: 'typescript', kind: 'requires' },
  { from: 'prisma', to: 'typescript', kind: 'requires' },
];

const LABELS = new Map(NODES.map((node) => [node.id, node.label]));

/**
 * Le graphe doit être lisible **sans le voir** : la description du dessin est
 * l'équivalent textuel complet (§6.11), et la lecture qui suit explique ce
 * graphe-là. Ces tests vérifient les deux, sans navigateur.
 *
 * Les composants lisent leur texte dans le dictionnaire (`useMessages()`) : ils
 * sont donc rendus comme des éléments, pas appelés comme des fonctions. Hors
 * fournisseur, le dictionnaire rend le français, ce qui est le cas ici.
 */
describe('GraphGuide', () => {
  it('compte les choix et les additions du graphe affiché', () => {
    const html = renderToStaticMarkup(createElement(GraphGuide, { nodes: NODES, edges: EDGES }));
    expect(html).toContain('Vous avez choisi 2 technologies.');
    expect(html).toContain('Le moteur en a ajouté 1');
  });

  it('nomme chaque addition avec ce qui l’exige', () => {
    const html = renderToStaticMarkup(createElement(GraphGuide, { nodes: NODES, edges: EDGES }));
    expect(html).toContain('TypeScript');
    expect(html).toContain('exigé par Next.js et Prisma');
  });

  it('prend l’exemple de la légende dans le graphe affiché', () => {
    const html = renderToStaticMarkup(createElement(GraphGuide, { nodes: NODES, edges: EDGES }));
    expect(html).toContain('Ici, Next.js exige TypeScript.');
    // Pas de compatibilité dans ce graphe : la légende ne la mentionne pas.
    expect(html).not.toContain('compatibles');
  });

  it('sans addition, le dit au lieu de rendre une liste vide', () => {
    const html = renderToStaticMarkup(
      createElement(GraphGuide, { nodes: NODES.slice(0, 2), edges: [] }),
    );
    expect(html).toContain('Le moteur n’a rien eu à ajouter');
    expect(html).toContain('Aucune addition');
    expect(html).toContain('Aucune relation déclarée');
  });

  it('une addition sans exigence connue reste listée, sans raison inventée', () => {
    const html = renderToStaticMarkup(createElement(GraphGuide, { nodes: NODES, edges: [] }));
    expect(html).toContain('ajouté pour compléter la sélection');
  });

  it('montre la compatibilité dans la légende quand le graphe en a une', () => {
    const html = renderToStaticMarkup(
      createElement(GraphGuide, {
        nodes: NODES,
        edges: [...EDGES, { from: 'next', to: 'prisma', kind: 'compatibleWith' }],
      }),
    );
    expect(html).toContain('compatibles');
  });

  it('ne contient aucun tiret cadratin', () => {
    const html = renderToStaticMarkup(createElement(GraphGuide, { nodes: NODES, edges: EDGES }));
    expect(html).not.toContain('—');
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

  it('distingue un nœud choisi d’un nœud ajouté autrement que par la couleur', () => {
    const html = renderToStaticMarkup(
      createElement(GraphDiagram, { layout: layoutGraph(NODES, EDGES), labels: LABELS }),
    );
    expect(html).toContain('data-state="selected"');
    expect(html).toContain('data-state="added"');
    // Une flèche par exigence.
    expect(html.match(/marker-end=/g)).toHaveLength(2);
  });
});

/**
 * Le Dependency Graph (§6.11), hors du dessin.
 *
 * Le catalogue déclare deux natures de lien — `requires` et `compatibleWith` —
 * et le moteur distingue un nœud **choisi** d'un nœud **ajouté** pour tenir une
 * exigence. Ces fonctions traduisent ces faits, dans un ordre stable, et
 * produisent l'équivalent textuel complet : le graphe doit rester lisible sans
 * le voir, sans librairie de graphe et sans dépendance.
 *
 * Les **mots** ne sont pas ici : ils viennent du dictionnaire (`t.graph`), pour
 * que le même graphe se lise en français comme en anglais. Ce module ne porte
 * que la structure — ordre, mise en page, assemblage des phrases.
 */

export interface RelationNode {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly state: 'selected' | 'added';
}

export interface RelationEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: 'requires' | 'compatibleWith';
}

/**
 * Ce que le graphe emprunte au dictionnaire pour se dire.
 *
 * La forme est volontairement explicite (`requires: string`) plutôt qu'un
 * `Record<…>` : `t.graph` la satisfait clé par clé, sans cast.
 */
export interface GraphWording {
  readonly relationLabels: {
    readonly requires: string;
    readonly compatibleWith: string;
  };
  readonly stateLabels: {
    readonly selected: string;
    readonly added: string;
  };
  readonly describeNode: (label: string, category: string, state: string) => string;
  readonly describeEdge: (from: string, relation: string, to: string) => string;
}

export function relationLabel(kind: RelationEdge['kind'], wording: GraphWording): string {
  return wording.relationLabels[kind];
}

export function stateLabel(state: RelationNode['state'], wording: GraphWording): string {
  return wording.stateLabels[state];
}

/** Tri par identifiant : le rendu ne dépend pas de l'ordre de résolution. */
export function sortedNodes(nodes: readonly RelationNode[]): readonly RelationNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id, 'fr'));
}

/** Tri par origine, puis destination, puis nature. */
export function sortedEdges(edges: readonly RelationEdge[]): readonly RelationEdge[] {
  return [...edges].sort(
    (a, b) =>
      a.from.localeCompare(b.from, 'fr') ||
      a.to.localeCompare(b.to, 'fr') ||
      a.kind.localeCompare(b.kind, 'fr'),
  );
}

/** Un identifiant que le catalogue ne nomme pas reste affiché tel quel. */
function labelOf(id: string, labels: ReadonlyMap<string, string>): string {
  return labels.get(id) ?? id;
}

/** « A exige B. » — une phrase, jamais un pictogramme seul. */
export function describeEdge(
  edge: RelationEdge,
  labels: ReadonlyMap<string, string>,
  wording: GraphWording,
): string {
  return wording.describeEdge(
    labelOf(edge.from, labels),
    relationLabel(edge.kind, wording),
    labelOf(edge.to, labels),
  );
}

/** « Next.js (frontend, Choisi) » — la ligne de l'équivalent textuel. */
export function describeNode(node: RelationNode, wording: GraphWording): string {
  return wording.describeNode(node.label, node.category, stateLabel(node.state, wording));
}

/**
 * L'équivalent textuel complet : chaque nœud décrit, puis chaque relation en
 * phrase. C'est ce que lit un lecteur d'écran, et le contenu du `<desc>` du SVG.
 */
export function graphText(
  nodes: readonly RelationNode[],
  edges: readonly RelationEdge[],
  labels: ReadonlyMap<string, string>,
  wording: GraphWording,
): readonly string[] {
  const lines: string[] = sortedNodes(nodes).map((node) => describeNode(node, wording));
  lines.push(...sortedEdges(edges).map((edge) => describeEdge(edge, labels, wording)));
  return lines;
}

export interface PlacedNode {
  readonly node: RelationNode;
  readonly x: number;
  readonly y: number;
}

export interface DrawnEdge {
  readonly edge: RelationEdge;
  readonly from: PlacedNode;
  readonly to: PlacedNode;
}

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly PlacedNode[];
  readonly edges: readonly DrawnEdge[];
}

const CELL_WIDTH = 200;
const CELL_HEIGHT = 96;
const MARGIN = 24;

/**
 * Une mise en page déterministe : grille régulière, nœuds triés.
 *
 * Pas de simulation de forces — un nœud qui bouge au rechargement n'aide
 * personne. La grille suffit à montrer qui dépend de qui ; le tableau des
 * relations, lui, porte la sémantique.
 */
export function layoutGraph(
  nodes: readonly RelationNode[],
  edges: readonly RelationEdge[],
): GraphLayout {
  const ordered = sortedNodes(nodes);
  const columns = Math.max(1, Math.ceil(Math.sqrt(ordered.length)));
  const rows = Math.max(1, Math.ceil(ordered.length / columns));

  const placed: PlacedNode[] = ordered.map((node, index) => ({
    node,
    x: MARGIN + (index % columns) * CELL_WIDTH,
    y: MARGIN + Math.floor(index / columns) * CELL_HEIGHT,
  }));
  const byId = new Map(placed.map((entry) => [entry.node.id, entry]));

  const drawn: DrawnEdge[] = [];
  for (const edge of sortedEdges(edges)) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    // Une arête ne relie que des nœuds présents : pas de trait vers le vide.
    if (from !== undefined && to !== undefined) {
      drawn.push({ edge, from, to });
    }
  }

  return {
    width: MARGIN * 2 + columns * CELL_WIDTH,
    height: MARGIN * 2 + rows * CELL_HEIGHT,
    nodes: placed,
    edges: drawn,
  };
}

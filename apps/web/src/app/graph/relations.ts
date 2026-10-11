/**
 * Le Dependency Graph (§6.11), hors du dessin.
 *
 * Le catalogue déclare deux natures de lien — `requires` et `compatibleWith` —
 * et le moteur distingue un nœud **choisi** d'un nœud **ajouté** pour tenir une
 * exigence. Ces fonctions traduisent ces faits, dans un ordre stable, et
 * produisent l'équivalent textuel complet : le graphe doit rester lisible sans
 * le voir, sans librairie de graphe et sans dépendance.
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

export const RELATION_LABELS: Readonly<Record<RelationEdge['kind'], string>> = {
  requires: 'exige',
  compatibleWith: 'compatible avec',
};

export const STATE_LABELS: Readonly<Record<RelationNode['state'], string>> = {
  selected: 'Choisi',
  added: 'Ajouté par le moteur',
};

export function relationLabel(kind: RelationEdge['kind']): string {
  return RELATION_LABELS[kind];
}

export function stateLabel(state: RelationNode['state']): string {
  return STATE_LABELS[state];
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
export function describeEdge(edge: RelationEdge, labels: ReadonlyMap<string, string>): string {
  return `${labelOf(edge.from, labels)} ${relationLabel(edge.kind)} ${labelOf(edge.to, labels)}.`;
}

/** « Next.js (frontend, Choisi) » — la ligne de l'équivalent textuel. */
export function describeNode(node: RelationNode): string {
  return `${node.label} (${node.category}, ${stateLabel(node.state)})`;
}

/**
 * L'équivalent textuel complet : chaque nœud décrit, puis chaque relation en
 * phrase. C'est ce que lit un lecteur d'écran, et le contenu du `<desc>` du SVG.
 */
export function graphText(
  nodes: readonly RelationNode[],
  edges: readonly RelationEdge[],
  labels: ReadonlyMap<string, string>,
): readonly string[] {
  const lines: string[] = sortedNodes(nodes).map(describeNode);
  lines.push(...sortedEdges(edges).map((edge) => describeEdge(edge, labels)));
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

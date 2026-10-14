/**
 * Le Dependency Graph (§6.11), hors du dessin.
 *
 * Le catalogue déclare deux natures de lien `requires` et `compatibleWith` —
 * et le moteur distingue un nœud **choisi** d'un nœud **ajouté** pour tenir une
 * exigence. Ces fonctions traduisent ces faits, dans un ordre stable, et
 * produisent l'équivalent textuel complet : le graphe doit rester lisible sans
 * le voir, sans librairie de graphe et sans dépendance.
 *
 * Les **mots** ne sont pas ici : ils viennent du dictionnaire (`t.graph`), pour
 * que le même graphe se lise en français comme en anglais. Ce module ne porte
 * que la structure ordre, mise en page, assemblage des phrases.
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

/** « A exige B. » une phrase, jamais un pictogramme seul. */
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

/** « Next.js (frontend, Choisi) » la ligne de l'équivalent textuel. */
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
  /** Coin haut gauche de la pastille, en pixels du dessin. */
  readonly x: number;
  readonly y: number;
  /** La colonne : 0 pour ce que rien n'exige, puis un cran par exigence. */
  readonly rank: number;
}

export interface DrawnEdge {
  readonly edge: RelationEdge;
  readonly from: PlacedNode;
  readonly to: PlacedNode;
  /** Le tracé SVG du lien, déjà calculé : le composant ne fait que le poser. */
  readonly path: string;
}

export interface GraphLayout {
  readonly width: number;
  readonly height: number;
  /** Toutes les pastilles ont la même taille : une colonne se lit d'un coup d'œil. */
  readonly pillWidth: number;
  readonly pillHeight: number;
  readonly nodes: readonly PlacedNode[];
  readonly edges: readonly DrawnEdge[];
}

const PILL_HEIGHT = 36;
const ROW_GAP = 14;
const COLUMN_GAP = 72;
const MARGIN = 12;
/** La place à droite pour l'arc d'un lien entre deux voisins de colonne. */
const ARC_ROOM = 32;
const PILL_MIN = 132;
const PILL_MAX = 216;
/** Icône, marges intérieures et repère d'état, autour du nom. */
const PILL_CHROME = 60;
/** La chasse moyenne d'Inter à 13 px : un nom trop long est tronqué en CSS, pas débordé. */
const CHAR_WIDTH = 7.1;

/**
 * La colonne de chaque nœud : le plus long chemin d'exigences qui y mène.
 *
 * Next.js et Prisma exigent TypeScript : les deux sont en colonne 0,
 * TypeScript en colonne 1, et toutes les flèches pleines vont de gauche à
 * droite. Le calcul est borné au nombre de nœuds : un cycle déclaré par
 * erreur dans le catalogue ne fait pas tourner l'écran en rond.
 */
function rankNodes(
  ordered: readonly RelationNode[],
  requires: readonly RelationEdge[],
): ReadonlyMap<string, number> {
  const rank = new Map(ordered.map((node) => [node.id, 0]));
  for (let pass = 0; pass < ordered.length; pass += 1) {
    let changed = false;
    for (const edge of requires) {
      const from = rank.get(edge.from);
      const to = rank.get(edge.to);
      if (from !== undefined && to !== undefined && to < from + 1 && from + 1 < ordered.length) {
        rank.set(edge.to, from + 1);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }
  return rank;
}

/** Une courbe douce d'un bord de pastille à l'autre, ou un arc entre voisins de colonne. */
function edgePath(from: PlacedNode, to: PlacedNode, width: number, height: number): string {
  const y1 = from.y + height / 2;
  const y2 = to.y + height / 2;
  if (to.x > from.x) {
    const x1 = from.x + width;
    // La flèche s'arrête avant la pastille : sa pointe ne mord pas la bordure.
    const x2 = to.x - 3;
    const bend = (x2 - x1) / 2;
    return `M${x1} ${y1}C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
  }
  if (to.x < from.x) {
    const x1 = from.x;
    const x2 = to.x + width + 3;
    const bend = (x1 - x2) / 2;
    return `M${x1} ${y1}C${x1 - bend} ${y1} ${x2 + bend} ${y2} ${x2} ${y2}`;
  }
  const x = from.x + width;
  return `M${x} ${y1}C${x + ARC_ROOM} ${y1} ${x + ARC_ROOM} ${y2} ${x + 3} ${y2}`;
}

/** Vos choix d'abord, puis le reste, par identifiant. */
function chosenFirst(a: RelationNode, b: RelationNode): number {
  return (
    Number(a.state !== 'selected') - Number(b.state !== 'selected') ||
    a.id.localeCompare(b.id, 'fr')
  );
}

/**
 * Une mise en page déterministe, en colonnes d'exigence.
 *
 * Pas de simulation de forces : un nœud qui bouge au rechargement n'aide
 * personne. À gauche ce qui exige, à droite ce qui est exigé ; dans une
 * colonne, chaque nœud se range près de ceux qui l'exigent (moyenne de leurs
 * rangs), ce qui évite la plupart des croisements sans algorithme lourd. Les
 * colonnes plus courtes sont centrées sur la plus haute.
 *
 * Une compatibilité déclarée dans les deux sens n'est tracée qu'une fois :
 * c'est le même fait, pas deux.
 */
export function layoutGraph(
  nodes: readonly RelationNode[],
  edges: readonly RelationEdge[],
): GraphLayout {
  const ordered = sortedNodes(nodes);
  const known = new Set(ordered.map((node) => node.id));
  // Une arête ne relie que des nœuds présents : pas de trait vers le vide.
  const sorted = sortedEdges(edges).filter(
    (edge) => known.has(edge.from) && known.has(edge.to) && edge.from !== edge.to,
  );
  const requires = sorted.filter((edge) => edge.kind === 'requires');
  const rank = rankNodes(ordered, requires);

  const columnCount = ordered.length === 0 ? 1 : Math.max(...rank.values()) + 1;
  const columns: RelationNode[][] = Array.from({ length: columnCount }, () => []);
  for (const node of ordered) {
    columns[rank.get(node.id) ?? 0]?.push(node);
  }

  const row = new Map<string, number>();
  columns.forEach((list, column) => {
    if (column === 0) {
      list.sort(chosenFirst);
    } else {
      const weights = new Map(
        list.map((node) => {
          const sources = requires
            .filter((edge) => edge.to === node.id)
            .map((edge) => row.get(edge.from))
            .filter((value): value is number => value !== undefined);
          const weight =
            sources.length === 0
              ? Number.MAX_SAFE_INTEGER
              : sources.reduce((sum, value) => sum + value, 0) / sources.length;
          return [node.id, weight];
        }),
      );
      list.sort((a, b) => (weights.get(a.id) ?? 0) - (weights.get(b.id) ?? 0) || chosenFirst(a, b));
    }
    list.forEach((node, index) => {
      row.set(node.id, index);
    });
  });

  const longest = ordered.reduce((max, node) => Math.max(max, node.label.length), 0);
  const pillWidth = Math.round(
    Math.min(PILL_MAX, Math.max(PILL_MIN, longest * CHAR_WIDTH + PILL_CHROME)),
  );
  const tallest = Math.max(1, ...columns.map((list) => list.length));
  const pitch = PILL_HEIGHT + ROW_GAP;

  const placed: PlacedNode[] = [];
  columns.forEach((list, column) => {
    const offset = ((tallest - list.length) * pitch) / 2;
    list.forEach((node, index) => {
      placed.push({
        node,
        rank: column,
        x: MARGIN + column * (pillWidth + COLUMN_GAP),
        y: MARGIN + offset + index * pitch,
      });
    });
  });
  const byId = new Map(placed.map((entry) => [entry.node.id, entry]));

  const drawn: DrawnEdge[] = [];
  const pairs = new Set<string>();
  for (const edge of sorted) {
    if (edge.kind === 'compatibleWith') {
      const pair = [edge.from, edge.to].sort().join('|');
      if (pairs.has(pair)) {
        continue;
      }
      pairs.add(pair);
    }
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from !== undefined && to !== undefined) {
      drawn.push({ edge, from, to, path: edgePath(from, to, pillWidth, PILL_HEIGHT) });
    }
  }

  return {
    width: MARGIN * 2 + columnCount * pillWidth + (columnCount - 1) * COLUMN_GAP + ARC_ROOM,
    height: MARGIN * 2 + tallest * pitch - ROW_GAP,
    pillWidth,
    pillHeight: PILL_HEIGHT,
    nodes: placed,
    edges: drawn,
  };
}

/** Une technologie ajoutée, et celles qui l'ont rendue nécessaire. */
export interface AddedExplanation {
  readonly node: RelationNode;
  readonly requiredBy: readonly RelationNode[];
}

export interface GraphExplanation {
  readonly chosen: readonly RelationNode[];
  readonly added: readonly AddedExplanation[];
  /** Une vraie exigence du graphe affiché, pour illustrer la flèche de la légende. */
  readonly example: { readonly from: RelationNode; readonly to: RelationNode } | undefined;
  readonly hasCompatibility: boolean;
}

/**
 * Ce que l'écran dit du graphe affiché, et pas d'un graphe en général.
 *
 * Le moteur ne transmet pas la raison d'une addition : on la retrouve dans
 * les arêtes `requires` qui y mènent. Une addition sans exigence entrante
 * reste listée (le moteur l'a voulue), avec une phrase qui ne prétend pas
 * savoir pourquoi.
 */
export function explainGraph(
  nodes: readonly RelationNode[],
  edges: readonly RelationEdge[],
): GraphExplanation {
  const ordered = sortedNodes(nodes);
  const byId = new Map(ordered.map((node) => [node.id, node]));
  const requires = sortedEdges(edges).filter(
    (edge) =>
      edge.kind === 'requires' && edge.from !== edge.to && byId.has(edge.from) && byId.has(edge.to),
  );

  const added = ordered
    .filter((node) => node.state === 'added')
    .map((node) => {
      const requiredBy = [
        ...new Set(requires.filter((edge) => edge.to === node.id).map((edge) => edge.from)),
      ]
        .map((id) => byId.get(id))
        .filter((entry): entry is RelationNode => entry !== undefined)
        // Un choix explique mieux qu'une autre addition : il vient en premier.
        .sort(chosenFirst);
      return { node, requiredBy };
    });

  // L'exemple préfère « un choix exige une addition » : c'est la flèche à comprendre.
  const first =
    requires.find(
      (edge) => byId.get(edge.from)?.state === 'selected' && byId.get(edge.to)?.state === 'added',
    ) ?? requires[0];
  const from = first === undefined ? undefined : byId.get(first.from);
  const to = first === undefined ? undefined : byId.get(first.to);

  return {
    chosen: ordered.filter((node) => node.state === 'selected'),
    added,
    example: from !== undefined && to !== undefined ? { from, to } : undefined,
    hasCompatibility: edges.some(
      (edge) => edge.kind === 'compatibleWith' && byId.has(edge.from) && byId.has(edge.to),
    ),
  };
}

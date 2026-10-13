import type { Widen } from './widen';

/**
 * Le graphe de dépendances : légende et explication propres au graphe affiché.
 *
 * Voir `messages.ts` pour la composition. Le français fait foi : une clé
 * ajoutée d'un côté sans l'autre fait échouer `pnpm typecheck`.
 *
 * Les noms de technologies sont des valeurs du catalogue : ils arrivent déjà
 * écrits et ne sont jamais traduits. Seules les phrases autour le sont.
 */

/** « A », « A et B », « A, B et C » : la conjonction de la langue, pas une virgule de plus. */
const listFr = (items: readonly string[]): string =>
  new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' }).format(items);
const listEn = (items: readonly string[]): string =>
  new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(items);

export const FR_GRAPH = {
  graphGuide: {
    diagramHint: 'À gauche ce qui exige, à droite ce qui est exigé.',
    scrollHint: 'Le dessin défile sur le côté quand il dépasse l’écran.',
    heading: 'Lecture du graphe',
    summary: (chosen: number, added: number): string => {
      const picked = `Vous avez choisi ${chosen} technologie${chosen > 1 ? 's' : ''}.`;
      if (added === 0) {
        return `${picked} Le moteur n’a rien eu à ajouter : chaque exigence est déjà couverte par votre sélection.`;
      }
      return `${picked} Le moteur en a ajouté ${added}, parce qu’une technologie du graphe ne fonctionne pas sans ${added > 1 ? 'elles' : 'elle'}.`;
    },
    chosenHeading: 'Vos choix',
    addedHeading: 'Ajoutés par le moteur',
    noAdditions: 'Aucune addition : votre sélection tient seule.',
    requiredBy: (names: readonly string[]): string => `exigé par ${listFr(names)}`,
    addedAlso: 'lui-même ajouté',
    addedWithoutEdge: 'ajouté pour compléter la sélection',
    legendHeading: 'Légende',
    legendChosen: 'Choisi par vous',
    legendAdded: 'Ajouté par le moteur, bordure pointillée',
    legendRequires: 'Flèche pleine : la technologie de départ exige celle d’arrivée',
    legendExample: (from: string, to: string): string => `Ici, ${from} exige ${to}.`,
    legendCompatible: 'Trait pointillé, sans flèche : compatibles, sans exigence',
  },
} as const;

export const EN_GRAPH: Widen<typeof FR_GRAPH> = {
  graphGuide: {
    diagramHint: 'Left: what requires. Right: what is required.',
    scrollHint: 'The drawing scrolls sideways when it is wider than the screen.',
    heading: 'Reading the graph',
    summary: (chosen: number, added: number): string => {
      const picked = `You chose ${chosen} technolog${chosen === 1 ? 'y' : 'ies'}.`;
      if (added === 0) {
        return `${picked} The engine had nothing to add: your selection already covers every requirement.`;
      }
      return `${picked} The engine added ${added}, because a technology in the graph does not work without ${added > 1 ? 'them' : 'it'}.`;
    },
    chosenHeading: 'Your choices',
    addedHeading: 'Added by the engine',
    noAdditions: 'No additions: your selection stands on its own.',
    requiredBy: (names: readonly string[]): string => `required by ${listEn(names)}`,
    addedAlso: 'itself added',
    addedWithoutEdge: 'added to complete the selection',
    legendHeading: 'Legend',
    legendChosen: 'Chosen by you',
    legendAdded: 'Added by the engine, dashed border',
    legendRequires: 'Solid arrow: the starting technology requires the one it points to',
    legendExample: (from: string, to: string): string => `Here, ${from} requires ${to}.`,
    legendCompatible: 'Dashed line, no arrow: compatible, no requirement',
  },
};

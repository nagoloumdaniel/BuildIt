'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGraphAction } from '../actions';
import type { RelationEdge, RelationNode } from './relations';

/**
 * Le chargement d'un graphe, partagé par le mode brouillon (`/graph`) et la
 * page d'un projet déjà généré (`/projects/graph`).
 *
 * Ce qui dépend de l'écran, c'est **d'où vient la sélection** : du brouillon
 * pour l'un, du manifest conservé pour l'autre. Le reste la course entre deux
 * réponses, l'échec, le nouveau calcul est le même, et n'a donc qu'une copie :
 * deux copies divergeraient au premier correctif.
 */

/** Ce que le dessin et la lecture du graphe affichent. */
export interface GraphData {
  readonly nodes: readonly RelationNode[];
  readonly edges: readonly RelationEdge[];
  readonly status: 'certified' | 'experimental';
}

/** La sélection, réduite à ce que le moteur lit. */
export interface GraphSelection {
  readonly targets: readonly string[];
  readonly technologies: readonly string[];
}

export interface GraphLoad {
  /** `null` tant que le moteur n'a pas répondu, ou après un échec. */
  readonly graph: GraphData | null;
  readonly failed: boolean;
  /** Relance le calcul : « Recalculer » n'a pas d'autre effet. */
  readonly reload: () => void;
}

/**
 * `selection` doit être mémorisée par l'appelant (`useMemo`) : une identité
 * neuve à chaque rendu relancerait le calcul en boucle.
 */
export function useGraphLoad(selection: GraphSelection): GraphLoad {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [failed, setFailed] = useState(false);

  /**
   * Chaque calcul porte un numéro : une réponse tardive la sélection a changé
   * entre-temps, ou l'utilisateur a relancé ne doit pas écraser l'état courant.
   */
  const requestId = useRef(0);
  const load = useCallback((): void => {
    const ticket = requestId.current + 1;
    requestId.current = ticket;
    setFailed(false);
    setGraph(null);
    void loadGraphAction(selection)
      .then((value) => {
        if (requestId.current === ticket) {
          setGraph({ nodes: value.nodes, edges: value.edges, status: value.status });
        }
      })
      .catch(() => {
        if (requestId.current === ticket) {
          setFailed(true);
        }
      });
  }, [selection]);

  useEffect(() => {
    load();
    return () => {
      // La réponse en vol devient obsolète : elle ne touchera plus l'écran.
      requestId.current += 1;
    };
  }, [load]);

  return { graph, failed, reload: load };
}

'use client';

import { type ReactElement, useEffect, useRef } from 'react';
import { useLocalProjectOpen } from './local-open';
import { takePending } from './picked-store';
import { OpenView } from './view';

/**
 * Écran 23 — Open Local Project (§6.23) : le branchement.
 *
 * Toute la logique vit dans `useLocalProjectOpen` (le fil d'état, testable) et
 * dans `view.tsx` (le rendu, testable sans DOM). Ce fichier ne fait qu'une
 * chose en plus : reprendre le dossier que l'accueil vient de faire choisir,
 * pour que l'analyse soit déjà en route quand l'écran s'affiche — sans
 * redemander le dossier qu'on vient de désigner.
 *
 * La reprise est consommée (`takePending`) et gardée par une `ref` : le mode
 * strict de React rejoue les effets en développement, et une analyse lancée
 * deux fois afficherait deux attentes pour un seul geste.
 */
export default function OpenPage(): ReactElement {
  const controller = useLocalProjectOpen();
  const resumed = useRef(false);

  useEffect(() => {
    if (resumed.current) {
      return;
    }
    resumed.current = true;
    const pending = takePending();
    if (pending !== null) {
      controller.analyse(pending);
    }
  }, [controller]);

  return <OpenView controller={controller} />;
}

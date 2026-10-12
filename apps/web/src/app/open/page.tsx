'use client';

import type { ReactElement } from 'react';
import { useLocalProjectOpen } from './local-open';
import { OpenView } from './view';

/**
 * Écran 23 — Open Local Project (§6.23) : le branchement.
 *
 * Toute la logique vit dans `useLocalProjectOpen` (le fil d'état, testable) et
 * dans `view.tsx` (le rendu, testable sans DOM). Ce fichier ne fait qu'un
 * appel : c'est ce qui permet à la carte du menu d'accueil de rejouer le même
 * fil sans dupliquer une ligne de décision.
 */
export default function OpenPage(): ReactElement {
  const controller = useLocalProjectOpen();
  return <OpenView controller={controller} />;
}

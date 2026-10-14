'use client';

import type { PickedAccess, PickedFolder } from './browser-picker';

/**
 * Le dossier qu'on vient de choisir, en attente d'être analysé par l'écran
 * d'ouverture.
 *
 * Pourquoi un module et pas l'URL : en local, le dossier est un chemin absolu
 * (`C:\\projets\\mon-app`) qui n'a rien à faire dans une adresse on ne partage
 * pas l'arborescence de sa machine dans un lien, et un chemin dans l'URL
 * invite à le modifier à la main, ce que le produit refuse de toute façon. En
 * hébergé, ce n'est même pas possible : le navigateur rend une poignée, pas un
 * chemin, et les entrées lues ne tiendraient pas dans une adresse.
 *
 * La navigation de Next est côté client : ce module reste vivant entre la carte
 * du menu et l'écran `/open`. C'est le même motif que `lib/toasts.ts` un état
 * minuscule, posé une fois, repris une fois, et **consommé** à la lecture pour
 * qu'un retour en arrière ne rejoue pas une analyse que personne n'a demandée.
 */

export type PickedTarget =
  /** Le chemin absolu rendu par l'explorateur de la machine (mode local). */
  | { readonly kind: 'path'; readonly path: string }
  /** Ce que le navigateur du visiteur a laissé lire (mode hébergé). */
  | {
      readonly kind: 'entries';
      readonly value: PickedFolder;
      /** Écrire par la poignée (Chromium), ou seulement lire (repli `<input>`). */
      readonly access: PickedAccess;
    };

let pending: PickedTarget | null = null;

export function handOver(target: PickedTarget): void {
  pending = target;
}

/** Le dossier en attente, **retiré** du passage : il ne se rejoue pas. */
export function takePending(): PickedTarget | null {
  const target = pending;
  pending = null;
  return target;
}

/** Le libellé à afficher pour une cible : un chemin, ou un nom de dossier. */
export function targetLabel(target: PickedTarget): string {
  return target.kind === 'path' ? target.path : target.value.name;
}

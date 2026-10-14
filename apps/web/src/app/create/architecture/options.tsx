'use client';

import { ARCHITECTURES, type Architecture } from '@buildit/manifest';
import type { ReactElement } from 'react';
import type { DraftState } from '../../../lib/draft';
import { useMessages } from '../../../lib/i18n/provider';

/**
 * Écran 4 **Architecture Builder** (§6.5) : la forme du projet, avec sa
 * description courte **et son impact** (complexité, coût d'exploitation).
 *
 * Module co-localisé, pas `page.tsx` : Next refuse tout export autre que
 * `default` dans un écran (validateur engendré). Même convention que les autres
 * écrans (`capabilities.ts`, `summary.ts`).
 *
 * Les valeurs viennent de `ARCHITECTURES` du manifest jamais recopiées. Les
 * phrases d'impact vivent au dictionnaire (`wizard.architecture.labels`), où
 * chaque forme est une clé : ajouter une architecture au manifest sans lui
 * écrire sa phrase casse la compilation au point d'usage. Même garde-fou que
 * l'écran cible.
 *
 * La carte reste volontairement courte : le nom, l'explication, l'impact
 * (complexité, coût) et le mode d'exécution. Le dépôt et l'arborescence de base
 * vivaient ici aussi, et transformaient la grille en mur de texte.
 *
 * `architecture`, lui, **part dans le manifest** (contrairement à `type`) : le
 * schéma du §10 le déclare obligatoire.
 */

/**
 * La forme posée quand aucune n'est encore choisie : le manifest exige une
 * architecture (§10). L'application unique est la plus simple ; le moteur passe
 * de lui-même en monorepo quand un frontend et un backend sont choisis
 * (`draftToManifest`). Ce n'est pas une recommandation, l'écran n'en affiche
 * aucune.
 */
export const DEFAULT_ARCHITECTURE: Architecture = 'single-app';

/** Le changement de brouillon d'une sélection testable hors React. */
export function withArchitecture(draft: DraftState, architecture: Architecture): DraftState {
  return { ...draft, architecture };
}

export interface ArchitectureChoicesProps {
  readonly selected: string | undefined;
  readonly onSelect: (architecture: Architecture) => void;
}

/** Le contenu de l'écran, hors contexte React donc testable au rendu serveur. */
export function ArchitectureChoices({
  selected,
  onSelect,
}: ArchitectureChoicesProps): ReactElement {
  const t = useMessages();
  const chosen = ARCHITECTURES.find((architecture) => architecture === selected);
  const labels = t.wizard.architecture.labels;

  return (
    <>
      <fieldset>
        <legend className="pf-label">{t.wizard.architecture.legend}</legend>
        <div className="pf-grid">
          {ARCHITECTURES.map((architecture) => {
            const note = labels[architecture];
            return (
              <button
                key={architecture}
                type="button"
                className="pf-choice"
                data-architecture={architecture}
                aria-pressed={chosen === architecture}
                onClick={() => onSelect(architecture)}
              >
                <span className="pf-choice-name">{note.label}</span>
                <span className="pf-choice-note">{note.note}</span>
                <span className="pf-choice-note">
                  {t.wizard.architecture.impact(note.complexity, note.cost)}
                </span>
                <span className="pf-choice-note">
                  {t.wizard.architecture.runtimeLabel} : {note.runtime}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="pf-hint mt-4">
        {chosen === undefined
          ? t.wizard.architecture.none
          : t.wizard.architecture.summary(
              labels[chosen].label,
              labels[chosen].complexity,
              labels[chosen].cost,
            )}
      </p>
    </>
  );
}

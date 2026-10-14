'use client';

import type { ReactElement } from 'react';
import type { DraftState } from '../../../lib/draft';
import { useMessages } from '../../../lib/i18n/provider';

/**
 * Écran 3 **Project Type** (§6.4) : le profil du produit.
 *
 * Le contenu vit ici, pas dans `page.tsx`, pour une raison de build : Next
 * engendre un fichier de types par écran, qui refuse tout export autre que
 * `default` et les champs de configuration (« Type ... does not satisfy the
 * constraint '{ [x: string]: never; }' »). Un écran qui exporte ses données
 * casse donc `next build`. Le module co-localisé est aussi ce que font les
 * autres écrans (`capabilities.ts`, `summary.ts`).
 *
 * Décision écrite : `type` est une donnée **d'UI**, il n'est pas dans le
 * manifest. Vérifié sur `packages/manifest` : le schéma du §10 est strict et
 * n'a pas de clé `type` ; il n'a qu'un seul champ libre (`name`). Le brouillon
 * le porte (`DraftState.type`) : un profil n'est pas une contrainte du moteur,
 * c'est une intention.
 *
 * Les phrases des profils vivent au dictionnaire (`wizard.types.labels`), où
 * chaque profil est une clé : ajouter un profil ici sans lui écrire sa phrase
 * devient une erreur de compilation au point d'usage, pas un écran muet.
 */

export const PROJECT_TYPES = [
  'saas',
  'marketplace',
  'ecommerce',
  'dashboard',
  'blog',
  'ai',
  'api',
  'business',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export function isProjectType(value: string | undefined): value is ProjectType {
  return value !== undefined && (PROJECT_TYPES as readonly string[]).includes(value);
}

/** Le changement de brouillon d'une sélection testable hors React. */
export function withType(draft: DraftState, type: ProjectType): DraftState {
  return { ...draft, type };
}

export interface ProjectTypeChoicesProps {
  readonly selected: string | undefined;
  readonly onSelect: (type: ProjectType) => void;
}

/** Le contenu de l'écran, hors contexte React donc testable au rendu serveur. */
export function ProjectTypeChoices({ selected, onSelect }: ProjectTypeChoicesProps): ReactElement {
  const t = useMessages();
  const chosen = isProjectType(selected) ? selected : undefined;
  const labels = t.wizard.types.labels;

  return (
    <>
      <fieldset>
        <legend className="pf-label">{t.wizard.types.legend}</legend>
        <div className="pf-grid">
          {PROJECT_TYPES.map((type) => {
            const note = labels[type];
            return (
              <button
                key={type}
                type="button"
                className="pf-choice"
                data-type={type}
                aria-pressed={chosen === type}
                onClick={() => onSelect(type)}
              >
                <span className="pf-choice-name">{note.label}</span>
                <span className="pf-choice-note">{note.note}</span>
                <span className="pf-choice-note">{note.guides}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="pf-hint mt-4">
        {chosen === undefined
          ? t.wizard.types.none
          : t.wizard.types.summary(labels[chosen].label, labels[chosen].guides)}
      </p>
    </>
  );
}

'use client';

import { ARCHITECTURES, type Architecture } from '@buildit/manifest';
import { type ReactElement, useState } from 'react';
import type { DraftState } from '../../../lib/draft';
import { isProjectType, type ProjectType, TYPE_NOTES } from '../type/profiles';

/**
 * Écran 5 — **Architecture Builder** (§6.5) : la forme du projet, avec sa
 * description courte **et son impact** (complexité, coût d'exploitation).
 *
 * Module co-localisé, pas `page.tsx` : Next refuse tout export autre que
 * `default` dans un écran (validateur engendré). Même convention que les autres
 * écrans (`capabilities.ts`, `summary.ts`).
 *
 * Les valeurs viennent de `ARCHITECTURES` du manifest — jamais recopiées. La
 * table ci-dessous est exhaustive : ajouter une architecture au manifest casse
 * la compilation ici, ce qui force à écrire sa phrase d'impact. Même garde-fou
 * que l'écran cible.
 *
 * `architecture`, lui, **part dans le manifest** (contrairement à `type`) : le
 * schéma du §10 le déclare obligatoire.
 */

export interface ArchitectureNote {
  readonly label: string;
  readonly note: string;
  readonly complexity: string;
  readonly cost: string;
}

export const ARCHITECTURE_NOTES: Readonly<Record<Architecture, ArchitectureNote>> = {
  'single-app': {
    label: 'Application unique',
    note: 'Une seule application, un seul dépôt, un seul déploiement.',
    complexity: 'faible',
    cost: 'minimal — un seul service à héberger et à surveiller.',
  },
  monorepo: {
    label: 'Monorepo',
    note: 'Plusieurs applications et paquets partagés dans un même dépôt.',
    complexity: 'moyenne',
    cost: 'modéré — la CI doit être outillée pour ne construire que ce qui change.',
  },
  'modular-monolith': {
    label: 'Monolithe modulaire',
    note: 'Un seul déploiement, des modules internes aux frontières nettes.',
    complexity: 'moyenne',
    cost: 'faible — un seul déployable, mais une discipline de modules à tenir.',
  },
  microservices: {
    label: 'Microservices',
    note: 'Des services indépendants, déployés et mis à l’échelle séparément.',
    complexity: 'élevée',
    cost: 'élevé — réseau, orchestration et observabilité à financer.',
  },
  serverless: {
    label: 'Serverless',
    note: 'Des fonctions exécutées à la demande, sans serveur à administrer.',
    complexity: 'moyenne',
    cost: 'variable — à l’usage, avec un plafond de facturation à surveiller.',
  },
  'event-driven': {
    label: 'Orienté événements',
    note: 'Des flux d’événements découplent producteurs et consommateurs.',
    complexity: 'élevée',
    cost: 'élevé — une file et une supervision de bout en bout.',
  },
};

/**
 * Les architectures recommandées pour chaque profil du §6.4.
 *
 * `Record<ProjectType, …>` : ajouter un profil à l'écran 4 casse la compilation
 * ici tant qu'on n'a pas dit ce qu'on lui recommande. Deux à quatre valeurs,
 * jamais tout le catalogue (§5).
 */
const BY_TYPE: Readonly<Record<ProjectType, readonly Architecture[]>> = {
  saas: ['monorepo', 'single-app', 'modular-monolith'],
  marketplace: ['monorepo', 'microservices'],
  ecommerce: ['monorepo', 'modular-monolith', 'single-app'],
  dashboard: ['single-app', 'modular-monolith'],
  blog: ['single-app', 'serverless'],
  ai: ['modular-monolith', 'serverless', 'monorepo'],
  api: ['single-app', 'serverless'],
  business: ['modular-monolith', 'monorepo'],
};

const FALLBACK: readonly Architecture[] = ['single-app', 'monorepo', 'modular-monolith'];

export function recommendedArchitectures(type: string | undefined): readonly Architecture[] {
  return isProjectType(type) ? BY_TYPE[type] : FALLBACK;
}

/** Le changement de brouillon d'une sélection — testable hors React. */
export function withArchitecture(draft: DraftState, architecture: Architecture): DraftState {
  return { ...draft, architecture };
}

export interface ArchitectureChoicesProps {
  readonly mode: 'guided' | 'expert';
  readonly selected: string | undefined;
  /** Le profil choisi à l'écran 4 — il décide des recommandations. */
  readonly type: string | undefined;
  readonly onSelect: (architecture: Architecture) => void;
}

/** Le contenu de l'écran, hors contexte React — donc testable au rendu serveur. */
export function ArchitectureChoices({
  mode,
  selected,
  type,
  onSelect,
}: ArchitectureChoicesProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const guided = mode === 'guided';
  const recommended = recommendedArchitectures(type);
  const ordered = [
    ...recommended,
    ...ARCHITECTURES.filter((architecture) => !recommended.includes(architecture)),
  ];
  const visible = guided && !expanded ? recommended : ordered;
  const chosen = ARCHITECTURES.find((architecture) => architecture === selected);

  return (
    <>
      {guided ? (
        <p className="pf-hint mb-2">
          {isProjectType(type)
            ? `Recommandations pour le profil « ${TYPE_NOTES[type].label} ».`
            : 'Recommandations par défaut : aucun profil n’est encore choisi.'}
        </p>
      ) : null}

      <fieldset>
        <legend className="pf-label">Formes d’architecture disponibles</legend>
        <div className="pf-grid">
          {visible.map((architecture) => {
            const note = ARCHITECTURE_NOTES[architecture];
            const isRecommended = guided && recommended.includes(architecture);
            return (
              <button
                key={architecture}
                type="button"
                className="pf-choice"
                data-architecture={architecture}
                aria-pressed={chosen === architecture}
                onClick={() => onSelect(architecture)}
              >
                <span className="pf-choice-name">
                  {note.label}
                  {isRecommended ? (
                    <span className="pf-badge pf-badge-accent ml-2">Recommandé</span>
                  ) : null}
                  {chosen === architecture ? <span className="pf-badge ml-2">Choisie</span> : null}
                </span>
                <span className="pf-choice-note">{note.note}</span>
                <span className="pf-choice-note">
                  Complexité : {note.complexity} · Coût d’exploitation : {note.cost}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {guided && !expanded ? (
        <button
          type="button"
          className="pf-btn pf-btn-ghost mt-3"
          onClick={() => setExpanded(true)}
        >
          Voir toutes les options ({ARCHITECTURES.length - recommended.length})
        </button>
      ) : null}

      <p className="pf-hint mt-4">
        {chosen === undefined
          ? 'Aucune architecture choisie pour l’instant.'
          : `${ARCHITECTURE_NOTES[chosen].label} — complexité ${ARCHITECTURE_NOTES[chosen].complexity}, coût ${ARCHITECTURE_NOTES[chosen].cost}`}
      </p>
    </>
  );
}

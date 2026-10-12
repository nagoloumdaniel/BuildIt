'use client';

import { ARCHITECTURES, type Architecture } from '@buildit/manifest';
import { type ReactElement, useState } from 'react';
import { DisclosureButton } from '../../../components/ui/disclosure-button';
import type { DraftState } from '../../../lib/draft';
import { useMessages } from '../../../lib/i18n/provider';
import { isProjectType, type ProjectType } from '../type/profiles';

/**
 * Écran 4 — **Architecture Builder** (§6.5) : la forme du projet, avec sa
 * description courte **et son impact** (complexité, coût d'exploitation).
 *
 * Module co-localisé, pas `page.tsx` : Next refuse tout export autre que
 * `default` dans un écran (validateur engendré). Même convention que les autres
 * écrans (`capabilities.ts`, `summary.ts`).
 *
 * Les valeurs viennent de `ARCHITECTURES` du manifest — jamais recopiées. Les
 * phrases d'impact vivent au dictionnaire (`wizard.architecture.labels`), où
 * chaque forme est une clé : ajouter une architecture au manifest sans lui
 * écrire sa phrase casse la compilation au point d'usage. Même garde-fou que
 * l'écran cible.
 *
 * `architecture`, lui, **part dans le manifest** (contrairement à `type`) : le
 * schéma du §10 le déclare obligatoire.
 */

/**
 * Les architectures recommandées pour chaque profil du §6.4.
 *
 * `Record<ProjectType, …>` : ajouter un profil à l'écran 3 casse la compilation
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

/**
 * La forme à préremplir quand aucune n'est encore choisie.
 *
 * La première de `recommendedArchitectures` — jamais une valeur à part : une
 * seconde table dirait un jour autre chose que les badges « Recommandé » de
 * l'écran, et personne ne saurait laquelle croire. `BY_TYPE` l'ordonne déjà de
 * la plus courante à la plus spécialisée pour le profil ; c'est ce même ordre
 * qui décide, ici comme à l'écran.
 */
export function defaultArchitecture(type: string | undefined): Architecture {
  const [first] = recommendedArchitectures(type);
  // `recommendedArchitectures` ne rend jamais un tableau vide (`FALLBACK` en
  // a trois) : `first` est toujours défini, `as const` ne le dit pas à `tsc`.
  return first as Architecture;
}

/** Le changement de brouillon d'une sélection — testable hors React. */
export function withArchitecture(draft: DraftState, architecture: Architecture): DraftState {
  return { ...draft, architecture };
}

export interface ArchitectureChoicesProps {
  readonly mode: 'guided' | 'expert';
  readonly selected: string | undefined;
  /** Le profil choisi à l'écran 3 — il décide des recommandations. */
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
  const t = useMessages();
  const [expanded, setExpanded] = useState(false);
  const guided = mode === 'guided';
  const recommended = recommendedArchitectures(type);
  const ordered = [
    ...recommended,
    ...ARCHITECTURES.filter((architecture) => !recommended.includes(architecture)),
  ];
  const visible = guided && !expanded ? recommended : ordered;
  const chosen = ARCHITECTURES.find((architecture) => architecture === selected);
  const labels = t.wizard.architecture.labels;

  return (
    <>
      {guided ? (
        <p className="pf-hint mb-2">
          {isProjectType(type)
            ? t.wizard.architecture.recommendedFor(t.wizard.types.labels[type].label)
            : t.wizard.architecture.recommendedDefault}
        </p>
      ) : null}

      <fieldset>
        <legend className="pf-label">{t.wizard.architecture.legend}</legend>
        <div className="pf-grid">
          {visible.map((architecture) => {
            const note = labels[architecture];
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
                    <span className="pf-badge pf-badge-accent">
                      {t.wizard.architecture.recommendedBadge}
                    </span>
                  ) : null}
                </span>
                <span className="pf-choice-note">{note.note}</span>
                <span className="pf-choice-note">
                  {t.wizard.architecture.impact(note.complexity, note.cost)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {guided ? (
        <DisclosureButton
          className="mt-3"
          expanded={expanded}
          lessLabel={t.wizard.stack.showRecommended}
          moreLabel={t.wizard.architecture.showAll(ARCHITECTURES.length - recommended.length)}
          onToggle={() => setExpanded((value) => !value)}
        />
      ) : null}

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

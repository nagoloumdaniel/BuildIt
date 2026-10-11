'use client';

import { type ReactElement, useState } from 'react';
import type { DraftState } from '../../../lib/draft';

/**
 * Écran 4 — **Project Type** (§6.4) : le profil du produit.
 *
 * Le contenu vit ici, pas dans `page.tsx`, pour une raison de build : Next
 * engendre un fichier de types par écran, qui refuse tout export autre que
 * `default` et les champs de configuration (« Type ... does not satisfy the
 * constraint '{ [x: string]: never; }' »). Un écran qui exporte ses données
 * casse donc `next build`. Le module co-localisé est aussi ce que font les
 * autres écrans (`capabilities.ts`, `summary.ts`, `relations.ts`).
 *
 * Décision écrite : `type` est une donnée **d'UI**, il n'est pas dans le
 * manifest. Vérifié sur `packages/manifest` : le schéma du §10 est strict et
 * n'a pas de clé `type` ; il n'a qu'un seul champ libre (`name`). Le brouillon
 * le porte (`DraftState.type`) et il **guide les recommandations** des écrans
 * suivants — un profil n'est pas une contrainte du moteur, c'est une intention.
 *
 * Comme l'écran cible, la table des profils est **complète** : ajouter un
 * profil au catalogue casse la compilation ici et force à écrire sa phrase.
 * C'est une décision produit, pas un détail.
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

export interface TypeNote {
  readonly label: string;
  readonly note: string;
  /** Ce que ce profil fait recommander aux écrans suivants (§5, §6). */
  readonly guides: string;
}

export const TYPE_NOTES: Readonly<Record<ProjectType, TypeNote>> = {
  saas: {
    label: 'SaaS',
    note: 'Un abonnement, des comptes clients, une facturation récurrente.',
    guides:
      'Oriente vers une authentification, une base relationnelle et un paiement par abonnement.',
  },
  marketplace: {
    label: 'Marketplace',
    note: 'Des vendeurs, des acheteurs, des transactions entre eux.',
    guides: 'Oriente vers plusieurs applications séparées et un stockage de fichiers.',
  },
  ecommerce: {
    label: 'E-commerce',
    note: 'Un catalogue, un panier, des commandes.',
    guides: 'Oriente vers un catalogue, un paiement, le suivi des commandes et l’envoi d’e-mails.',
  },
  dashboard: {
    label: 'Dashboard',
    note: 'Des indicateurs et des tableaux de données à consulter.',
    guides: 'Oriente vers des graphiques, des tableaux triables et un accès protégé.',
  },
  blog: {
    label: 'Blog',
    note: 'Des articles, des pages publiques, une bonne visibilité.',
    guides: 'Oriente vers un contenu éditorial, un référencement soigné et un rendu statique.',
  },
  ai: {
    label: 'IA',
    note: 'Un produit dont le cœur est un modèle de langage.',
    guides: 'Oriente vers des appels de modèle, une recherche vectorielle et un suivi d’usage.',
  },
  api: {
    label: 'API',
    note: 'Un service partagé, sans interface à livrer.',
    guides:
      'Oriente vers une spécification ouverte, une validation stricte et un déploiement conteneurisé.',
  },
  business: {
    label: 'Application métier',
    note: 'Des processus internes, des rôles, des règles maison.',
    guides: 'Oriente vers des rôles et permissions, des formulaires validés et un journal d’audit.',
  },
};

/**
 * Les profils recommandés d'après les plateformes déjà choisies à l'écran 3.
 *
 * Deux à quatre, jamais zéro, jamais tout le catalogue : c'est le mécanisme du
 * §5. Les autres ne disparaissent pas, ils passent derrière « Voir toutes les
 * options ». La fonction est pure et déterministe — elle se teste sans DOM.
 */
export function recommendedTypes(targets: readonly string[]): readonly ProjectType[] {
  if (targets.includes('api') || targets.includes('library')) {
    return ['api', 'ai', 'business'];
  }
  if (targets.includes('mobile') || targets.includes('desktop')) {
    return ['marketplace', 'saas', 'dashboard'];
  }
  return ['saas', 'ecommerce', 'blog'];
}

export function isProjectType(value: string | undefined): value is ProjectType {
  return value !== undefined && (PROJECT_TYPES as readonly string[]).includes(value);
}

/** Le changement de brouillon d'une sélection — testable hors React. */
export function withType(draft: DraftState, type: ProjectType): DraftState {
  return { ...draft, type };
}

export interface ProjectTypeChoicesProps {
  readonly mode: 'guided' | 'expert';
  readonly selected: string | undefined;
  readonly targets: readonly string[];
  readonly onSelect: (type: ProjectType) => void;
}

/** Le contenu de l'écran, hors contexte React — donc testable au rendu serveur. */
export function ProjectTypeChoices({
  mode,
  selected,
  targets,
  onSelect,
}: ProjectTypeChoicesProps): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const guided = mode === 'guided';
  const recommended = recommendedTypes(targets);
  // Les recommandés d'abord dans les deux modes : ordonner n'est pas masquer.
  const ordered = [...recommended, ...PROJECT_TYPES.filter((type) => !recommended.includes(type))];
  const visible = guided && !expanded ? recommended : ordered;
  const chosen = isProjectType(selected) ? selected : undefined;

  return (
    <>
      {guided ? (
        <p className="pf-hint mb-2">
          {targets.length === 0
            ? 'Recommandations par défaut : aucune plateforme n’est encore choisie.'
            : `Recommandations pour vos plateformes : ${targets.join(', ')}.`}
        </p>
      ) : null}

      <fieldset>
        <legend className="pf-label">Profils disponibles</legend>
        <div className="pf-grid">
          {visible.map((type) => {
            const note = TYPE_NOTES[type];
            const isRecommended = guided && recommended.includes(type);
            return (
              <button
                key={type}
                type="button"
                className="pf-choice"
                data-type={type}
                aria-pressed={chosen === type}
                onClick={() => onSelect(type)}
              >
                <span className="pf-choice-name">
                  {note.label}
                  {isRecommended ? (
                    <span className="pf-badge pf-badge-accent ml-2">Recommandé</span>
                  ) : null}
                  {chosen === type ? <span className="pf-badge ml-2">Choisi</span> : null}
                </span>
                <span className="pf-choice-note">{note.note}</span>
                <span className="pf-choice-note">{note.guides}</span>
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
          Voir toutes les options ({PROJECT_TYPES.length - recommended.length})
        </button>
      ) : null}

      <p className="pf-hint mt-4">
        {chosen === undefined
          ? 'Aucun profil choisi pour l’instant.'
          : `${TYPE_NOTES[chosen].label} : ${TYPE_NOTES[chosen].guides}`}
      </p>
    </>
  );
}

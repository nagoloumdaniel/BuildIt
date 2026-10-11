'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { useDraft, useSession } from '../components/wizard/draft-provider';
import { ScreenShell } from '../components/wizard/shell';
import type { DraftState } from '../lib/draft';
import { STEP_ORDER, type StepId } from '../lib/flow';
import { SharedLink } from './shared-link';

/**
 * Écran 1 — Dashboard (§6.1, §18bis).
 *
 * Le menu d'accueil à trois chemins (créer / cloner / ouvrir un projet local)
 * est la partie haute de l'écran. En dessous : ce que le brouillon retient — et
 * notamment l'étape quittée, pour reprendre là où on s'est arrêté (§3).
 *
 * Aucune valeur sensible n'est affichée : le brouillon ne peut pas en porter
 * (§24), et cette vue ne lit que `useDraft()`.
 *
 * Le composant n'est **pas** exporté : un `page.tsx` Next ne peut exporter que
 * `default` (le type engendré par Next le vérifie), et `page.test.ts` monte la
 * page en simulant le brouillon.
 */

const PATHS = [
  {
    href: '/create',
    label: 'Créer un projet',
    note: 'Le parcours complet : nom, plateformes, stack, blueprints, génération.',
  },
  {
    href: '/clone',
    label: 'Cloner un projet',
    note: 'Vos dépôts GitHub, ou n’importe quel lien Git. Installation proposée après.',
  },
  {
    href: '/open',
    label: 'Ouvrir un projet local',
    note: 'Reconnaître un projet déjà sur cette machine et proposer l’installation.',
  },
] as const;

/** Le nom lisible d'une étape — table complète : ajouter une étape casse ici. */
const STEP_LABELS: Readonly<Record<StepId, string>> = {
  create: 'nom du projet',
  target: 'plateformes cibles',
  type: 'type de projet',
  architecture: 'architecture',
  stack: 'stack technique',
  capabilities: 'capacités',
  env: 'environnement & secrets',
  infrastructure: 'infrastructure',
  blueprint: 'blueprint',
  preview: 'aperçu des fichiers',
  generate: 'génération',
  report: 'rapport',
};

/** L'URL d'une étape : l'étape `create` vit à `/create`, pas à `/create/create`. */
function resumeHref(step: StepId): string {
  return step === STEP_ORDER[0] ? '/create' : `/create/${step}`;
}

/**
 * Y a-t-il quelque chose à reprendre ?
 *
 * Le brouillon vide est le brouillon frais : proposer de « reprendre » une page
 * blanche ne rendrait service à personne.
 */
function hasDraft(draft: DraftState): boolean {
  return (
    draft.name !== '' ||
    draft.step !== STEP_ORDER[0] ||
    draft.targets.length > 0 ||
    draft.technologies.length > 0 ||
    draft.capabilities.length > 0
  );
}

interface DashboardViewProps {
  readonly draft: DraftState;
  readonly onReset?: (() => void) | undefined;
}

function DashboardView({ draft, onReset }: DashboardViewProps): ReactElement {
  return (
    <ScreenShell
      title="Project Factory"
      description="Décrivez un projet, obtenez un projet prêt à développer. Trois façons de commencer."
    >
      <nav className="pf-grid" aria-label="Menu d'accueil">
        {PATHS.map((path) => (
          <Link key={path.href} className="pf-choice no-underline" href={path.href}>
            <span className="pf-choice-name">{path.label}</span>
            <span className="pf-choice-note">{path.note}</span>
          </Link>
        ))}
      </nav>

      <section className="pf-card pf-card-pad mt-3">
        <p className="pf-eyebrow">Brouillon en cours</p>
        {hasDraft(draft) ? (
          <>
            <p className="mt-1">
              {draft.name === '' ? 'Projet sans nom' : draft.name}
              <span className="pf-badge pf-badge-accent ml-2">{draft.step}</span>
            </p>
            <p className="pf-hint mt-1">
              Dernier écran : {STEP_LABELS[draft.step]}. Le brouillon se reprend tout seul si vous
              fermez l’onglet.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link className="pf-btn pf-btn-primary" href={resumeHref(draft.step)}>
                Reprendre
              </Link>
              {onReset === undefined ? null : (
                <button type="button" className="pf-btn pf-btn-ghost" onClick={onReset}>
                  Repartir de zéro
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="pf-hint mt-1">
            Aucun brouillon en cours. Choisissez un chemin ci-dessus : tout est conservé au fur et à
            mesure.
          </p>
        )}
      </section>

      <nav className="pf-grid mt-3" aria-label="Compte et dépôt">
        <Link className="pf-choice no-underline" href="/github">
          <span className="pf-choice-name">Compte GitHub</span>
          <span className="pf-choice-note">
            Se connecter, voir les permissions accordées, se déconnecter.
          </span>
        </Link>
        <Link className="pf-choice no-underline" href="/repo">
          <span className="pf-choice-name">Dépôt & partage</span>
          <span className="pf-choice-note">
            Créer le dépôt GitHub d’un projet, inviter des collaborateurs.
          </span>
        </Link>
      </nav>
    </ScreenShell>
  );
}

export default function Home(): ReactElement {
  const draft = useDraft();
  const session = useSession();
  return (
    <>
      <DashboardView
        draft={draft}
        onReset={() => {
          session.reset();
        }}
      />
      {/* Hors de `DashboardView` : `SharedLink` utilise le routeur, que le
          rendu statique des tests ne monte pas. */}
      <div className="pf-shell pt-0">
        <SharedLink />
      </div>
    </>
  );
}

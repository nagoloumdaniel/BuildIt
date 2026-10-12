import Link from 'next/link';
import type { ReactElement } from 'react';
import type { DraftState } from '../lib/draft';
import { STEP_ORDER, type StepId } from '../lib/flow';
import type { GenerationReport } from './create/report/result';

/**
 * Le contenu de l'écran 1 — Dashboard (§6.1, §18bis), hors `page.tsx`.
 *
 * Next interdit tout export autre que `default` dans un `page.tsx` (validateur
 * engendré, `.next/types`) : les données et le composant testable vivent ici,
 * `page.tsx` ne fait que câbler `useDraft()`/`useSession()` et le chargement du
 * rapport (`sessionStorage`, non disponible au rendu statique des tests).
 */

export const PATHS = [
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

/**
 * Le brouillon a-t-il produit un projet **terminé** ?
 *
 * Un projet généré avec succès n'est plus un brouillon à reprendre (§6.14) :
 * il rejoint « Projets créés », avec ses propres gestes (GitHub, doc
 * d'installation, téléchargement), jamais « Reprendre » ni « Repartir de
 * zéro ». Le rapport vit en `sessionStorage` (décision volontaire : il ne
 * survit pas à la fermeture de l'onglet) ; s'il a disparu — onglet rouvert —
 * le dernier écran dit déjà « rapport » et le lien vers lui suffit.
 */
function isCompletedProject(draft: DraftState, report: GenerationReport | null): boolean {
  return draft.step === 'report' && report !== null && report.ok;
}

export interface DashboardViewProps {
  readonly draft: DraftState;
  readonly report?: GenerationReport | null;
  readonly onReset?: (() => void) | undefined;
  readonly onRedownload?: (() => void) | undefined;
}

export function DashboardView({
  draft,
  report = null,
  onReset,
  onRedownload,
}: DashboardViewProps): ReactElement {
  const completed = isCompletedProject(draft, report);
  const draftOnly = !completed && hasDraft(draft);
  return (
    <>
      <nav className="pf-grid" aria-label="Menu d'accueil">
        {PATHS.map((path) => (
          <Link key={path.href} className="pf-choice no-underline" href={path.href}>
            <span className="pf-choice-name">{path.label}</span>
            <span className="pf-choice-note">{path.note}</span>
          </Link>
        ))}
      </nav>

      {completed ? (
        <section className="pf-card pf-card-pad mt-3">
          <p className="pf-eyebrow">Projets créés</p>
          <p className="mt-1">
            {draft.name === '' ? 'Projet sans nom' : draft.name}
            <span className="pf-badge pf-badge-ok ml-2">Terminé</span>
          </p>
          <p className="pf-hint mt-1">
            Ce projet est généré : il ne se modifie plus depuis BuildIt. Connectez-le à GitHub,
            consultez sa documentation d’installation, ou téléchargez-le à nouveau.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link className="pf-btn" href="/repo">
              Connecter à GitHub
            </Link>
            <Link className="pf-btn" href="/create/report">
              Voir le rapport & la doc d’installation
            </Link>
            {onRedownload === undefined ? null : (
              <button type="button" className="pf-btn pf-btn-ghost" onClick={onRedownload}>
                Télécharger à nouveau
              </button>
            )}
          </div>
        </section>
      ) : null}

      <section className="pf-card pf-card-pad mt-3">
        <p className="pf-eyebrow">Brouillon en cours</p>
        {draftOnly ? (
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
            {completed
              ? 'Rien à reprendre : le projet ci-dessus est terminé. Choisissez un chemin ci-dessus pour en démarrer un autre.'
              : 'Aucun brouillon en cours. Choisissez un chemin ci-dessus : tout est conservé au fur et à mesure.'}
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
    </>
  );
}

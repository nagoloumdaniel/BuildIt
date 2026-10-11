'use client';

import Link from 'next/link';
import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';
import {
  blockedReason,
  nextStep,
  previousStep,
  STEP_ORDER,
  type StepId,
  stepIndex,
} from '../../lib/flow';
import { useDraft, useSession } from './draft-provider';

/**
 * L'URL d'une étape : un écran, une adresse (le bouton Précédent du navigateur
 * marche).
 *
 * Le premier écran est `/create` et non `/create/create` : c'est l'entrée du
 * parcours, et une adresse qui se répète serait un piège à liens morts.
 */
export function stepHref(step: StepId): string {
  return step === 'create' ? '/create' : `/create/${step}`;
}

/**
 * La progression du parcours.
 *
 * Non cliquable à dessein : sauter une étape contournerait les conditions
 * bloquantes du §6. On peut toujours revenir en arrière — jamais sauter en
 * avant sans être passé.
 */
export function Progress({ current }: { current: StepId }): ReactElement {
  const index = stepIndex(current);
  return (
    <ol
      className="flex flex-wrap items-center gap-x-2 gap-y-1"
      aria-label="Progression du parcours"
    >
      {STEP_ORDER.map((step, position) => (
        <li
          key={step}
          className={position === index ? 'pf-eyebrow text-accent' : 'pf-eyebrow'}
          {...(position === index ? { 'aria-current': 'step' as const } : {})}
        >
          {position + 1}. {step}
        </li>
      ))}
    </ol>
  );
}

/**
 * L'**adresse demandée** au chargement du document, lue quand ce module est
 * évalué (donc à l'hydratation).
 *
 * Elle distingue les deux façons d'arriver sur un écran :
 *
 * - **accès direct** à l'adresse (`window.location.href` est inchangée) : le
 *   focus reste où le navigateur l'a mis — le déplacer serait intrusif et
 *   ferait sauter le lien d'évitement et la bascule de thème du premier Tab ;
 * - **navigation dans le parcours** (l'adresse a changé) : le routeur de Next
 *   retire l'élément qui portait le focus (« Continuer »), et sans transfert il
 *   retombe sur `<body>` — l'utilisateur au clavier devrait alors retraverser
 *   tout l'en-tête à chaque étape, et rien n'annonce l'écran suivant.
 */
const requestedUrl = typeof window === 'undefined' ? null : window.location.href;

export interface StepShellProps {
  readonly step: StepId;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}

/**
 * Le cadre d'une étape : progression, titre, contenu, navigation.
 *
 * Le bouton « Continuer » désactivé **dit pourquoi** juste à côté (§12) : un
 * bouton grisé sans explication est un cul-de-sac.
 */
export function StepShell({ step, title, description, children }: StepShellProps): ReactElement {
  const draft = useDraft();
  const session = useSession();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const focusHandled = useRef(false);
  const previous = previousStep(step);
  const next = nextStep(step);
  // La condition évaluée est celle de l'étape **affichée**, jamais celle que le
  // brouillon portait avant qu'on arrive ici.
  const reason = blockedReason({ ...draft, step });
  const ready = reason === undefined;

  // Le focus ne se rattrape pas après coup (8F.1) : il est posé ici, à l'entrée
  // de l'écran. La `ref` garde le premier passage d'un montage unique — le mode
  // strict de React rejoue les effets en développement et ne doit pas
  // transformer ce montage en « navigation ».
  useEffect(() => {
    if (focusHandled.current) {
      return;
    }
    focusHandled.current = true;
    if (requestedUrl === window.location.href) {
      return;
    }
    titleRef.current?.focus();
  }, []);

  // La reprise (§3) repart de l'écran quitté : le brouillon retient l'étape.
  useEffect(() => {
    if (draft.step !== step) {
      session.update((current) => ({ ...current, step }));
    }
  }, [draft.step, step, session]);

  return (
    <main className="pf-shell">
      <Progress current={step} />
      <section className="pf-card pf-card-pad mt-3 pf-fade-in">
        <p className="pf-eyebrow">
          Étape {stepIndex(step) + 1} sur {STEP_ORDER.length}
        </p>
        {/* `tabIndex={-1}` : le titre est une cible de focus programmée (entrée
            dans l'étape), jamais un arrêt de tabulation de plus. */}
        <h1 className="pf-title" tabIndex={-1} ref={titleRef}>
          {title}
        </h1>
        <p className="pf-subtitle">{description}</p>
        <div className="mt-5">{children}</div>
      </section>

      <nav
        className="mt-3 flex items-center justify-between gap-3"
        aria-label="Navigation de l’étape"
      >
        {previous === null ? (
          <Link className="pf-btn" href="/">
            Accueil
          </Link>
        ) : (
          <Link className="pf-btn" href={stepHref(previous)}>
            Précédent
          </Link>
        )}

        {next === null ? null : (
          <span className="flex items-center gap-3">
            {ready ? null : (
              <span className="pf-error" role="status">
                {reason}
              </span>
            )}
            <Link
              className={
                ready
                  ? 'pf-btn pf-btn-primary'
                  : 'pf-btn pf-btn-primary pointer-events-none opacity-50'
              }
              href={stepHref(next)}
              aria-disabled={!ready}
              tabIndex={ready ? 0 : -1}
            >
              Continuer
            </Link>
          </span>
        )}
      </nav>
    </main>
  );
}

export interface ScreenShellProps {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  /** Les actions de l'écran, à droite du titre. */
  readonly actions?: ReactNode;
}

/** Le cadre des écrans hors parcours : accueil, GitHub, graphe, aperçu. */
export function ScreenShell({
  title,
  description,
  children,
  actions,
}: ScreenShellProps): ReactElement {
  return (
    <main className="pf-shell">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="pf-title">{title}</h1>
          {description === undefined ? null : <p className="pf-subtitle">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="mt-4 pf-fade-in">{children}</div>
    </main>
  );
}

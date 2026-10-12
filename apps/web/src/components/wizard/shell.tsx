'use client';

import Link from 'next/link';
import { type ReactElement, type ReactNode, useEffect, useMemo, useRef } from 'react';
import {
  blockedReason,
  nextStep,
  previousStep,
  STEP_ORDER,
  type StepId,
  stepIndex,
} from '../../lib/flow';
import { useMessages } from '../../lib/i18n/provider';
import { Icon } from '../ui/icon';
import { Stepper } from '../ui/stepper';
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
 * Exportée séparément du cadre : certains tests la rendent seule, et l'écran
 * Report la montre une dernière fois sans son cadre de navigation.
 */
export function Progress({ current }: { current: StepId }): ReactElement {
  const t = useMessages();
  const index = stepIndex(current);
  const steps = useMemo(
    () => STEP_ORDER.map((step) => ({ id: step, label: t.steps[step], href: stepHref(step) })),
    [t],
  );
  return (
    <Stepper
      ariaLabel={t.a11y.progress}
      compactLabel={t.common.step(index + 1, STEP_ORDER.length)}
      current={index}
      steps={steps}
    />
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
  /**
   * Un projet généré avec succès est terminé : rien n'y est plus modifiable
   * (§6.14), donc aucun retour vers les écrans qui l'ont composé. Seul
   * l'écran Report pose ce drapeau, et seulement une fois la génération
   * réussie — un refus garde la navigation normale, revenir corriger un choix
   * a un sens tant que rien n'a été écrit.
   */
  readonly hidePrevious?: boolean;
  /** Les gestes propres à l'écran, à droite du titre. */
  readonly actions?: ReactNode;
}

/**
 * Le cadre d'une étape : progression, titre, contenu, navigation.
 *
 * Le bouton « Continuer » désactivé **dit pourquoi** juste à côté (§12) : un
 * bouton grisé sans explication est un cul-de-sac. La barre de navigation du
 * bas est collante sur petit écran : sur une étape longue (la stack en
 * compte deux cents), « Continuer » ne doit pas être à deux écrans de
 * défilement.
 */
export function StepShell({
  step,
  title,
  description,
  children,
  hidePrevious = false,
  actions,
}: StepShellProps): ReactElement {
  const t = useMessages();
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

      <div className="pf-fade-in mt-5">
        <header className="pf-page-head pf-card-head">
          <div className="min-w-0">
            <p className="pf-eyebrow">{t.common.step(stepIndex(step) + 1, STEP_ORDER.length)}</p>
            {/* `tabIndex={-1}` : le titre est une cible de focus programmée
                (entrée dans l'étape), jamais un arrêt de tabulation de plus. */}
            <h1 className="pf-display mt-1" ref={titleRef} tabIndex={-1}>
              {title}
            </h1>
            <p className="pf-subtitle mt-2">{description}</p>
          </div>
          {actions === undefined ? null : <div className="pf-page-head-actions">{actions}</div>}
        </header>

        <div className="mt-6">{children}</div>
      </div>

      <nav
        aria-label={t.a11y.stepNavigation}
        className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
      >
        {previous === null || hidePrevious ? (
          <Link className="pf-btn" href="/">
            <Icon name="home" />
            {t.common.backHome}
          </Link>
        ) : (
          <Link className="pf-btn" href={stepHref(previous)}>
            <Icon name="arrowLeft" />
            {t.common.previous}
          </Link>
        )}

        {next === null || hidePrevious ? null : (
          <span className="flex flex-wrap items-center justify-end gap-3">
            {ready ? null : (
              <span className="pf-error flex items-center gap-1.5" role="status">
                <Icon name="warning" size={14} />
                {reason}
              </span>
            )}
            <Link
              aria-disabled={!ready}
              className={
                ready
                  ? 'pf-btn pf-btn-primary'
                  : 'pf-btn pf-btn-primary pointer-events-none opacity-50'
              }
              href={stepHref(next)}
              tabIndex={ready ? 0 : -1}
            >
              {t.common.continue}
              <Icon name="arrowRight" />
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
  /**
   * Le retour : une adresse et son libellé. Tout écran hors parcours en a un —
   * c'est la « boucle » qui évite le cul-de-sac. Par défaut, l'accueil.
   */
  readonly back?: { readonly href: string; readonly label: string } | null;
  /** Resserre la colonne : un écran de lecture, pas une grille. */
  readonly narrow?: boolean;
}

/** Le cadre des écrans hors parcours : accueil, GitHub, graphe, aperçu. */
export function ScreenShell({
  title,
  description,
  children,
  actions,
  back,
  narrow = false,
}: ScreenShellProps): ReactElement {
  const t = useMessages();
  const target = back === undefined ? { href: '/', label: t.common.backHome } : back;

  return (
    <main className={`pf-shell${narrow ? ' pf-shell-narrow' : ''}`}>
      {target === null ? null : (
        <Link className="pf-btn pf-btn-ghost pf-btn-sm -ml-2" href={target.href}>
          <Icon name="arrowLeft" size={14} />
          {target.label}
        </Link>
      )}

      <header className={`pf-page-head pf-card-head${target === null ? '' : ' mt-3'}`}>
        <div className="min-w-0">
          <h1 className="pf-display">{title}</h1>
          {description === undefined ? null : <p className="pf-subtitle mt-2">{description}</p>}
        </div>
        {actions === undefined ? null : <div className="pf-page-head-actions">{actions}</div>}
      </header>

      <div className="pf-fade-in mt-6">{children}</div>
    </main>
  );
}

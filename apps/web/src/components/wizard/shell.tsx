'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { loadDraft } from '../../lib/draft';
import {
  blockedReason,
  nextStep,
  previousStep,
  STEP_ORDER,
  type StepId,
  stepIndex,
} from '../../lib/flow';
import { useMessages } from '../../lib/i18n/provider';
import { hasChoices } from '../../lib/journey-cancel';
import { isGenerated, type LockSource, lockedRedirect, lockSource } from '../../lib/journey-lock';
import { type SlideDirection, slideDirection, stepMemory } from '../../lib/journey-transition';
import { browserStorage } from '../../lib/theme';
import { Icon, type IconName } from '../ui/icon';
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
export function Progress({
  current,
  from,
  locked = false,
}: {
  current: StepId;
  from?: number;
  /** Projet généré : aucune étape franchie n'est plus un lien. */
  locked?: boolean;
}): ReactElement {
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
      locked={locked}
      steps={steps}
      {...(from === undefined ? {} : { from })}
    />
  );
}

/**
 * L'icône de chaque étape, à gauche de son titre.
 *
 * Le stepper ne montre plus que des numéros : c'est le titre, et l'icône qui
 * l'accompagne, qui disent où l'on est. Une table et non un choix par écran :
 * douze écrans qui choisissent chacun finiraient par se répéter.
 */
export const STEP_ICONS: Readonly<Record<StepId, IconName>> = {
  create: 'pencil',
  target: 'globe',
  type: 'grid',
  architecture: 'gitBranch',
  stack: 'layers',
  capabilities: 'zap',
  env: 'key',
  infrastructure: 'cloud',
  blueprint: 'fileText',
  preview: 'folderTree',
  generate: 'hammer',
  report: 'checkCircle',
};

/**
 * Le titre d'écran et son icône.
 *
 * Une grille à deux colonnes plutôt qu'une ligne : quand le titre passe à la
 * ligne sur un téléphone, la seconde ligne repart sous la première, pas sous
 * l'icône. L'icône est décorative : le titre dit déjà tout.
 */
function PageTitle({
  icon,
  title,
  titleRef,
}: {
  icon: IconName | undefined;
  title: string;
  titleRef?: RefObject<HTMLHeadingElement | null>;
}): ReactElement {
  return (
    <div
      className={
        icon === undefined ? 'pf-journey-title pf-journey-title-plain' : 'pf-journey-title'
      }
    >
      {icon === undefined ? null : (
        // `pf-display` donne à l'icône la taille du titre : elle grandit et
        // rétrécit avec lui, sans recopier son échelle ici.
        <span className="pf-journey-title-icon pf-display">
          <Icon name={icon} size={24} />
        </span>
      )}
      {titleRef === undefined ? (
        <h1 className="pf-display">{title}</h1>
      ) : (
        // `tabIndex={-1}` : le titre est une cible de focus programmée (entrée
        // dans l'étape), jamais un arrêt de tabulation de plus.
        <h1 className="pf-display" ref={titleRef} tabIndex={-1}>
          {title}
        </h1>
      )}
    </div>
  );
}

/**
 * Comment l'écran entre : le sens du glissement, et l'étape d'où le stepper
 * repart.
 *
 * Lu **une fois**, au premier rendu : un nouveau rendu sans changement
 * d'étape (une case cochée) ne rejoue rien. Le serveur ne lit jamais la
 * mémoire : partagée entre toutes les requêtes, elle y mentirait, et un
 * accès direct doit s'afficher immobile.
 */
interface Entry {
  readonly direction: SlideDirection;
  readonly from?: number;
}

function readEntry(index: number): Entry {
  if (typeof window === 'undefined') {
    return { direction: 'none' };
  }
  const trace = stepMemory.read();
  const direction = slideDirection(trace, index, Date.now());
  return direction === 'none' || trace === null ? { direction } : { direction, from: trace.index };
}

/**
 * Le départ vers l'accueil après une annulation.
 *
 * Monté seulement au moment de partir : `useRouter` exige le routeur de Next,
 * et le cadre se rend aussi sans lui (tests, rendu statique). Le prendre dans
 * le cadre lui-même ferait tomber tout rendu hors application.
 */
function GoHome(): null {
  const router = useRouter();
  useEffect(() => {
    router.push('/');
  }, [router]);
  return null;
}

/**
 * Le renvoi hors d'une étape refermée (projet généré).
 *
 * Même raison que `GoHome` pour n'être monté qu'au besoin. `replace` et non
 * `push` : l'adresse refermée ne doit pas rester dans l'historique, sans quoi
 * le bouton Précédent du navigateur y ramènerait aussitôt, en boucle.
 *
 * La cible est recalculée ici, au moment de partir, sur le brouillon du
 * stockage s'il est généré : au chargement d'une adresse, celui en mémoire a
 * déjà perdu l'étape où le parcours s'était arrêté (voir `lockSource`).
 */
function GoLocked({ step, memory }: { step: StepId; memory: LockSource }): null {
  const router = useRouter();
  useEffect(() => {
    const target = lockedRedirect(step, lockSource(memory, loadDraft(browserStorage())));
    if (target !== null) {
      router.replace(stepHref(target));
    }
  }, [router, step, memory]);
  return null;
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
  const index = stepIndex(step);
  const [entry] = useState(() => readEntry(index));
  const previous = previousStep(step);
  const next = nextStep(step);
  // La condition évaluée est celle de l'étape **affichée**, jamais celle que le
  // brouillon portait avant qu'on arrive ici.
  const reason = blockedReason({ ...draft, step });
  const ready = reason === undefined;
  // Projet généré : plus de retour possible, ni par « Précédent », ni par
  // « Annuler », ni par le stepper. `hidePrevious` reste pour l'écran qui
  // le pose lui-même. Une étape refermée (1 à 10) n'est pas affichée du
  // tout : elle renvoie vers la fin du parcours.
  const generated = isGenerated(draft);
  const closed = lockedRedirect(step, draft) !== null;
  const noWayBack = hidePrevious || generated;

  // L'annulation : `confirming` ouvre l'encart, `leaving` monte le départ.
  // La `ref` double l'état parce que l'effet de reprise ci-dessous doit la
  // lire **tout de suite** : un état ne serait vu qu'au rendu suivant.
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const panelId = useId();

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

  // La mémoire du sens de glissement : l'écran suivant saura d'où l'on vient.
  useEffect(() => {
    stepMemory.enter(index);
    return () => stepMemory.leave(index, Date.now());
  }, [index]);

  // La reprise (§3) repart de l'écran quitté : le brouillon retient l'étape.
  // Sauf pendant un départ : le brouillon vient d'être remis à neuf, et lui
  // réécrire l'étape quittée ferait reprendre un parcours annulé.
  // Une étape refermée n'écrit rien non plus : le brouillon doit garder
  // l'étape où le parcours s'est arrêté, c'est elle qui choisit le renvoi.
  useEffect(() => {
    if (!leavingRef.current && !closed && draft.step !== step) {
      session.update((current) => ({ ...current, step }));
    }
  }, [draft.step, step, session, closed]);

  // L'encart ouvert reçoit le focus sur le geste **sûr** (garder ses choix) :
  // un Entrée de trop ne doit rien effacer. Fermé, le focus revient au bouton
  // qui l'a ouvert, pas au début de la page.
  useEffect(() => {
    if (confirming) {
      keepRef.current?.focus();
    } else if (restoreFocus.current) {
      restoreFocus.current = false;
      cancelRef.current?.focus();
    }
  }, [confirming]);

  const leave = (): void => {
    leavingRef.current = true;
    // Le prochain parcours part de rien : pas de glissement hérité de celui-ci.
    stepMemory.clear();
    session.reset();
    setLeaving(true);
  };

  const requestCancel = (): void => {
    if (confirming) {
      return;
    }
    // Un brouillon vierge n'a rien à perdre : pas de question pour rien.
    if (hasChoices(draft)) {
      setConfirming(true);
    } else {
      leave();
    }
  };

  const keepGoing = (): void => {
    restoreFocus.current = true;
    setConfirming(false);
  };

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      keepGoing();
    }
  };

  // Un projet généré n'a plus rien à annuler (§6.14). Sur petit écran, le
  // libellé visible disparaît (CSS) : l'icône seule, le nom accessible reste.
  const cancelButton = noWayBack ? null : (
    <button
      aria-controls={confirming ? panelId : undefined}
      aria-expanded={confirming}
      aria-label={t.journey.cancel.label}
      className="pf-btn pf-btn-sm pf-journey-cancel"
      onClick={requestCancel}
      ref={cancelRef}
      type="button"
    >
      <Icon name="close" size={14} />
      <span className="pf-journey-cancel-text">{t.journey.cancel.button}</span>
    </button>
  );

  // L'étape refermée ne montre rien de son contenu : pas même un instant,
  // ni les chargements qu'il lancerait. Seule une phrase dit pourquoi.
  if (closed) {
    return (
      <main aria-busy="true" className="pf-shell">
        <GoLocked memory={draft} step={step} />
        <p className="pf-journey-sr" role="status">
          {t.journey.locked}
        </p>
      </main>
    );
  }

  return (
    <main className="pf-shell">
      {leaving ? <GoHome /> : null}
      <Progress
        current={step}
        locked={generated}
        {...(entry.from === undefined ? {} : { from: entry.from })}
      />

      {/* Seul le contenu glisse : le stepper reste en place et son rail se
          remplit pendant ce temps. */}
      <div className="pf-journey-viewport mt-5">
        <div className="pf-journey-stage" data-slide={entry.direction}>
          <header className="pf-page-head">
            <p className="pf-eyebrow">{t.common.step(index + 1, STEP_ORDER.length)}</p>
            <div className="pf-journey-head mt-1">
              <PageTitle icon={STEP_ICONS[step]} title={title} titleRef={titleRef} />
              {actions === undefined && cancelButton === null ? null : (
                <div className="pf-page-head-actions">
                  {actions}
                  {cancelButton}
                </div>
              )}
            </div>
            <p className="pf-subtitle mt-2">{description}</p>
          </header>

          {confirming ? (
            <div
              aria-describedby={`${panelId}-body`}
              aria-labelledby={`${panelId}-title`}
              className="pf-journey-confirm mt-4"
              id={panelId}
              onKeyDown={onPanelKey}
              role="alertdialog"
            >
              <p className="pf-title-sm" id={`${panelId}-title`}>
                {t.journey.cancel.title}
              </p>
              <p className="pf-hint mt-1" id={`${panelId}-body`}>
                {t.journey.cancel.body}
              </p>
              <div className="pf-journey-confirm-actions mt-3">
                <button
                  className="pf-btn pf-btn-sm"
                  onClick={keepGoing}
                  ref={keepRef}
                  type="button"
                >
                  {t.journey.cancel.keep}
                </button>
                <button className="pf-btn pf-btn-danger pf-btn-sm" onClick={leave} type="button">
                  <Icon name="trash" size={14} />
                  {t.journey.cancel.confirm}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-6">{children}</div>
        </div>
      </div>

      <nav
        aria-label={t.a11y.stepNavigation}
        className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
      >
        {/* Au rapport, « Terminer » est la seule sortie : un « Accueil » à
            côté doublerait le geste sans remettre le brouillon à zéro. */}
        {step === 'report' ? (
          <span />
        ) : previous === null || noWayBack ? (
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
  /**
   * Absent : l'écran n'a pas d'en-tête du tout.
   *
   * C'est le cas de l'accueil, dont le titre répétait le nom du produit déjà
   * posé dans l'en-tête de l'application. Un titre vide aurait laissé le filet
   * et l'espacement du bloc : il n'y a donc pas de bloc.
   */
  readonly title?: string;
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
  /** L'icône du titre, rendue comme celle des étapes. */
  readonly icon?: IconName;
}

/** Le cadre des écrans hors parcours : accueil, GitHub, graphe, aperçu. */
export function ScreenShell({
  title,
  description,
  children,
  actions,
  back,
  narrow = false,
  icon,
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

      {title === undefined ? null : (
        <header className={`pf-page-head pf-card-head${target === null ? '' : ' mt-3'}`}>
          <div className="min-w-0">
            <PageTitle icon={icon} title={title} />
            {description === undefined ? null : <p className="pf-subtitle mt-2">{description}</p>}
          </div>
          {actions === undefined ? null : <div className="pf-page-head-actions">{actions}</div>}
        </header>
      )}

      <div className={`pf-fade-in${title === undefined ? '' : ' mt-6'}`}>{children}</div>
    </main>
  );
}

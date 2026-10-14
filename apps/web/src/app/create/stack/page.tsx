'use client';

import type { Category } from '@buildit/registry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon, type IconName } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { OptionCard } from '../../../components/ui/option-card';
import { StackIcon } from '../../../components/ui/stack-icon';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { useMessages } from '../../../lib/i18n/provider';
import { selectionFor } from '../../../lib/selection';
import { toggleExclusive } from '../../../lib/session';
import { checkSelectionAction } from '../../actions';
import { currentDeepLink, revealSection } from '../blueprint/deep-link';
import { loadStackBlocksAction } from './actions';
import { CategoryNav, ExpertToolbar } from './stack-options';
import {
  type CategoryBlock,
  categoryLabel,
  categoryProgress,
  compatibleAlternatives,
  filterCatalogue,
  filterOptions,
  recommendedOptions,
} from './stack-view';

/**
 * L'écran Stack Builder (§6, 5e écran ; §5 pour le progressive disclosure).
 *
 * Le chemin est celui de tous les écrans : le composant client ne connaît que
 * `actions.ts`, jamais l'adaptateur moteur (`lib/engine.ts` porte `server-only`).
 * Les options viennent de `loadStackBlocksAction`, un **seul** aller-retour pour
 * les 37 catégories (§8bis), et le moteur reste seul juge de ce qui va ensemble.
 *
 * Deux effets, deux responsabilités :
 *
 * - recharger les options dès que `targets`/`technologies` changent un choix
 *   dans une catégorie change l'état des options **partout ailleurs** ;
 * - écrire `resolution` dans le brouillon, parce que la condition bloquante de
 *   l'étape est `resolution.issues.length === 0` (`lib/flow.ts`).
 *
 * Toute la logique de §5 est dans `stack-view.ts` : ce fichier ne fait que
 * câbler le store, appeler les Server Actions et rendre. Les libellés viennent
 * tous du dictionnaire (`useMessages`) y compris les 37 catégories.
 */
export default function StackPage() {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();

  const [blocks, setBlocks] = useState<readonly CategoryBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  // Relancer la vérification du moteur sans quitter l'écran : c'est l'action de
  // récupération d'un refus de compatibilité, et elle ne touche pas la sélection.
  const [attempt, setAttempt] = useState(0);
  // L'arrivée par un crayon du plan (`/create/stack?category=orm`) : la
  // catégorie demandée, en attente du catalogue, puis le défilement jusqu'à
  // ses options. Sans paramètre, l'écran s'ouvre comme avant.
  const [requested, setRequested] = useState<string | null>(null);
  const [revealPending, setRevealPending] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // Le focus suit l'exploration : il va au bouton « Retour » à l'ouverture
  // d'une catégorie, et revient sur la catégorie quittée au retour.
  const [focusTarget, setFocusTarget] = useState<'back' | Category | null>(null);

  useEffect(() => {
    setRequested(currentDeepLink('category'));
  }, []);

  // La sélection que le moteur revalide : technologies, capacités **et** choix
  // d'infrastructure (`lib/selection.ts`). `useMemo` porte sur les pièces, pas
  // sur le brouillon : les écritures de `resolution` ne doivent pas relancer le
  // chargement.
  const selection = useMemo(
    () =>
      selectionFor({
        targets: draft.targets,
        technologies: draft.technologies,
        capabilities: draft.capabilities,
        infra: draft.infra,
      }),
    [draft.targets, draft.technologies, draft.capabilities, draft.infra],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Un seul aller-retour pour tout le catalogue. Le chargement par catégorie
    // (37 Server Actions) exécutait les mêmes appels côté serveur, mais en
    // payant 36 allers-retours de plus mesuré à ~325 ms sur le build de
    // production (rapport 8bis).
    void loadStackBlocksAction(selection).then((loaded) => {
      if (!alive) {
        return;
      }
      setBlocks(loaded);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [selection]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer la vérification après un refus, sans toucher à la sélection.
  useEffect(() => {
    let alive = true;
    void checkSelectionAction(selection).then((resolution) => {
      if (!alive) {
        return;
      }
      // `resolution` n'est jamais persistée (voir `lib/draft.ts`) : elle est
      // recalculée par le moteur, à chaque changement.
      session.update((currentDraft) => ({ ...currentDraft, resolution }));
    });
    return () => {
      alive = false;
    };
  }, [selection, session, attempt]);

  // Qui appartient à quelle catégorie, pour `toggleExclusive` (§12) reconstruit
  // à chaque rendu depuis les blocs déjà chargés, jamais depuis un second
  // aller-retour.
  const categoryOf = useMemo(() => {
    const map = new Map<string, Category>();
    for (const block of blocks) {
      for (const option of block.options) {
        map.set(option.id, block.category);
      }
    }
    return map;
  }, [blocks]);

  // Les plateformes de chaque fiche, pour la **même** règle d'exclusivité que le
  // moteur : Next.js (web) et Expo (mobile) cohabitent, Vue et Next non.
  const targetsOf = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const block of blocks) {
      for (const option of block.options) {
        map.set(option.id, option.targets ?? []);
      }
    }
    return map;
  }, [blocks]);

  function toggleTechnology(id: string, category: Category): void {
    session.update((currentDraft) => ({
      ...currentDraft,
      technologies: toggleExclusive(currentDraft.technologies, id, category, categoryOf, targetsOf),
    }));
  }

  // La catégorie demandée n'est retenue que si le catalogue la connaît : un
  // paramètre inventé ouvre l'écran comme d'habitude, sans erreur.
  useEffect(() => {
    if (requested === null || blocks.length === 0) {
      return;
    }
    const block = blocks.find((candidate) => candidate.category === requested);
    if (block !== undefined) {
      setCurrent(block.category);
      setQuery('');
      setRevealPending(true);
    }
    setRequested(null);
  }, [requested, blocks]);

  // Aucune catégorie ouverte par défaut : la liste des catégories d'abord, puis
  // un clic n'affiche plus que celle-là, avec un bouton pour revenir.
  const active = current ?? undefined;
  const activeBlock = blocks.find((block) => block.category === active);
  const activeOptions = activeBlock?.options ?? [];
  const progress = categoryProgress(activeOptions);
  // Plus de repli : la catégorie affiche tout son catalogue. Les recommandations
  // passent seulement devant, et portent l'étoile.
  const recommendedList = recommendedOptions(activeOptions);
  const recommended = new Set(recommendedList.map((option) => option.id));
  // Le filtre n'agit qu'en mode expert : en guidé, les incompatibles restent
  // visibles avec leur raison, même si la case a été cochée avant la bascule.
  const filtered = draft.mode === 'expert' && compatibleOnly;
  const expertOptions = filterOptions(activeOptions, { query: '', compatibleOnly: filtered });
  const shownOptions =
    draft.mode === 'expert'
      ? expertOptions.shown
      : [...recommendedList, ...activeOptions.filter((option) => !recommended.has(option.id))];
  const searching = query.trim() !== '';
  const results = filterCatalogue(blocks, { query, compatibleOnly: filtered });
  const labelOf = new Map<string, string>();
  for (const block of blocks) {
    for (const option of block.options) {
      labelOf.set(option.id, option.label);
    }
  }
  const chosenList = draft.technologies.map((id) => ({
    id,
    label: labelOf.get(id) ?? id,
    category: categoryOf.get(id),
  }));

  function removeTechnology(id: string): void {
    session.update((currentDraft) => ({
      ...currentDraft,
      technologies: currentDraft.technologies.filter((existing) => existing !== id),
    }));
  }
  const resolution = draft.resolution;

  useEffect(() => {
    if (focusTarget === null) {
      return;
    }
    if (focusTarget === 'back') {
      backRef.current?.focus({ preventScroll: true });
    } else {
      navRef.current
        ?.querySelector<HTMLButtonElement>(`[data-category="${focusTarget}"]`)
        ?.focus({ preventScroll: true });
    }
    setFocusTarget(null);
  }, [focusTarget]);

  // Le défilement attend que la carte de la catégorie soit rendue.
  useEffect(() => {
    if (revealPending && activeBlock !== undefined) {
      revealSection(optionsRef.current);
      setRevealPending(false);
    }
  }, [revealPending, activeBlock]);
  const modes = [
    {
      value: 'guided' as const,
      label: t.wizard.stack.modeGuided,
      note: t.wizard.stack.modeGuidedNote,
      // Guidé : on vous indique la route. Expert : vous réglez tout vous-même.
      icon: 'compass' as IconName,
    },
    {
      value: 'expert' as const,
      label: t.wizard.stack.modeExpert,
      note: t.wizard.stack.modeExpertNote,
      icon: 'sliders' as IconName,
    },
  ];

  return (
    <StepShell step="stack" title={t.wizard.stack.title} description={t.wizard.stack.description}>
      <fieldset>
        <legend className="pf-label">{t.wizard.stack.modeLegend}</legend>
        <div className="pf-grid">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className="pf-choice"
              aria-pressed={draft.mode === mode.value}
              onClick={() =>
                session.update((currentDraft) => ({ ...currentDraft, mode: mode.value }))
              }
            >
              <span className="pf-choice-name">
                <span aria-hidden="true" className="pf-option-icon">
                  <Icon name={mode.icon} size={16} />
                </span>
                {mode.label}
                {mode.value === 'guided' ? (
                  <span className="pf-option-star">
                    <Icon label={t.optionCard.recommended} name="star" size={14} />
                  </span>
                ) : null}
              </span>
              <span className="pf-choice-note">{mode.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <section className="mt-5" aria-label={t.wizard.stack.chosenTitle} aria-live="polite">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="pf-label">{t.wizard.stack.chosenTitle}</h2>
          <span className="pf-badge">{chosenList.length}</span>
          {resolution === undefined ? (
            <span className="pf-badge">{t.wizard.stack.checking}</span>
          ) : resolution.issues.length > 0 ? (
            <span className="pf-badge pf-badge-danger">
              {t.wizard.stack.issues(resolution.issues.length)}
            </span>
          ) : null}
        </div>
        {chosenList.length === 0 ? (
          <p className="pf-hint mt-1">{t.wizard.stack.chosenNone}</p>
        ) : (
          <ul className="pf-chips mt-2">
            {chosenList.map((item) => (
              <li key={item.id} className="pf-chip">
                <span aria-hidden="true" className="pf-chip-icon">
                  <StackIcon category={item.category} id={item.id} label={item.label} size={14} />
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
                <button
                  type="button"
                  className="pf-chip-remove"
                  aria-label={t.wizard.stack.removeChosen(item.label)}
                  title={t.wizard.stack.removeChosen(item.label)}
                  onClick={() => removeTechnology(item.id)}
                >
                  <Icon name="close" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolution === undefined || resolution.issues.length === 0 ? null : (
        <ErrorState
          className="mt-3"
          title={t.wizard.stack.issuesTitle}
          body={t.wizard.stack.issuesBody}
          issues={resolution.issues}
          actions={
            <button
              type="button"
              className="pf-btn"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <Icon name="refresh" />
              {t.common.retry}
            </button>
          }
        />
      )}

      <ExpertToolbar
        query={query}
        onQueryChange={setQuery}
        compatibleOnly={compatibleOnly}
        onCompatibleOnlyChange={setCompatibleOnly}
        showCompatibleOnly={draft.mode === 'expert'}
      />

      {loading ? <LoadingLine className="mt-4">{t.wizard.stack.loading}</LoadingLine> : null}
      {!loading && blocks.length === 0 ? (
        <EmptyState className="mt-4" icon="search" title={t.wizard.stack.emptyCatalogue} />
      ) : null}

      {searching ? (
        <section className="mt-4" aria-label={t.wizard.stack.resultsLabel}>
          <p className="pf-eyebrow">{t.wizard.stack.resultsFor(query.trim())}</p>
          {results.blocks.length === 0 ? (
            <p className="pf-hint mt-2">{t.wizard.stack.noMatch}</p>
          ) : null}
          {results.blocks.map((block) => (
            <div key={block.category} className="mt-4">
              <p className="pf-label flex items-center gap-2">
                {categoryLabel(t, block.category)}
                <span className="pf-badge">{block.options.length}</span>
              </p>
              <div className="pf-grid-4 mt-2">
                {block.options.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    pressed={draft.technologies.includes(option.id)}
                    alternatives={
                      option.state === 'blocked'
                        ? compatibleAlternatives(block.options, option.id)
                        : []
                    }
                    onToggle={(id) => toggleTechnology(id, block.category)}
                  />
                ))}
              </div>
            </div>
          ))}
          {results.hiddenBlocked > 0 ? (
            <p className="pf-hint mt-2">{t.wizard.stack.hiddenByFilter(results.hiddenBlocked)}</p>
          ) : null}
        </section>
      ) : (
        <section className="mt-4">
          {blocks.length === 0 || activeBlock !== undefined ? null : (
            <CategoryNav
              ref={navRef}
              blocks={blocks}
              current={active}
              onSelect={(category) => {
                setFocusTarget('back');
                setCurrent(category);
              }}
            />
          )}

          {activeBlock === undefined ? null : (
            <div ref={optionsRef} className="pf-deep-target">
              <button
                type="button"
                ref={backRef}
                className="pf-btn pf-btn-ghost pf-btn-sm"
                onClick={() => {
                  setFocusTarget(activeBlock.category);
                  setCurrent(null);
                }}
              >
                <Icon name="arrowLeft" size={14} />
                {t.wizard.stack.back}
              </button>
              <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="pf-label">{categoryLabel(t, activeBlock.category)}</h2>
                  <p className="pf-hint">
                    {draft.mode === 'expert'
                      ? t.wizard.stack.expertNote
                      : t.wizard.stack.guidedNote}
                  </p>
                </div>
                <span className="pf-badge">
                  {progress.selected}/{progress.total}
                </span>
              </header>

              <div className="pf-grid-4 mt-3">
                {shownOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    pressed={draft.technologies.includes(option.id)}
                    alternatives={
                      option.state === 'blocked'
                        ? compatibleAlternatives(activeOptions, option.id)
                        : []
                    }
                    recommended={
                      // L'étoile marque la recommandation partout : c'est ce que
                      // dit la légende affichée à côté du mode guidé.
                      draft.mode === 'guided' &&
                      option.state === 'available' &&
                      recommended.has(option.id)
                    }
                    onToggle={(id) => toggleTechnology(id, activeBlock.category)}
                  />
                ))}
              </div>

              {draft.mode === 'expert' && expertOptions.hiddenBlocked > 0 ? (
                <p className="pf-hint mt-3">
                  {t.wizard.stack.hiddenByFilter(expertOptions.hiddenBlocked)}
                </p>
              ) : null}
            </div>
          )}
        </section>
      )}
    </StepShell>
  );
}

'use client';

import type { Category } from '@buildit/registry';
import { useEffect, useMemo, useState } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { toggle, toggleExclusive } from '../../../lib/session';
import { checkSelectionAction } from '../../actions';
import { loadStackBlocksAction } from './actions';
import { CategoryNav, ExpertToolbar, OptionButton } from './stack-options';
import {
  type CategoryBlock,
  categoryLabel,
  categoryProgress,
  defaultCategory,
  filterCatalogue,
  filterOptions,
  guidedView,
  selectedCount,
} from './stack-view';

/**
 * L'écran Stack Builder (§6, 6e écran ; §5 pour le progressive disclosure).
 *
 * Le chemin est celui de tous les écrans : le composant client ne connaît que
 * `actions.ts`, jamais l'adaptateur moteur (`lib/engine.ts` porte `server-only`).
 * Les options viennent de `loadStackBlocksAction`, un **seul** aller-retour pour
 * les 37 catégories (§8bis), et le moteur reste seul juge de ce qui va ensemble.
 *
 * Deux effets, deux responsabilités :
 *
 * - recharger les options dès que `targets`/`technologies` changent — un choix
 *   dans une catégorie change l'état des options **partout ailleurs** ;
 * - écrire `resolution` dans le brouillon, parce que la condition bloquante de
 *   l'étape est `resolution.issues.length === 0` (`lib/flow.ts`).
 *
 * Toute la logique de §5 est dans `stack-view.ts` : ce fichier ne fait que
 * câbler le store, appeler les Server Actions et rendre.
 */

/** Les deux modes du §5 — même vocabulaire que l'écran « Créer un projet ». */
const MODES = [
  {
    value: 'guided',
    label: 'Guidé',
    note: 'Deux à quatre choix recommandés par catégorie, le reste à portée d’un clic.',
  },
  {
    value: 'expert',
    label: 'Expert',
    note: 'Tout le catalogue, recherche globale et filtre de compatibilité.',
  },
] as const;

/** « 1 option » / « 3 options » — l'écran ne dit jamais « 1 options ». */
function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`;
}

export default function StackPage() {
  const draft = useDraft();
  const session = useSession();

  const [blocks, setBlocks] = useState<readonly CategoryBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<readonly string[]>([]);
  const [query, setQuery] = useState('');
  const [compatibleOnly, setCompatibleOnly] = useState(false);

  // Le brouillon ne porte que `targets` et `technologies` : c'est la sélection
  // que le moteur revalide. `useMemo` sur les deux tableaux garde la référence
  // stable à travers les écritures de `resolution`, qui ne doivent pas
  // relancer les chargements.
  const selection = useMemo(
    () => ({ targets: draft.targets, technologies: draft.technologies }),
    [draft.targets, draft.technologies],
  );

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // Un seul aller-retour pour tout le catalogue. Le chargement par catégorie
    // (37 Server Actions) exécutait les mêmes appels côté serveur, mais en
    // payant 36 allers-retours de plus — mesuré à ~325 ms sur le build de
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
  }, [selection, session]);

  // Qui appartient à quelle catégorie, pour `toggleExclusive` (§12) — reconstruit
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

  function toggleTechnology(id: string, category: Category): void {
    session.update((currentDraft) => ({
      ...currentDraft,
      technologies: toggleExclusive(currentDraft.technologies, id, category, categoryOf),
    }));
  }

  const active = current ?? defaultCategory(blocks);
  const activeBlock = blocks.find((block) => block.category === active);
  const activeOptions = activeBlock?.options ?? [];
  const progress = categoryProgress(activeOptions);
  const guided = guidedView(activeOptions);
  const expandedHere = active !== undefined && expanded.includes(active);
  // Le filtre n'agit qu'en mode expert : en guidé, les incompatibles restent
  // visibles avec leur raison, même si la case a été cochée avant la bascule.
  const filtered = draft.mode === 'expert' && compatibleOnly;
  const expertOptions = filterOptions(activeOptions, { query: '', compatibleOnly: filtered });
  const shownOptions =
    draft.mode === 'expert'
      ? expertOptions.shown
      : expandedHere
        ? activeOptions
        : [...guided.recommended, ...guided.blocked];
  const recommended = new Set(guided.recommended.map((option) => option.id));
  const searching = query.trim() !== '';
  const results = filterCatalogue(blocks, { query, compatibleOnly: filtered });
  const chosen = selectedCount(blocks);
  const resolution = draft.resolution;

  return (
    <StepShell
      step="stack"
      title="Stack Builder"
      description="Choisissez vos technologies par catégorie. La compatibilité est revérifiée à chaque changement, et ce qui bloque est expliqué."
    >
      <fieldset>
        <legend className="pf-label">Mode de configuration</legend>
        <div className="pf-grid">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className="pf-choice"
              aria-pressed={draft.mode === mode.value}
              onClick={() =>
                session.update((currentDraft) => ({ ...currentDraft, mode: mode.value }))
              }
            >
              <span className="pf-choice-name">{mode.label}</span>
              <span className="pf-choice-note">{mode.note}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {resolution === undefined ? (
          <span className="pf-badge">Compatibilité en cours</span>
        ) : resolution.issues.length === 0 ? (
          <span className="pf-badge pf-badge-ok">
            {resolution.status === 'certified'
              ? 'Combinaison certifiée'
              : 'Combinaison expérimentale'}
          </span>
        ) : (
          <span className="pf-badge pf-badge-danger">
            {countLabel(resolution.issues.length, 'point à corriger', 'points à corriger')}
          </span>
        )}
        <span className="pf-hint">
          {chosen === 0
            ? 'Aucune technologie choisie : le mode guidé propose les plus courantes.'
            : countLabel(chosen, 'technologie choisie', 'technologies choisies')}
        </span>
      </div>

      {resolution === undefined || resolution.issues.length === 0 ? null : (
        <ul className="mt-2" aria-label="Ce qui empêche de continuer">
          {resolution.issues.map((issue) => (
            <li key={issue} className="pf-error">
              {issue}
            </li>
          ))}
        </ul>
      )}

      <ExpertToolbar
        query={query}
        onQueryChange={setQuery}
        compatibleOnly={compatibleOnly}
        onCompatibleOnlyChange={setCompatibleOnly}
        showCompatibleOnly={draft.mode === 'expert'}
      />

      {loading ? <p className="pf-hint mt-4">Chargement du catalogue…</p> : null}
      {!loading && blocks.length === 0 ? (
        <p className="pf-hint mt-4">
          Le catalogue ne contient aucune fiche exploitable : il n’y a rien à choisir pour
          l’instant.
        </p>
      ) : null}

      {searching ? (
        <section className="mt-4" aria-label="Résultats de recherche">
          <p className="pf-eyebrow">Résultats pour « {query.trim()} »</p>
          {results.blocks.length === 0 ? (
            <p className="pf-hint mt-2">Aucune technologie ne correspond à cette recherche.</p>
          ) : null}
          {results.blocks.map((block) => (
            <div key={block.category} className="pf-card pf-card-pad mt-3">
              <p className="pf-label">
                {categoryLabel(block.category)}
                <span className="pf-badge ml-2">{block.options.length}</span>
              </p>
              <div className="pf-grid mt-2">
                {block.options.map((option) => (
                  <OptionButton
                    key={option.id}
                    option={option}
                    chosenLocally={draft.technologies.includes(option.id)}
                    onToggle={(id) => toggleTechnology(id, block.category)}
                  />
                ))}
              </div>
            </div>
          ))}
          {results.hiddenBlocked > 0 ? (
            <p className="pf-hint mt-2">
              {countLabel(
                results.hiddenBlocked,
                'option incompatible masquée',
                'options incompatibles masquées',
              )}{' '}
              par le filtre « compatible seulement ».
            </p>
          ) : null}
        </section>
      ) : (
        <section className="mt-4">
          {blocks.length === 0 ? null : (
            <CategoryNav blocks={blocks} current={active} onSelect={setCurrent} />
          )}

          {activeBlock === undefined ? null : (
            <div className="pf-card pf-card-pad mt-3">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="pf-label">{categoryLabel(activeBlock.category)}</h2>
                  <p className="pf-hint">
                    {draft.mode === 'expert'
                      ? 'Tout le catalogue de cette catégorie, incompatibles comprises.'
                      : 'Les choix recommandés d’abord, puis les incompatibles expliquées.'}
                  </p>
                </div>
                <span className="pf-badge">
                  {progress.selected}/{progress.total}
                </span>
              </header>

              <div className="pf-grid mt-3">
                {shownOptions.map((option) => (
                  <OptionButton
                    key={option.id}
                    option={option}
                    chosenLocally={draft.technologies.includes(option.id)}
                    recommended={
                      draft.mode === 'guided' &&
                      !expandedHere &&
                      option.state === 'available' &&
                      recommended.has(option.id)
                    }
                    onToggle={(id) => toggleTechnology(id, activeBlock.category)}
                  />
                ))}
              </div>

              {draft.mode === 'guided' && guided.hidden.length > 0 ? (
                <button
                  type="button"
                  className="pf-btn pf-btn-ghost mt-3"
                  onClick={() => setExpanded((list) => toggle(list, activeBlock.category))}
                >
                  {expandedHere
                    ? 'Revenir aux recommandations'
                    : `Voir toutes les options (${guided.hidden.length})`}
                </button>
              ) : null}

              {draft.mode === 'expert' && expertOptions.hiddenBlocked > 0 ? (
                <p className="pf-hint mt-3">
                  {countLabel(
                    expertOptions.hiddenBlocked,
                    'option incompatible masquée',
                    'options incompatibles masquées',
                  )}{' '}
                  par le filtre « compatible seulement ».
                </p>
              ) : null}
            </div>
          )}
        </section>
      )}
    </StepShell>
  );
}

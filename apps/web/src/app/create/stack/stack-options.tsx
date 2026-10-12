'use client';

import type { Category } from '@buildit/registry';
import type { ReactElement } from 'react';
import { useMessages } from '../../../lib/i18n/provider';
import {
  type CategoryBlock,
  categoryLabel,
  categoryProgress,
  optionReason,
  type StackOption,
} from './stack-view';

/**
 * Les morceaux d'écran du Stack Builder.
 *
 * Ils ne décident rien : ils reçoivent des options déjà filtrées et rendent
 * uniquement des classes `pf-*` du design system 8A. Toute la logique du §5 est
 * dans `stack-view.ts`, où elle se teste sans DOM, et tous les libellés
 * viennent du dictionnaire de la langue courante (`useMessages`).
 *
 * Une option bloquée n'est **pas** `disabled` : un bouton désactivé sort de
 * l'ordre de tabulation, et l'utilisateur au clavier n'entendrait jamais la
 * raison du blocage. Elle reste focusable, `aria-disabled`, et la raison est
 * écrite sous le nom (§5, §12).
 */

export interface OptionButtonProps {
  readonly option: StackOption;
  /** Badge « Recommandé » du §5 — jamais posé sur une option bloquée. */
  readonly recommended?: boolean;
  /**
   * Le choix **local** du brouillon, quand il différe de l'état rendu par le
   * moteur. L'état du moteur arrive après un aller-retour serveur (c'est lui qui
   * tranche la compatibilité, §12) : sans ce drapeau, `aria-pressed` annonce
   * pendant un aller-retour le contraire de ce que l'utilisateur vient de faire —
   * un lecteur d'écran lit « non appuyé » sur un bouton qu'il vient d'appuyer.
   * Le badge « Choisi » reste indexé sur le moteur : l'assistif dit l'intention,
   * l'affichage dit l'état validé, et les deux convergent au rendu suivant.
   */
  readonly chosenLocally?: boolean;
  readonly onToggle: (id: string) => void;
}

export function OptionButton({
  option,
  recommended = false,
  chosenLocally,
  onToggle,
}: OptionButtonProps): ReactElement {
  const t = useMessages();
  const chosen = option.state === 'selected';
  const pressed = chosenLocally ?? chosen;
  const blocked = option.state === 'blocked';
  const reason = optionReason(option, t.wizard.stack.blockedFallback);

  return (
    <button
      type="button"
      className={blocked ? 'pf-choice cursor-not-allowed opacity-50' : 'pf-choice'}
      aria-pressed={pressed}
      aria-disabled={blocked}
      {...(reason === undefined ? {} : { title: reason })}
      onClick={() => {
        if (!blocked) {
          onToggle(option.id);
        }
      }}
    >
      <span className="pf-choice-name min-w-0 break-words">
        {option.label}
        {chosen ? (
          <span className="pf-badge pf-badge-accent ml-2">{t.wizard.stack.chosenBadge}</span>
        ) : null}
        {blocked ? (
          <span className="pf-badge pf-badge-danger ml-2">{t.wizard.stack.blockedBadge}</span>
        ) : null}
        {!blocked && !chosen && recommended ? (
          <span className="pf-badge ml-2">{t.wizard.stack.recommendedBadge}</span>
        ) : null}
      </span>
      {reason === undefined ? null : <span className="pf-choice-note break-words">{reason}</span>}
      <span className="pf-hint pf-mono mt-1 block break-all">{option.id}</span>
    </button>
  );
}

export interface CategoryNavProps {
  readonly blocks: readonly CategoryBlock[];
  readonly current: Category | undefined;
  readonly onSelect: (category: Category) => void;
}

/** Les catégories du catalogue, avec le nombre de choix déjà faits sur chacune. */
export function CategoryNav({ blocks, current, onSelect }: CategoryNavProps): ReactElement {
  const t = useMessages();
  return (
    <nav className="pf-card pf-card-pad mt-4" aria-label={t.wizard.stack.navLabel}>
      <p className="pf-eyebrow">{t.wizard.stack.navEyebrow}</p>
      <div className="pf-grid mt-2">
        {blocks.map((block) => {
          const progress = categoryProgress(block.options);
          const active = block.category === current;
          return (
            <button
              key={block.category}
              type="button"
              className="pf-choice"
              {...(active ? { 'aria-current': 'true' as const } : {})}
              aria-pressed={active}
              onClick={() => onSelect(block.category)}
            >
              <span className="pf-choice-name">
                {categoryLabel(t, block.category)}
                {progress.selected > 0 ? (
                  <span className="pf-badge pf-badge-accent ml-2">{progress.selected}</span>
                ) : null}
              </span>
              <span className="pf-choice-note">{t.wizard.stack.files(progress.total)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export interface ExpertToolbarProps {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly compatibleOnly: boolean;
  readonly onCompatibleOnlyChange: (value: boolean) => void;
  /** Le filtre de compatibilité n'a de sens qu'en mode expert. */
  readonly showCompatibleOnly: boolean;
}

/** La recherche globale du §5, et le filtre « compatible seulement » du mode expert. */
export function ExpertToolbar({
  query,
  onQueryChange,
  compatibleOnly,
  onCompatibleOnlyChange,
  showCompatibleOnly,
}: ExpertToolbarProps): ReactElement {
  const t = useMessages();
  return (
    <div className="mt-4">
      <label className="pf-label" htmlFor="pf-stack-search">
        {t.wizard.stack.searchLabel}
      </label>
      <input
        id="pf-stack-search"
        className="pf-input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={t.wizard.stack.searchPlaceholder}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />
      <p className="pf-hint mt-1">{t.wizard.stack.searchHint}</p>
      {showCompatibleOnly ? (
        <label className="pf-hint mt-3 flex items-center gap-2" htmlFor="pf-stack-compatible">
          <input
            id="pf-stack-compatible"
            type="checkbox"
            checked={compatibleOnly}
            onChange={(event) => onCompatibleOnlyChange(event.target.checked)}
          />
          {t.wizard.stack.compatibleOnly}
        </label>
      ) : null}
    </div>
  );
}

'use client';

import type { Category } from '@buildit/registry';
import type { ReactElement, Ref } from 'react';
import { categoryIcon } from '../../../components/ui/category-icon';
import { Icon } from '../../../components/ui/icon';
import { useMessages } from '../../../lib/i18n/provider';
import { type CategoryBlock, categoryLabel, categoryProgress } from './stack-view';

/**
 * Les morceaux d'écran du Stack Builder.
 *
 * Ils ne décident rien : ils reçoivent des options déjà filtrées et rendent
 * uniquement des classes `pf-*` du design system. Toute la logique du §5 est
 * dans `stack-view.ts`, où elle se teste sans DOM, et tous les libellés
 * viennent du dictionnaire de la langue courante (`useMessages`).
 *
 * La carte d'une option n'est plus dessinée ici : c'est `OptionCard`
 * (`components/ui/option-card.tsx`), partagée avec les capacités et
 * l'hébergement une technologie se lit de la même façon partout.
 */

export interface CategoryNavProps {
  readonly blocks: readonly CategoryBlock[];
  readonly current: Category | undefined;
  readonly onSelect: (category: Category) => void;
  readonly ref?: Ref<HTMLElement>;
}

/** Les catégories du catalogue, avec le nombre de choix déjà faits sur chacune. */
export function CategoryNav({ blocks, current, onSelect, ref }: CategoryNavProps): ReactElement {
  const t = useMessages();
  return (
    <nav ref={ref} className="mt-4" aria-label={t.wizard.stack.navLabel}>
      <p className="pf-eyebrow">{t.wizard.stack.navEyebrow}</p>
      <div className="pf-grid-3 mt-2">
        {blocks.map((block) => {
          const progress = categoryProgress(block.options);
          const active = block.category === current;
          return (
            <button
              key={block.category}
              type="button"
              className="pf-choice"
              data-category={block.category}
              {...(active ? { 'aria-current': 'true' as const } : {})}
              aria-pressed={active}
              onClick={() => onSelect(block.category)}
            >
              <span className="pf-choice-name">
                <span aria-hidden="true" className="pf-option-icon">
                  <Icon name={categoryIcon(block.category)} size={16} />
                </span>
                {categoryLabel(t, block.category)}
                {progress.selected > 0 ? (
                  <span className="pf-badge pf-badge-accent">{progress.selected}</span>
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
      <div className="pf-search mt-1">
        <span aria-hidden="true" className="pf-search-icon">
          <Icon name="search" size={16} />
        </span>
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
      </div>
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

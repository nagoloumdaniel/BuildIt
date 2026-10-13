'use client';

import type { ReactElement } from 'react';
import type { Messages } from '../../lib/i18n/messages';
import { useMessages } from '../../lib/i18n/provider';
import { Icon } from './icon';
import { InfoTip } from './info-tip';
import { hasBrand, TechIcon } from './tech-icon';

/**
 * La carte d'une technologie — **une** pour le Stack Builder et les capacités.
 *
 * Les deux écrans dessinaient chacun la leur, avec deux façons de dire « choisi »
 * et deux de dire « bloqué ». Ici :
 *
 * - **choisi** : le fond et le contour orange, plus une coche dans le coin —
 *   pas de badge « Choisi(e) » en plus, qui répétait ce que la carte disait
 *   déjà. La coche existe pour qu'une sélection ne dépende pas de la couleur
 *   seule ; `aria-pressed` le dit au lecteur d'écran ;
 * - **incompatible** : la carte est grisée, le nom passe au rouge, et une
 *   pastille `!` rouge ouvre le détail. La raison n'est plus écrite **dans** la
 *   carte : trois lignes de refus sous chaque option noyaient la grille ;
 * - **toujours** : la pastille `!` ouvre la fiche — documentation officielle,
 *   et pour un refus, les technologies en cause, la conséquence et la solution.
 *
 * La carte ne porte que le logo et le nom : l'identifiant du catalogue, qui
 * répétait le nom en dessous, n'apparaît plus — la fiche `!` dit le reste.
 *
 * Une option bloquée n'est **pas** `disabled` : elle resterait hors de l'ordre
 * de tabulation, et la personne au clavier n'atteindrait jamais l'explication.
 * Elle est `aria-disabled`, et le clic ne fait rien.
 */

export interface TechnologyLink {
  readonly id: string;
  readonly label: string;
  readonly docs?: string;
}

export interface OptionCardData {
  readonly id: string;
  readonly label: string;
  readonly category?: string;
  readonly state: 'selected' | 'available' | 'blocked';
  readonly reason?: string;
  readonly docs?: string;
  readonly code?: string;
  readonly conflicts?: readonly TechnologyLink[];
}

export interface OptionCardProps {
  readonly option: OptionCardData;
  /**
   * Le choix **local** du brouillon, quand il diffère de l'état rendu par le
   * moteur : l'état du moteur arrive après un aller-retour serveur, et sans ce
   * drapeau `aria-pressed` annoncerait le contraire du geste qu'on vient de
   * faire.
   */
  readonly pressed?: boolean;
  /** Badge « Recommandé » — jamais posé sur une option bloquée. */
  readonly recommended?: boolean;
  /** Les options compatibles de la même famille, proposées comme solution. */
  readonly alternatives?: readonly TechnologyLink[];
  readonly onToggle: (id: string) => void;
}

/** La conséquence et la solution d'un refus, dans la langue de l'écran. */
export function refusalAdvice(
  t: Messages,
  code: string | undefined,
  conflicts: readonly TechnologyLink[],
): { readonly consequence: string; readonly solution: string } {
  const advice = t.optionCard.advice;
  const names = conflicts.map((item) => item.label).join(', ');
  switch (code) {
    case 'COMPAT_ECOSYSTEM_MISMATCH':
      return { consequence: advice.ecosystem.consequence, solution: advice.ecosystem.solution };
    case 'COMPAT_EXCLUSIVE_CATEGORY':
      return {
        consequence: advice.exclusive.consequence,
        solution: advice.exclusive.solution(names),
      };
    case 'COMPAT_DECLARED_CONFLICT':
      return {
        consequence: advice.conflict.consequence,
        solution: advice.conflict.solution(names),
      };
    case 'COMPAT_TARGET_UNSUPPORTED':
      return { consequence: advice.target.consequence, solution: advice.target.solution };
    case 'COMPAT_ENGINE_UNSATISFIABLE':
      return { consequence: advice.engine.consequence, solution: advice.engine.solution };
    default:
      return { consequence: advice.other.consequence, solution: advice.other.solution };
  }
}

function DocLink({ item, label }: { item: TechnologyLink; label: string }): ReactElement | null {
  if (item.docs === undefined) {
    return null;
  }
  return (
    <a className="pf-link pf-tip-link" href={item.docs} rel="noreferrer" target="_blank">
      <Icon name="book" size={13} />
      {label}
      <Icon name="externalLink" size={12} />
    </a>
  );
}

export function OptionCard({
  option,
  pressed,
  recommended = false,
  alternatives = [],
  onToggle,
}: OptionCardProps): ReactElement {
  const t = useMessages();
  const card = t.optionCard;
  const blocked = option.state === 'blocked';
  const chosen = pressed ?? option.state === 'selected';
  const conflicts = option.conflicts ?? [];
  const advice = blocked ? refusalAdvice(t, option.code, conflicts) : undefined;

  return (
    <div className="pf-option" data-blocked={blocked ? 'true' : 'false'}>
      <button
        aria-disabled={blocked}
        aria-pressed={chosen}
        className="pf-choice pf-option-button"
        onClick={() => {
          if (!blocked) {
            onToggle(option.id);
          }
        }}
        type="button"
        {...(blocked ? { 'aria-describedby': `pf-option-${option.id}-state` } : {})}
      >
        <span className="pf-choice-name pf-option-name min-w-0 break-words">
          {hasBrand(option.id) ? (
            <span aria-hidden="true" className="pf-option-icon">
              <TechIcon id={option.id} name={option.label} size={16} />
            </span>
          ) : null}
          <span className="min-w-0">{option.label}</span>
          {!blocked && !chosen && recommended ? (
            <span className="pf-badge pf-badge-accent">{card.recommended}</span>
          ) : null}
        </span>
        {blocked ? (
          <span className="pf-sr-only" id={`pf-option-${option.id}-state`}>
            {card.incompatible}
          </span>
        ) : null}
        <span aria-hidden="true" className="pf-option-check">
          <Icon name="check" size={12} />
        </span>
      </button>

      <InfoTip
        className="pf-option-tip"
        label={card.details(option.label)}
        tone={blocked ? 'danger' : 'neutral'}
      >
        <span className="pf-tip-title">{option.label}</span>

        {advice === undefined ? (
          <span className="pf-tip-text">{chosen ? card.stateSelected : card.stateAvailable}</span>
        ) : (
          <>
            <span className="pf-tip-heading pf-tip-danger">
              <Icon name="alertCircle" size={13} />
              {card.incompatible}
            </span>
            <span className="pf-tip-text">{option.reason}</span>

            {conflicts.length === 0 ? null : (
              <>
                <span className="pf-tip-heading">{card.conflictsWith}</span>
                <span className="pf-tip-list">
                  {conflicts.map((item) => (
                    <span className="pf-tip-row" key={item.id}>
                      <span className="pf-tip-name">{item.label}</span>
                      <DocLink item={item} label={card.docs} />
                    </span>
                  ))}
                </span>
              </>
            )}

            <span className="pf-tip-heading">{card.consequence}</span>
            <span className="pf-tip-text">{advice.consequence}</span>

            <span className="pf-tip-heading">{card.solution}</span>
            <span className="pf-tip-text">{advice.solution}</span>
            {alternatives.length === 0 ? null : (
              <span className="pf-tip-text">
                {card.alternatives(alternatives.map((item) => item.label).join(', '))}
              </span>
            )}
          </>
        )}

        {option.docs === undefined ? null : (
          <span className="pf-tip-footer">
            <DocLink item={option} label={card.docsOf(option.label)} />
          </span>
        )}
      </InfoTip>
    </div>
  );
}

'use client';

import type { Category } from '@buildit/registry';
import { type ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { OptionCard } from '../../../components/ui/option-card';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';
import { selectionFor } from '../../../lib/selection';
import { toggleExclusive } from '../../../lib/session';
import { checkSelectionAction } from '../../actions';
import { currentDeepLink, revealSection } from '../blueprint/deep-link';
import { categoriesWithRole } from '../capabilities/capabilities';
import { categoryLabel } from '../stack/stack-view';
import { type InfrastructureBlock, loadInfrastructureBlocksAction } from './actions';

/**
 * Écran 8 Infrastructure (§6.9).
 *
 * **Les six catégories d'infrastructure** du catalogue y sont affichées, pas
 * seulement l'hébergement : gestionnaire de paquets, monorepo, conteneurs,
 * environnement de développement, intégration continue et cloud cible. Chacune
 * vient du moteur, filtrée par la **même** vérification de compatibilité que le
 * Stack Builder, sur la sélection complète (`lib/selection.ts`) : les
 * possibilités de la pile et celles de l'infrastructure se combinent donc dans
 * les deux sens, et un refus est dit ici plutôt qu'à la génération.
 *
 * Docker et l'intégration continue gardent leurs deux cartes : ce sont les deux
 * seuls choix que le manifest range dans `infra` sous forme de booléens
 * (`lib/draft-to-manifest.ts`). Leurs identifiants sont donc **retirés** des
 * listes de catégories pour qu'un même choix n'ait pas deux contrôles.
 *
 * La traduction brouillon → manifest n'est pas détaillée ici : le plan du
 * projet (écran 9) montre ce qui sera réellement généré, et un crayon y ramène
 * à la bonne section.
 */
export default function InfrastructurePage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [blocks, setBlocks] = useState<readonly InfrastructureBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const dockerRef = useRef<HTMLButtonElement>(null);
  const ciRef = useRef<HTMLButtonElement>(null);
  const hostingRef = useRef<HTMLElement>(null);

  // L'arrivée par un crayon du plan (`?section=docker|ci|hosting`) : la
  // section visée est amenée sous les yeux, et le bouton reçoit le focus pour
  // qu'un clavier puisse le basculer aussitôt. Sans paramètre, rien ne change.
  useEffect(() => {
    const section = currentDeepLink('section');
    if (section === 'hosting') {
      revealSection(hostingRef.current);
      return;
    }
    const target =
      section === 'docker' ? dockerRef.current : section === 'ci' ? ciRef.current : null;
    if (target !== null) {
      revealSection(target);
      target.focus({ preventScroll: true });
    }
  }, []);

  // La même sélection qu'au Stack Builder : technologies, capacités **et** choix
  // d'infrastructure. Mémoïsée sur les pièces du brouillon, pas sur le
  // brouillon, pour que l'écriture du verdict ne relance pas le chargement.
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer la lecture après une panne du moteur, sans perdre le brouillon.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadInfrastructureBlocksAction(selection)
      .then((loaded) => {
        if (alive) {
          setBlocks(loaded);
          setFailure(undefined);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(
            error instanceof Error && error.message.length > 0
              ? error.message
              : t.build.infrastructure.engineDown,
          );
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [selection, attempt, t]);

  // Le verdict du moteur, écrit ici comme au Stack Builder : sans lui, un refus
  // né d'un choix d'infrastructure ne bloquerait aucune étape (`lib/flow.ts`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer la vérification après un refus.
  useEffect(() => {
    let alive = true;
    void checkSelectionAction(selection).then((resolution) => {
      if (alive) {
        session.update((currentDraft) => ({ ...currentDraft, resolution }));
      }
    });
    return () => {
      alive = false;
    };
  }, [selection, session, attempt]);

  // Les titres des sections viennent de la table `SCREEN_ROLE` : ils existent
  // dès le premier rendu, avant même que le moteur ait rendu les options. Une
  // page qui n'affiche qu'une ligne de chargement ne dit pas ce qu'elle attend ;
  // ici, on lit tout de suite ce qui sera demandé. Les deux raccourcis (Docker,
  // CI-CD) ont déjà été retirés des listes par l'action serveur.
  const sections = useMemo(
    () =>
      categoriesWithRole('infrastructure').map((category) => ({
        category,
        options: blocks.find((block) => block.category === category)?.options ?? [],
      })),
    [blocks],
  );

  // Qui appartient à quelle catégorie, pour `toggleExclusive` (§12) : reconstruit
  // depuis les blocs déjà chargés, jamais depuis un second aller-retour.
  const categoryOf = useMemo(() => {
    const map = new Map<string, Category>();
    for (const block of blocks) {
      for (const option of block.options) {
        map.set(option.id, block.category);
      }
    }
    return map;
  }, [blocks]);

  const targetsOf = useMemo(() => {
    const map = new Map<string, readonly string[]>();
    for (const block of blocks) {
      for (const option of block.options) {
        map.set(option.id, option.targets);
      }
    }
    return map;
  }, [blocks]);

  function toggle(id: string, category: Category): void {
    // Une seule bascule pour les sept catégories, hébergement compris : le
    // moteur décide (`hosting` est cumulative, plusieurs hébergeurs cohabitent,
    // un par plateforme), et l'écran ne doit pas retirer un choix qu'il accepte.
    session.update((currentDraft) => ({
      ...currentDraft,
      technologies: toggleExclusive(currentDraft.technologies, id, category, categoryOf, targetsOf),
    }));
  }

  /** Les sœurs disponibles d'une option bloquée : de quoi rebondir sans chercher. */
  function alternatives(options: readonly OptionView[], id: string): readonly OptionView[] {
    return options.filter((item) => item.id !== id && item.state === 'available').slice(0, 3);
  }

  function optionList(options: readonly OptionView[], choose: (id: string) => void): ReactElement {
    return (
      <div className="pf-grid-4 mt-2">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            pressed={draft.technologies.includes(option.id)}
            alternatives={option.state === 'blocked' ? alternatives(options, option.id) : []}
            onToggle={() => choose(option.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <StepShell
      step="infrastructure"
      title={t.build.infrastructure.title}
      description={t.build.infrastructure.description}
    >
      <fieldset>
        <legend className="pf-label">{t.build.infrastructure.legend}</legend>
        <div className="pf-grid">
          <button
            ref={dockerRef}
            type="button"
            className="pf-choice pf-deep-target"
            data-infra="docker"
            aria-pressed={draft.infra.docker}
            onClick={() => {
              const docker = !draft.infra.docker;
              session.update((currentDraft) => ({
                ...currentDraft,
                infra: { ...currentDraft.infra, docker },
              }));
            }}
          >
            <span className="pf-choice-name">{t.build.infrastructure.docker}</span>
            <span className="pf-choice-note">{t.build.infrastructure.dockerNote}</span>
          </button>

          <button
            ref={ciRef}
            type="button"
            className="pf-choice pf-deep-target"
            data-infra="ci"
            aria-pressed={draft.infra.ci}
            onClick={() => {
              const ci = !draft.infra.ci;
              session.update((currentDraft) => ({
                ...currentDraft,
                infra: { ...currentDraft.infra, ci },
              }));
            }}
          >
            <span className="pf-choice-name">{t.build.infrastructure.ci}</span>
            <span className="pf-choice-note">{t.build.infrastructure.ciNote}</span>
          </button>
        </div>
      </fieldset>

      <p className="pf-hint mt-6">{t.build.infrastructure.pickHint}</p>

      {loading ? (
        <LoadingLine className="mt-2">{t.build.infrastructure.loading}</LoadingLine>
      ) : null}
      {failure === undefined ? null : (
        <ErrorState
          className="mt-3"
          title={t.build.infrastructure.engineDownTitle}
          body={failure}
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
      {sections.map((section) => {
        const label = categoryLabel(t, section.category);
        const body = loading ? null : section.options.length === 0 ? (
          <p className="pf-hint mt-2">{t.build.infrastructure.nothingCompatible}</p>
        ) : (
          optionList(section.options, (id) => toggle(id, section.category))
        );
        if (section.category === 'hosting') {
          return (
            <section
              key={section.category}
              ref={hostingRef}
              className="pf-deep-target mt-6"
              aria-label={t.build.infrastructure.cloudLegend}
            >
              <h2 className="pf-label">{t.build.infrastructure.cloudTitle}</h2>
              <p className="pf-hint">
                {t.build.infrastructure.cloudHintBefore} <span className="pf-mono">hosting</span>
                {t.build.infrastructure.cloudHintMid} <span className="pf-mono">technologies</span>
                {t.build.infrastructure.cloudHintAfter}
              </p>
              {body}
            </section>
          );
        }
        return (
          <section key={section.category} className="mt-6" aria-label={label}>
            <h2 className="pf-label">{label}</h2>
            {body}
          </section>
        );
      })}
    </StepShell>
  );
}

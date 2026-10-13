'use client';

import { ARCHITECTURES, type Architecture, skeletonTree } from '@buildit/manifest';
import type { ReactElement } from 'react';
import type { DraftState } from '../../../lib/draft';
import { useMessages } from '../../../lib/i18n/provider';

/**
 * Écran 4 — **Architecture Builder** (§6.5) : la forme du projet, avec sa
 * description courte **et son impact** (complexité, coût d'exploitation).
 *
 * Module co-localisé, pas `page.tsx` : Next refuse tout export autre que
 * `default` dans un écran (validateur engendré). Même convention que les autres
 * écrans (`capabilities.ts`, `summary.ts`).
 *
 * Les valeurs viennent de `ARCHITECTURES` du manifest — jamais recopiées. Les
 * phrases d'impact vivent au dictionnaire (`wizard.architecture.labels`), où
 * chaque forme est une clé : ajouter une architecture au manifest sans lui
 * écrire sa phrase casse la compilation au point d'usage. Même garde-fou que
 * l'écran cible.
 *
 * `architecture`, lui, **part dans le manifest** (contrairement à `type`) : le
 * schéma du §10 le déclare obligatoire.
 */

/**
 * Les technologies qui orientent la forme. Identifiants du catalogue, recopiés
 * ici parce que l'écran est un composant client sans accès au registry ; le
 * test de l'écran vérifie contre le catalogue réel qu'aucun ne manque ni ne
 * change de catégorie.
 */
export const STACK_SIGNALS = {
  frontend: [
    'angular',
    'astro',
    'htmx',
    'next',
    'nuxt',
    'preact',
    'qwik',
    'react',
    'remix',
    'solidjs',
    'svelte',
    'sveltekit',
    'vue',
  ],
  backend: [
    'actix-web',
    'aspnet-core',
    'axum',
    'django',
    'elysia',
    'express',
    'fastapi',
    'fastify',
    'fiber',
    'flask',
    'gin',
    'hono',
    'laravel',
    'nestjs',
    'rails',
    'spring-boot',
    'symfony',
  ],
  queue: ['bullmq', 'kafka', 'nats', 'rabbitmq', 'sqs'],
  /** Hébergeurs à fonctions (Vercel Functions, Lambda, Workers, Netlify Functions). */
  serverless: ['vercel', 'netlify', 'cloudflare', 'aws'],
} as const satisfies Record<string, readonly string[]>;

export interface StackProfile {
  readonly frontend: boolean;
  readonly backend: boolean;
  readonly queue: boolean;
  readonly serverless: boolean;
}

const has = (list: readonly string[], technologies: readonly string[]) =>
  technologies.some((id) => list.includes(id));

/**
 * Ce que la stack dit du projet. Avant l'écran Stack, aucune technologie
 * n'est choisie : les cibles de l'écran 2 décident alors du front et du back.
 */
export function stackProfile(
  technologies: readonly string[] = [],
  targets: readonly string[] = [],
): StackProfile {
  const frontend = has(STACK_SIGNALS.frontend, technologies);
  const backend = has(STACK_SIGNALS.backend, technologies);
  const anyFramework = frontend || backend;
  return {
    frontend: anyFramework ? frontend : targets.some((target) => target !== 'api'),
    backend: anyFramework ? backend : targets.includes('api'),
    queue: has(STACK_SIGNALS.queue, technologies),
    serverless: has(STACK_SIGNALS.serverless, technologies),
  };
}

/**
 * La forme posée quand aucune n'est encore choisie : le manifest exige une
 * architecture (§10). L'application unique est la plus simple ; le moteur passe
 * de lui-même en monorepo quand un frontend et un backend sont choisis
 * (`draftToManifest`). Ce n'est pas une recommandation, l'écran n'en affiche
 * aucune.
 */
export const DEFAULT_ARCHITECTURE: Architecture = 'single-app';

/** Le changement de brouillon d'une sélection — testable hors React. */
export function withArchitecture(draft: DraftState, architecture: Architecture): DraftState {
  return { ...draft, architecture };
}

export interface ArchitectureChoicesProps {
  readonly selected: string | undefined;
  /** Les technologies déjà choisies — elles dessinent l'arborescence montrée. */
  readonly technologies?: readonly string[];
  /** Les cibles de l'écran 2 — elles devinent front et back avant la stack. */
  readonly targets?: readonly string[];
  readonly onSelect: (architecture: Architecture) => void;
}

/** Le contenu de l'écran, hors contexte React — donc testable au rendu serveur. */
export function ArchitectureChoices({
  selected,
  technologies = [],
  targets = [],
  onSelect,
}: ArchitectureChoicesProps): ReactElement {
  const t = useMessages();
  const profile = stackProfile(technologies, targets);
  const chosen = ARCHITECTURES.find((architecture) => architecture === selected);
  const labels = t.wizard.architecture.labels;

  return (
    <>
      <fieldset>
        <legend className="pf-label">{t.wizard.architecture.legend}</legend>
        <div className="pf-grid">
          {ARCHITECTURES.map((architecture) => {
            const note = labels[architecture];
            return (
              <button
                key={architecture}
                type="button"
                className="pf-choice"
                data-architecture={architecture}
                aria-pressed={chosen === architecture}
                onClick={() => onSelect(architecture)}
              >
                <span className="pf-choice-name">{note.label}</span>
                <span className="pf-choice-note">{note.note}</span>
                <span className="pf-choice-note">
                  {t.wizard.architecture.impact(note.complexity, note.cost)}
                </span>
                <span className="pf-choice-note">
                  {t.wizard.architecture.repoLabel} : {note.repo}
                </span>
                <span className="pf-choice-note">
                  {t.wizard.architecture.runtimeLabel} : {note.runtime}
                </span>
                <span className="pf-choice-note">{t.wizard.architecture.treeLabel}</span>
                {/* `span`, pas `pre` : un bouton n'accepte que du contenu en ligne. */}
                <span
                  className="pf-choice-note"
                  data-tree={architecture}
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {skeletonTree(architecture, profile)
                    .map((dir) => `${dir.path}/`)
                    .join('\n')}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="pf-hint mt-4">
        {chosen === undefined
          ? t.wizard.architecture.none
          : t.wizard.architecture.summary(
              labels[chosen].label,
              labels[chosen].complexity,
              labels[chosen].cost,
            )}
      </p>
    </>
  );
}

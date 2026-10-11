'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { OptionView } from '../../../lib/engine';
import { loadOptionsAction } from '../../actions';
import { chooseHosting, infrastructureIds, selectedHosting } from './infrastructure';

/** Le message d'une panne du moteur — affiché, jamais tu. */
function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Le moteur n’a pas répondu.';
}

/**
 * Écran 9 — Infrastructure (§6.9).
 *
 * Deux cases à cocher (`docker`, CI) et un cloud cible. Le brouillon n'a pas de
 * champ cloud : l'hébergeur est un identifiant de la catégorie `hosting` choisi
 * parmi les options du moteur, et il rejoint `draft.technologies`. Docker et
 * CI/CD restent des booléens, parce que le manifest n'a que deux façons de les
 * exprimer — et c'est `lib/draft-to-manifest.ts` qui les traduit.
 *
 * Les identifiants et leurs cibles sont affichés : l'utilisateur n'a pas à
 * deviner ce que ses clics écrivent.
 */
export default function InfrastructurePage(): ReactElement {
  const draft = useDraft();
  const session = useSession();
  const [hosts, setHosts] = useState<readonly OptionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const selection = {
      targets: [...draft.targets],
      technologies: [
        ...new Set([...draft.technologies, ...draft.capabilities, ...infrastructureIds(draft)]),
      ].sort(),
    };
    void loadOptionsAction('hosting', selection)
      .then((loaded) => {
        if (alive) {
          setHosts(loaded);
          setFailure(undefined);
        }
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(failureMessage(error));
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
  }, [draft]);

  const hostingIds = hosts.map((host) => host.id);
  const current = selectedHosting(draft.technologies, hostingIds);

  return (
    <StepShell
      step="infrastructure"
      title="Infrastructure"
      description="Ce qui fait tourner et livrer le projet : conteneurs, intégration continue et hébergement. Ces choix rejoignent le champ infra du manifest."
    >
      <fieldset>
        <legend className="pf-label">Ce que le projet embarque</legend>
        <div className="pf-grid">
          <label className="pf-choice flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.infra.docker}
              onChange={(event) => {
                const docker = event.target.checked;
                session.update((currentDraft) => ({
                  ...currentDraft,
                  infra: { ...currentDraft.infra, docker },
                }));
              }}
            />
            <span>
              <span className="pf-choice-name">Docker</span>
              <span className="pf-choice-note">
                Un Dockerfile et un environnement de développement reproductible.
              </span>
            </span>
          </label>

          <label className="pf-choice flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.infra.ci}
              onChange={(event) => {
                const ci = event.target.checked;
                session.update((currentDraft) => ({
                  ...currentDraft,
                  infra: { ...currentDraft.infra, ci },
                }));
              }}
            />
            <span>
              <span className="pf-choice-name">Intégration continue</span>
              <span className="pf-choice-note">
                Un workflow GitHub Actions : lint, types et tests à chaque poussée.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <section className="mt-6" aria-label="Cloud cible">
        <h2 className="pf-label">Cloud cible</h2>
        <p className="pf-hint">
          L’hébergeur est un choix de la catégorie <span className="pf-mono">hosting</span> : le
          brouillon n’a pas de champ dédié, et cet identifiant rejoint{' '}
          <span className="pf-mono">technologies</span>. Un seul cloud cible à la fois.
        </p>
        {loading ? <p className="pf-hint mt-2">Chargement des hébergeurs…</p> : null}
        {failure === undefined ? null : <p className="pf-error mt-2">{failure}</p>}
        {loading ? null : hosts.length === 0 ? (
          <p className="pf-hint mt-2">Aucun hébergeur pour cette sélection.</p>
        ) : (
          <div className="pf-grid mt-2">
            {hosts.map((host) => {
              const chosen = host.id === current;
              const blocked = host.state === 'blocked';
              return (
                <button
                  key={host.id}
                  type="button"
                  className="pf-choice"
                  aria-pressed={chosen}
                  disabled={blocked}
                  onClick={() => {
                    session.update((currentDraft) =>
                      chooseHosting(currentDraft, hostingIds, chosen ? null : host.id),
                    );
                  }}
                >
                  <span className="pf-choice-name">
                    {host.label}
                    {chosen ? <span className="pf-badge pf-badge-accent ml-2">Choisi</span> : null}
                  </span>
                  <span className="pf-choice-note pf-mono">{host.id}</span>
                  {blocked ? <span className="pf-error">{host.reason}</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6" aria-label="Traduction dans le manifest">
        <h2 className="pf-label">Ce que l’écran écrit dans le manifest</h2>
        <dl className="pf-hint">
          <div>
            <dt className="pf-mono">docker</dt>
            <dd>rejoint infra, quand Docker est cochée.</dd>
          </div>
          <div>
            <dt className="pf-mono">github-actions</dt>
            <dd>rejoint infra, quand l’intégration continue est cochée.</dd>
          </div>
          <div>
            <dt className="pf-mono">hosting</dt>
            <dd>rejoint infra, l’hébergeur choisi ci-dessus.</dd>
          </div>
        </dl>
      </section>
    </StepShell>
  );
}

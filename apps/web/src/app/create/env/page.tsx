'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { LoadingLine } from '../../../components/ui/loading';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { EnvVarView } from '../../../lib/engine';
import { useMessages } from '../../../lib/i18n/provider';
import { loadEnvVarsAction } from '../../actions';
import { envSelection, isEngineAdded, namesOf, sameNames } from './env-model';

/**
 * Écran 7 — Environment & Secrets (§6.8, §24).
 *
 * Les noms viennent du moteur (`loadEnvVarsAction`), qui lit le champ `env` des
 * fiches du catalogue et suit la résolution — additions comprises. L'écran
 * n'affiche **aucune valeur** et n'offre aucun champ pour en saisir une : la
 * valeur n'a rien à faire dans le brouillon ni dans un lien de partage.
 *
 * Seuls les noms sont recopiés dans `draft.envVarNames`, pour que les écrans
 * suivants sachent ce que le projet exigera. Une panne du moteur se dit et se
 * réessaie sur place : le brouillon n'est jamais perdu pour un aller-retour raté.
 */
export default function EnvPage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const session = useSession();
  const [variables, setVariables] = useState<readonly EnvVarView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` est la clé de relance : elle ne sert qu'à rejouer la lecture après une panne du moteur, sans perdre le brouillon.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    void loadEnvVarsAction(envSelection(draft))
      .then((loaded) => {
        if (!alive) {
          return;
        }
        setVariables(loaded);
        setFailure(undefined);
        const names = namesOf(loaded);
        // Les **noms** seulement. Une liste identique n'est pas réécrite : le
        // brouillon est persisté à chaque `update`.
        session.update((current) =>
          sameNames(current.envVarNames, names) ? current : { ...current, envVarNames: names },
        );
      })
      .catch((error: unknown) => {
        if (alive) {
          setFailure(
            error instanceof Error && error.message.length > 0
              ? error.message
              : t.build.env.engineDown,
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
  }, [draft, session, attempt, t]);

  const chosen = new Set([...draft.technologies, ...draft.capabilities]);

  return (
    <StepShell step="env" title={t.build.env.title} description={t.build.env.description}>
      <section aria-label={t.build.env.requiredLegend}>
        <h2 className="pf-label">{t.build.env.requiredTitle}</h2>
        {loading ? <LoadingLine>{t.build.env.loading}</LoadingLine> : null}
        {failure === undefined ? null : (
          <ErrorState
            className="mt-3"
            title={t.build.env.engineDownTitle}
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
        {loading || failure !== undefined ? null : variables.length === 0 ? (
          <p className="pf-hint">{t.build.env.empty}</p>
        ) : (
          <ul className="pf-grid mt-2">
            {variables.map((variable) => (
              <li key={variable.name} className="pf-card pf-card-pad min-w-0">
                <p className="pf-mono break-all">{variable.name}</p>
                <p className="pf-hint">
                  {t.build.env.requiredBy(
                    variable.technologies.length === 0
                      ? t.build.env.engineRequirement
                      : variable.technologies.join(', '),
                  )}
                </p>
                {isEngineAdded(variable, chosen) ? (
                  <span className="pf-badge pf-badge-ok">{t.build.env.engineAdded}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-label={t.build.env.whereLegend}>
        <h2 className="pf-label">{t.build.env.whereTitle}</h2>
        <ul className="pf-hint">
          <li>
            {t.build.env.envFileBefore} <span className="pf-mono">.env.local</span>
            {t.build.env.envFileAfter}
          </li>
          <li>
            {t.build.env.gitignoreBefore} <span className="pf-mono">.gitignore</span>{' '}
            {t.build.env.gitignoreAfter}
          </li>
          <li>{t.build.env.namesOnly}</li>
          <li>{t.build.env.engineMarked}</li>
        </ul>
      </section>
    </StepShell>
  );
}

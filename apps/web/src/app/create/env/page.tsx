'use client';

import { type ReactElement, useEffect, useState } from 'react';
import { useDraft, useSession } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import type { EnvVarView } from '../../../lib/engine';
import { loadEnvVarsAction } from '../../actions';
import { envSelection, isEngineAdded, namesOf, sameNames } from './env-model';

/** Le message d'une panne du moteur — affiché, jamais tu. */
function failureMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : 'Le moteur n’a pas répondu.';
}

/**
 * Écran 8 — Environment & Secrets (§6.8, §24).
 *
 * Les noms viennent du moteur (`loadEnvVarsAction`), qui lit le champ `env` des
 * fiches du catalogue et suit la résolution — additions comprises. L'écran
 * n'affiche **aucune valeur** et n'offre aucun champ pour en saisir une : la
 * valeur n'a rien à faire dans le brouillon ni dans un lien de partage.
 *
 * Seuls les noms sont recopiés dans `draft.envVarNames`, pour que les écrans
 * suivants sachent ce que le projet exigera.
 */
export default function EnvPage(): ReactElement {
  const draft = useDraft();
  const session = useSession();
  const [variables, setVariables] = useState<readonly EnvVarView[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | undefined>(undefined);

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
  }, [draft, session]);

  const chosen = new Set([...draft.technologies, ...draft.capabilities]);

  return (
    <StepShell
      step="env"
      title="Environnement & secrets"
      description="Les variables que vos choix réclament. Cette page n’affiche et ne stocke que des noms : aucune valeur ne transite par l’interface."
    >
      <section aria-label="Variables requises">
        <h2 className="pf-label">Variables requises</h2>
        {loading ? <p className="pf-hint">Chargement des variables…</p> : null}
        {failure === undefined ? null : <p className="pf-error">{failure}</p>}
        {loading ? null : variables.length === 0 ? (
          <p className="pf-hint">
            Aucune variable pour l’instant : les choix faits aux écrans précédents n’en réclament
            aucune.
          </p>
        ) : (
          <ul className="pf-grid mt-2">
            {variables.map((variable) => (
              <li key={variable.name} className="pf-card pf-card-pad">
                <p className="pf-mono">{variable.name}</p>
                <p className="pf-hint">
                  Réclamée par :{' '}
                  {variable.technologies.length === 0
                    ? 'une exigence du moteur'
                    : variable.technologies.join(', ')}
                </p>
                {isEngineAdded(variable, chosen) ? (
                  <span className="pf-badge pf-badge-ok">Ajoutée par le moteur</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-label="Où mettre les valeurs">
        <h2 className="pf-label">Où mettre les valeurs</h2>
        <ul className="pf-hint">
          <li>
            Chaque valeur se met dans <span className="pf-mono">.env.local</span>, à la racine du
            projet.
          </li>
          <li>
            Ce fichier n’est jamais commité : il figure dans le{' '}
            <span className="pf-mono">.gitignore</span> engendré par le projet.
          </li>
          <li>
            Le brouillon ne retient que les noms, et cette page n’offre aucun champ de saisie :
            aucune valeur ne transite par l’interface, ni par le lien de partage.
          </li>
          <li>
            Les valeurs ajoutées par le moteur sont marquées : elles viennent d’une exigence tirée
            par vos choix, pas d’une ligne saisie ici.
          </li>
        </ul>
      </section>
    </StepShell>
  );
}

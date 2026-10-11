'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { downloadZip } from '../../../lib/download-zip';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { type GenerationView, generateProjectAction, workspaceRootAction } from '../../actions';
import { browserSessionStorage, saveReport } from '../report/result';
import { PipelineProgress } from './PipelineProgress';
import { formatBytes, GENERATION_STEPS, progressStates, targetDirectory } from './steps';

/**
 * Generation Progress (§6.13).
 *
 * L'écran montre le **dossier de destination avant d'écrire** — la racine vient
 * de `workspaceRootAction()`, jamais du navigateur (décision 8B.6) — puis
 * demande confirmation. Une fois la génération lancée, il affiche les étapes que
 * le moteur a réellement terminées, et le rapport est transmis à l'écran
 * Report (§6.14) par `sessionStorage`.
 *
 * Un dossier existant fait refuser la génération : c'est dit ici avant le clic,
 * et le refus est affiché tel quel après.
 */
export default function GeneratePage() {
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);
  const [root, setRoot] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<GenerationView | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void workspaceRootAction()
      .then((value) => {
        if (alive) {
          setRoot(value);
        }
      })
      .catch(() => {
        if (alive) {
          setRoot(null);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const directory = useMemo(
    () => (root === null || !manifest.ok ? null : targetDirectory(root, manifest.value.name)),
    [root, manifest],
  );

  async function run(): Promise<void> {
    if (!manifest.ok) {
      return;
    }
    setRunning(true);
    setFatal(null);
    setReport(null);
    try {
      const result = await generateProjectAction(manifest.value);
      // Le rapport est enregistré même en cas de refus : l'écran Report doit
      // pouvoir dire le refus, pas seulement un succès.
      saveReport(browserSessionStorage(), result);
      setReport(result);
      // Mode hébergé (Phase 12) : rien n'est écrit sur le serveur au-delà de
      // la requête — le projet est proposé en téléchargement, ici, tout de
      // suite, puisque l'archive ne sera plus disponible après ce rendu.
      if (result.ok && result.zipBase64 !== undefined) {
        downloadZip(result.zipBase64, manifest.value.name);
      }
    } catch {
      setFatal('La génération n’a pas pu être lancée. Rien n’a été écrit — réessayez.');
    } finally {
      setRunning(false);
    }
  }

  if (!manifest.ok) {
    return (
      <StepShell
        step="generate"
        title="Générer le projet"
        description="Le projet est écrit sur cette machine, dans le dossier de travail affiché."
      >
        <div className="pf-card pf-card-pad">
          <p className="pf-error" role="status">
            Le brouillon est incomplet : rien ne sera écrit.
          </p>
          <ul className="mt-2 list-disc pl-5">
            {manifest.issues.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      step="generate"
      title="Générer le projet"
      description="Le projet est écrit sur cette machine, dans le dossier de travail affiché."
    >
      <section className="pf-card pf-card-pad">
        <h2 className="pf-label">Dossier de destination</h2>
        <p className="pf-mono">{directory ?? 'Résolution de la racine de travail…'}</p>
        <p className="pf-hint mt-1">
          Rien n’est écrit avant votre clic. Un dossier du même nom déjà présent fait refuser la
          génération : aucun fichier existant n’est écrasé.
        </p>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="pf-btn pf-btn-primary"
          disabled={running || directory === null}
          onClick={() => {
            void run();
          }}
        >
          {running ? 'Génération…' : 'Générer le projet'}
        </button>
        {report === null ? null : (
          <Link className="pf-btn" href="/create/report">
            Voir le rapport complet
          </Link>
        )}
      </div>

      {fatal === null ? null : (
        <div className="mt-3">
          <p className="pf-error" role="status">
            {fatal}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link className="pf-btn" href="/create/stack">
              Modifier les technologies
            </Link>
            <Link className="pf-btn pf-btn-ghost" href="/">
              Retour au tableau de bord
            </Link>
          </div>
        </div>
      )}

      {running ? (
        <div className="mt-4">
          <PipelineProgress steps={progressStates([], GENERATION_STEPS)} running />
        </div>
      ) : null}

      {report === null ? null : (
        <div className="mt-4">
          <PipelineProgress
            steps={progressStates(report.steps, GENERATION_STEPS)}
            running={false}
          />

          {report.ok ? (
            <p className="mt-3" role="status">
              Projet écrit dans <span className="pf-mono">{report.directory}</span> :{' '}
              {report.files.length} fichier{report.files.length > 1 ? 's' : ''},{' '}
              {formatBytes(report.bytes)}.
            </p>
          ) : (
            <div className="mt-3">
              <p className="pf-error" role="status">
                La génération a été refusée — rien n’a été écrit.
              </p>
              <ul className="pf-error mt-1 list-disc pl-5">
                {report.issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <p className="pf-hint mt-2">
                Un dossier déjà présent n’est jamais écrasé : si le problème vient de là, changez le
                nom à l’écran « Créer un projet ». Si le problème vient des technologies choisies,
                corrigez-les ci-dessous.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link className="pf-btn" href="/create/stack">
                  Modifier les technologies
                </Link>
                <Link className="pf-btn pf-btn-ghost" href="/">
                  Retour au tableau de bord
                </Link>
              </div>

              <div className="mt-3">
                <p className="pf-label">Technologies choisies</p>
                {draft.technologies.length === 0 ? (
                  <p className="pf-hint">Aucune technologie choisie.</p>
                ) : (
                  <p className="flex flex-wrap items-center gap-2 mt-1">
                    {draft.technologies.map((id) => (
                      <span key={id} className="pf-badge pf-mono">
                        {id}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </StepShell>
  );
}

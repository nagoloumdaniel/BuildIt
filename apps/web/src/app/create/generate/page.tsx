'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '../../../components/ui/error-state';
import { Icon } from '../../../components/ui/icon';
import { Spinner } from '../../../components/ui/loading';
import { useDraft } from '../../../components/wizard/draft-provider';
import { StepShell } from '../../../components/wizard/shell';
import { downloadZip } from '../../../lib/download-zip';
import { draftToManifest } from '../../../lib/draft-to-manifest';
import { useLocale } from '../../../lib/i18n/provider';
import { browserProjectStorage } from '../../../lib/projects';
import { type GenerationView, generateProjectAction, workspaceRootAction } from '../../actions';
import { browserSessionStorage, saveReport } from '../report/result';
import { PipelineProgress } from './PipelineProgress';
import { rememberGeneratedProject } from './remember';
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
 * et le refus est affiché tel quel après, sans quitter l'écran — le brouillon
 * reste entier, donc corriger ne coûte rien.
 *
 * Au succès seulement, le projet rejoint la **mémoire des projets générés**
 * (`rememberGeneratedProject`) : un projet écrit sur le disque n'est plus un
 * brouillon, et la reprise de parcours ne doit plus le présenter comme tel.
 */
export default function GeneratePage() {
  const { t: messages, locale } = useLocale();
  const draft = useDraft();
  const manifest = useMemo(() => draftToManifest(draft), [draft]);
  const [root, setRoot] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<GenerationView | null>(null);
  const [fatal, setFatal] = useState(false);

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
  const steps = messages.build.generate.steps;

  async function run(): Promise<void> {
    if (!manifest.ok) {
      return;
    }
    setRunning(true);
    setFatal(false);
    setReport(null);
    try {
      const result = await generateProjectAction(manifest.value);
      // Le rapport est enregistré même en cas de refus : l'écran Report doit
      // pouvoir dire le refus, pas seulement un succès.
      saveReport(browserSessionStorage(), result);
      // Et la mémoire des projets n'est écrite qu'au succès : un refus n'a
      // produit aucun projet, il n'a rien à y faire.
      rememberGeneratedProject(browserProjectStorage(), draft, result);
      setReport(result);
      // Mode hébergé (Phase 12) : rien n'est écrit sur le serveur au-delà de
      // la requête — le projet est proposé en téléchargement, ici, tout de
      // suite, puisque l'archive ne sera plus disponible après ce rendu.
      if (result.ok && result.zipBase64 !== undefined) {
        downloadZip(result.zipBase64, manifest.value.name);
      }
    } catch {
      setFatal(true);
    } finally {
      setRunning(false);
    }
  }

  if (!manifest.ok) {
    return (
      <StepShell
        step="generate"
        title={messages.build.generate.title}
        description={messages.build.generate.description}
      >
        <ErrorState
          title={messages.build.generate.incompleteTitle}
          body={messages.build.generate.incompleteBody}
          issues={manifest.issues.map((issue) => issue.message)}
          actions={
            <>
              <Link className="pf-btn" href="/create/stack">
                <Icon name="layers" />
                {messages.build.generate.fixStack}
              </Link>
              <Link className="pf-btn pf-btn-ghost" href="/">
                <Icon name="home" />
                {messages.build.generate.backHome}
              </Link>
            </>
          }
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      step="generate"
      title={messages.build.generate.title}
      description={messages.build.generate.description}
    >
      <section className="pf-card pf-card-pad">
        <h2 className="pf-label">{messages.build.generate.destination}</h2>
        {directory === null ? (
          <p className="pf-mono flex items-center gap-2">
            <Spinner size="sm" />
            {messages.build.generate.resolvingRoot}
          </p>
        ) : (
          <p className="pf-mono break-all">{directory}</p>
        )}
        <p className="pf-hint mt-1">{messages.build.generate.destinationHint}</p>
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
          <Icon name="hammer" />
          {running ? messages.build.generate.buttonRunning : messages.build.generate.button}
        </button>
        {report === null ? null : (
          <Link className="pf-btn" href="/create/report">
            <Icon name="file" />
            {messages.build.generate.viewReport}
          </Link>
        )}
      </div>

      {!fatal ? null : (
        <ErrorState
          className="mt-3"
          title={messages.build.generate.fatalTitle}
          body={messages.build.generate.fatalBody}
          actions={
            <>
              <button
                type="button"
                className="pf-btn"
                onClick={() => {
                  void run();
                }}
              >
                <Icon name="refresh" />
                {messages.common.retry}
              </button>
              <Link className="pf-btn pf-btn-ghost" href="/">
                <Icon name="home" />
                {messages.build.generate.backHome}
              </Link>
            </>
          }
        />
      )}

      {running ? (
        <div className="mt-4">
          <PipelineProgress steps={progressStates([], GENERATION_STEPS, steps)} running />
        </div>
      ) : null}

      {report === null ? null : (
        <div className="mt-4">
          {/* Un refus peut n'avoir exécuté aucune étape (dossier déjà pris) :
              on ne montre alors pas une barre à 0 % annoncée « terminée ». */}
          {report.ok || report.steps.length > 0 ? (
            <PipelineProgress
              steps={progressStates(report.steps, GENERATION_STEPS, steps)}
              running={false}
            />
          ) : null}

          {report.ok ? (
            <p className="mt-3" role="status">
              {messages.build.generate.writtenDirectory}{' '}
              <span className="pf-mono break-all">{report.directory}</span>
              {messages.build.generate.writtenRest(
                report.files.length,
                formatBytes(report.bytes, locale),
              )}
            </p>
          ) : (
            <div className="mt-3">
              <ErrorState
                title={messages.build.generate.refusedTitle}
                body={messages.build.generate.refusedBody}
                issues={report.issues}
                actions={
                  <>
                    <Link className="pf-btn" href="/create/stack">
                      <Icon name="layers" />
                      {messages.build.generate.fixStack}
                    </Link>
                    <Link className="pf-btn pf-btn-ghost" href="/">
                      <Icon name="home" />
                      {messages.build.generate.backHome}
                    </Link>
                  </>
                }
              />
              <p className="pf-hint mt-2">{messages.build.generate.refusedHint}</p>

              <div className="mt-3">
                <p className="pf-label">{messages.build.generate.technologiesTitle}</p>
                {draft.technologies.length === 0 ? (
                  <p className="pf-hint">{messages.build.generate.none}</p>
                ) : (
                  <p className="mt-1 flex flex-wrap items-center gap-2">
                    {draft.technologies.map((id) => (
                      <span key={id} className="pf-badge pf-mono break-all">
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

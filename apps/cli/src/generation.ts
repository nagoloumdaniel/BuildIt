import { relative } from 'node:path';
import {
  describePlan,
  generateProject,
  PIPELINE_STEPS,
  type PipelineOptions,
  planProject,
  type ResumableStep,
} from '@project-factory/generator';
import type { Manifest } from '@project-factory/manifest';
import { printIssues, printWarnings, usageError } from './format.js';
import { EXIT, type ExitCode, type Io } from './io.js';

/** Options communes à `pf create` et `pf generate`. */
export interface GenerationFlags {
  readonly install: boolean;
  readonly git: boolean;
  readonly dryRun: boolean;
  readonly from?: string | undefined;
}

/** Les drapeaux de génération, déclarés une fois pour `parseArgs`. */
export const GENERATION_OPTIONS = {
  dir: { type: 'string' },
  'no-install': { type: 'boolean', default: false },
  'no-git': { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
  from: { type: 'string' },
} as const;

export function generationFlags(values: {
  'no-install': boolean;
  'no-git': boolean;
  'dry-run': boolean;
  from?: string | undefined;
}): GenerationFlags {
  return {
    install: !values['no-install'],
    git: !values['no-git'],
    dryRun: values['dry-run'],
    from: values.from,
  };
}

const RESUMABLE = PIPELINE_STEPS.filter((step) => step !== 'plan');

function isResumable(step: string): step is ResumableStep {
  return (RESUMABLE as readonly string[]).includes(step);
}

/**
 * Passe le manifest au moteur, **tel quel** : le CLI ne transforme rien, pour
 * que le même manifest donne le même projet, quelle que soit la façade.
 *
 * `retry` est la commande à relancer après un échec transitoire : c'est la
 * façade qui sait comment l'utilisateur l'a appelée, pas le moteur.
 */
export async function runGeneration(
  io: Io,
  manifest: Manifest,
  targetDir: string,
  recipes: readonly string[],
  flags: GenerationFlags,
  retry: string,
): Promise<ExitCode> {
  if (flags.from !== undefined && !isResumable(flags.from)) {
    return usageError(
      io,
      `Étape de reprise inconnue : « ${flags.from} ».`,
      `Étapes possibles : ${RESUMABLE.join(', ')}.`,
    );
  }
  const options: PipelineOptions = {
    recipes,
    install: flags.install,
    git: flags.git,
    ...(flags.from === undefined ? {} : { fromStep: flags.from }),
  };
  const shown = relative(io.cwd, targetDir) || '.';

  if (flags.dryRun) {
    const planned = planProject(manifest, targetDir, options);
    if (!planned.ok) {
      printIssues(io, planned.issues);
      return EXIT.failure;
    }
    io.out(
      `Aperçu — rien n'est écrit. ${planned.value.plan.files.length} fichiers dans ${shown}/ :`,
    );
    io.out('');
    io.out(describePlan(planned.value.plan));
    printWarnings(io, planned.value.warnings);
    return EXIT.ok;
  }

  io.out(`Génération de « ${manifest.name} » dans ${shown}/…`);
  const result = await generateProject(manifest, targetDir, options);
  if (!result.ok) {
    io.err(`Échec à l'étape « ${result.failedStep} ».`);
    printIssues(io, result.issues);
    if (result.retryable) {
      io.err(`  → Erreur passagère : relancez avec \`${retry} --from ${result.failedStep}\`.`);
    }
    return EXIT.failure;
  }

  const { report, warnings, completedSteps } = result.value;
  if (report.written.length > 0) {
    io.out(`✓ ${report.written.length} fichiers écrits.`);
  }
  if (completedSteps.includes('install')) {
    io.out('✓ Dépendances installées.');
  }
  if (completedSteps.includes('git')) {
    io.out('✓ Dépôt Git initialisé, premier commit créé.');
  }
  printWarnings(io, warnings);
  io.out('');
  io.out('Et maintenant :');
  if (shown !== '.') {
    io.out(`  cd ${shown}`);
  }
  if (!completedSteps.includes('install')) {
    io.out('  pnpm install');
  }
  io.out('  pnpm dev');
  return EXIT.ok;
}

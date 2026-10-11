import type { CommandRunner } from '@buildit/exec';
import { cloneRepository, type GitRemote, parseRemote } from '@buildit/git';
import { describeIssues } from '../github/session';
import { inspectProject, installProject, type ProjectSummaryView } from '../open/project';
import {
  type DestinationState,
  defaultFolder,
  destinationState,
  resolveDestination,
} from './destination';

/**
 * Cloner un dépôt (§6.22, §18bis).
 *
 * La validation du lien précède tout appel à Git : `parseRemote` refuse ce que
 * `git clone` interpréterait comme une option, un protocole exotique ou des
 * identifiants dans l'URL. Le dossier de destination est vérifié libre **avant**
 * le clone, et `packages/git` refait la vérification — un clone n'écrase rien.
 */

export interface ClonePreviewView {
  readonly ok: boolean;
  /** Le dossier retenu, relatif à la racine de travail. */
  readonly folder: string;
  readonly directory: string;
  /** « propriétaire/dépôt » pour GitHub, l'URL sinon. */
  readonly label: string;
  readonly protocol: string;
  readonly host: string;
  readonly github: boolean;
  readonly destination: DestinationState | 'unknown';
  readonly issues: readonly string[];
}

/** Le lien validé et le dossier résolu — **interne au serveur**. */
export interface ClonePlan {
  readonly remote: GitRemote;
  readonly folder: string;
  readonly directory: string;
  readonly destination: DestinationState;
}

export interface ClonePlanResult {
  readonly view: ClonePreviewView;
  readonly plan?: ClonePlan;
}

function labelOf(remote: GitRemote): string {
  return remote.github === undefined ? remote.url : `${remote.github.owner}/${remote.github.repo}`;
}

function viewOf(
  remote: GitRemote | undefined,
  folder: string,
  directory: string,
  destination: DestinationState | 'unknown',
  issues: readonly string[],
): ClonePreviewView {
  return {
    ok: issues.length === 0,
    folder,
    directory,
    label: remote === undefined ? '' : labelOf(remote),
    protocol: remote?.protocol ?? '',
    host: remote?.host ?? '',
    github: remote?.github !== undefined,
    destination,
    issues,
  };
}

/**
 * Le plan du clone : lien validé, dossier résolu, destination libre — sans la
 * moindre écriture ni le moindre appel à Git.
 */
export async function planClone(
  link: unknown,
  folder: unknown,
  root: string,
): Promise<ClonePlanResult> {
  const parsed = parseRemote(typeof link === 'string' ? link : '');
  if (!parsed.ok) {
    return { view: viewOf(undefined, '', '', 'unknown', describeIssues(parsed.issues)) };
  }
  const remote = parsed.value;
  const chosen =
    typeof folder === 'string' && folder.trim() !== '' ? folder.trim() : defaultFolder(remote);
  if (chosen === undefined) {
    return {
      view: viewOf(remote, '', '', 'unknown', [
        'Impossible de déduire un dossier de ce lien : indiquez le dossier de destination.',
      ]),
    };
  }
  const resolved = resolveDestination(chosen, root);
  if (!resolved.ok) {
    return {
      view: viewOf(remote, chosen, '', 'unknown', resolved.issues),
    };
  }
  const state = await destinationState(resolved.value.directory);
  if (state === 'taken') {
    return {
      view: viewOf(remote, resolved.value.folder, resolved.value.directory, state, [
        `Le dossier ${resolved.value.directory} existe déjà et n’est pas vide : un clone n’écrase rien.`,
      ]),
    };
  }
  return {
    view: viewOf(remote, resolved.value.folder, resolved.value.directory, state, []),
    plan: {
      remote,
      folder: resolved.value.folder,
      directory: resolved.value.directory,
      destination: state,
    },
  };
}

export interface CloneRunOptions {
  readonly link: unknown;
  readonly folder: unknown;
  readonly install: boolean;
  /** Installer sans exécuter les scripts du projet — le défaut sage pour du code cloné. */
  readonly ignoreScripts: boolean;
  readonly root: string;
  readonly runner: CommandRunner;
  /** Jeton du compte connecté, pour un dépôt privé GitHub. Jamais journalisé. */
  readonly token?: string;
}

export interface CloneResultView {
  /** Le clone lui-même a réussi. L'installation, elle, vit dans `warnings`. */
  readonly ok: boolean;
  readonly directory: string;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly project?: ProjectSummaryView;
  readonly installCommand?: string;
  readonly installed: boolean;
}

/**
 * Le clone, puis — si on l'a demandé — la détection et l'installation.
 *
 * Un dépôt cloné n'est pas un projet reconnu : c'est un avertissement, pas un
 * échec (§18bis). Un échec d'installation non plus : le clone, lui, a réussi.
 */
export async function cloneProject(options: CloneRunOptions): Promise<CloneResultView> {
  const planned = await planClone(options.link, options.folder, options.root);
  const plan = planned.plan;
  if (plan === undefined) {
    return {
      ok: false,
      directory: planned.view.directory,
      issues: planned.view.issues,
      warnings: [],
      installed: false,
    };
  }
  const failure = await cloneRepository(plan.remote, plan.directory, {
    runner: options.runner,
    ...(options.token === undefined ? {} : { token: options.token }),
  });
  if (failure !== undefined) {
    return {
      ok: false,
      directory: plan.directory,
      issues: describeIssues(failure.issues),
      warnings: [],
      installed: false,
    };
  }
  if (!options.install) {
    return { ok: true, directory: plan.directory, issues: [], warnings: [], installed: false };
  }
  const inspection = await inspectProject(plan.directory);
  if (!inspection.ok) {
    return {
      ok: true,
      directory: plan.directory,
      issues: [],
      warnings: inspection.issues,
      installed: false,
    };
  }
  const installation = await installProject(plan.directory, options.ignoreScripts, options.runner);
  return {
    ok: true,
    directory: plan.directory,
    issues: [],
    warnings: [...inspection.value.warnings, ...installation.issues],
    project: inspection.value,
    installCommand: installation.command,
    installed: installation.ok,
  };
}

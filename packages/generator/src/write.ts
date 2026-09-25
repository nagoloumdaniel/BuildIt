import { chmod, lstat, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';
import type { FilePlan } from './plan.js';

/**
 * Écriture d'un plan sur le disque, avec annulation (§22).
 *
 * L'écriture journalise chaque fichier et chaque dossier qu'elle crée. À la
 * moindre erreur, elle défait ce journal en ordre inverse.
 *
 * Le journal ne contient **que ce que le générateur a créé lui-même**. C'est
 * ce qui rend l'annulation sûre : elle ne peut pas supprimer un fichier
 * préexistant, puisqu'elle ne l'a jamais inscrit.
 */

export const GEN_WRITE_CODES = [
  'GEN_TARGET_NOT_EMPTY',
  'GEN_PATH_TRAVERSAL',
  'GEN_WRITE_FAILED',
  'GEN_ROLLBACK_FAILED',
] as const;

export type GenWriteCode = (typeof GEN_WRITE_CODES)[number];
export type GenWriteIssue = Issue<GenWriteCode>;

const MESSAGES: Readonly<Record<GenWriteCode, string>> = {
  GEN_PATH_TRAVERSAL:
    'Le chemin {value} traverse un lien symbolique. Un lien peut pointer n’importe où : l’écriture s’arrête plutôt que de suivre.',
  GEN_TARGET_NOT_EMPTY:
    'Le dossier {value} n’est pas vide. La génération n’écrase jamais un projet existant — choisissez un dossier vide.',
  GEN_WRITE_FAILED:
    'Échec à l’écriture de {value} : {reason}. Tout ce qui avait été écrit a été annulé, le dossier est revenu à son état initial.',
  GEN_ROLLBACK_FAILED:
    'L’annulation a elle-même échoué : {reason}. Des fichiers partiels peuvent subsister dans {value}.',
};

const messageFor = createMessageFormatter(MESSAGES);

/**
 * Le système de fichiers est une dépendance injectable.
 *
 * Pas pour simuler l'écriture — les tests écrivent sur un vrai disque — mais
 * pour pouvoir **provoquer une panne** au milieu d'une génération. Sans ça,
 * l'annulation ne serait vérifiable que par relecture, c'est-à-dire pas
 * vérifiable du tout.
 */
export interface FileSystem {
  isEmptyDir(path: string): Promise<boolean>;
  isSymlink(path: string): Promise<boolean>;
  makeDir(path: string): Promise<void>;
  writeFile(path: string, contents: string, executable: boolean): Promise<void>;
  remove(path: string): Promise<void>;
}

export const nodeFileSystem: FileSystem = {
  async isEmptyDir(path) {
    try {
      // Le dossier .git est toléré : générer dans un dépôt fraîchement
      // initialisé est un usage normal, et le générateur n'y touche pas.
      return (await readdir(path)).filter((entry) => entry !== '.git').length === 0;
    } catch {
      // Un dossier inexistant est vide au sens qui nous intéresse : on peut y aller.
      return true;
    }
  },
  async isSymlink(path) {
    try {
      return (await lstat(path)).isSymbolicLink();
    } catch {
      return false;
    }
  },
  async makeDir(path) {
    await mkdir(path, { recursive: true });
  },
  async writeFile(path, contents, executable) {
    await writeFile(path, contents, 'utf8');
    if (executable) {
      await chmod(path, 0o755);
    }
  },
  async remove(path) {
    await rm(path, { recursive: true, force: true });
  },
};

export interface GenerationReport {
  /** Chemins relatifs écrits, dans l'ordre du plan. */
  readonly written: readonly string[];
  readonly bytes: number;
  readonly rolledBack: boolean;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Les dossiers à créer pour un fichier, du plus proche de la cible au plus
 * profond — c'est l'ordre dans lequel ils doivent être créés, et l'inverse de
 * celui dans lequel il faudra les supprimer.
 */
function ancestorsOf(relativePath: string): string[] {
  const segments = relativePath.split('/').slice(0, -1);
  const ancestors: string[] = [];
  for (let i = 1; i <= segments.length; i += 1) {
    ancestors.push(segments.slice(0, i).join('/'));
  }
  return ancestors;
}

export async function generate(
  plan: FilePlan,
  fs: FileSystem = nodeFileSystem,
): Promise<ParseResult<GenerationReport, GenWriteCode>> {
  if (!(await fs.isEmptyDir(plan.targetDir))) {
    return fail([
      {
        code: 'GEN_TARGET_NOT_EMPTY',
        path: [plan.targetDir],
        message: messageFor('GEN_TARGET_NOT_EMPTY', { value: plan.targetDir }),
      },
    ]);
  }

  // Journal des créations, dans l'ordre. L'annulation le déroule à l'envers :
  // les fichiers avant les dossiers qui les contiennent.
  const journal: string[] = [];
  const createdDirs = new Set<string>();
  const written: string[] = [];
  let bytes = 0;

  async function ensureDir(absolute: string, relative: string): Promise<void> {
    if (createdDirs.has(relative)) {
      return;
    }
    // Un dossier peut être un lien symbolique vers n'importe où. La validation
    // du plan ne peut pas le voir — elle ne travaille que sur des chaînes — donc
    // le contrôle a lieu ici, au dernier moment où il est encore possible.
    if (await fs.isSymlink(absolute)) {
      throw new Error(messageFor('GEN_PATH_TRAVERSAL', { value: relative }));
    }
    const existed = !(await fs.isEmptyDir(absolute)) || (await dirExists(absolute));
    await fs.makeDir(absolute);
    createdDirs.add(relative);
    // Un dossier qui existait déjà n'entre pas au journal : l'annulation ne
    // doit pas supprimer ce que l'utilisateur avait mis là.
    if (!existed) {
      journal.push(absolute);
    }
  }

  async function dirExists(absolute: string): Promise<boolean> {
    try {
      await readdir(absolute);
      return true;
    } catch {
      return false;
    }
  }

  async function rollback(): Promise<string | undefined> {
    for (const path of [...journal].reverse()) {
      try {
        await fs.remove(path);
      } catch (error) {
        return reason(error);
      }
    }
    return undefined;
  }

  try {
    const targetExisted = await dirExists(plan.targetDir);
    await fs.makeDir(plan.targetDir);
    if (!targetExisted) {
      journal.push(plan.targetDir);
    }

    for (const file of plan.files) {
      for (const ancestor of ancestorsOf(file.path)) {
        await ensureDir(join(plan.targetDir, ...ancestor.split('/')), ancestor);
      }

      const absolute = join(plan.targetDir, ...file.path.split('/'));
      await fs.writeFile(absolute, file.contents, file.executable === true);
      journal.push(absolute);
      written.push(file.path);
      bytes += Buffer.byteLength(file.contents, 'utf8');
    }

    return ok({ written, bytes, rolledBack: false });
  } catch (error) {
    const failure = reason(error);
    const rollbackFailure = await rollback();

    const issues: GenWriteIssue[] = [
      {
        code: 'GEN_WRITE_FAILED',
        path: [plan.targetDir],
        message: messageFor('GEN_WRITE_FAILED', {
          value: written.at(-1) ?? plan.targetDir,
          reason: failure,
        }),
      },
    ];

    if (rollbackFailure !== undefined) {
      // L'échec d'origine reste rapporté en premier : c'est lui qui explique
      // pourquoi on en est là. L'échec d'annulation s'ajoute, il ne remplace pas.
      issues.push({
        code: 'GEN_ROLLBACK_FAILED',
        path: [plan.targetDir],
        message: messageFor('GEN_ROLLBACK_FAILED', {
          value: plan.targetDir,
          reason: rollbackFailure,
        }),
      });
    }

    return fail(issues);
  }
}

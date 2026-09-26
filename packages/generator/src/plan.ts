import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';

/**
 * Le plan de fichiers (§22).
 *
 * Rien n'est écrit avant que tout soit décidé. Un générateur qui écrit au fil
 * de sa réflexion ne peut pas être annulé proprement : au moment où il
 * découvre un problème, il a déjà laissé la moitié d'un projet sur le disque.
 *
 * Le dry-run n'est donc pas un mode à part — c'est cette étape-ci, sans la
 * suivante. Un mode « aperçu » séparé finirait par diverger de la génération
 * réelle ; ici c'est le même objet qu'on montre puis qu'on écrit.
 */

export const GEN_ISSUE_CODES = [
  'GEN_EMPTY_PATH',
  'GEN_PATH_TRAVERSAL',
  'GEN_PATH_RESERVED',
  'GEN_BACKSLASH_SEPARATOR',
  'GEN_NOT_A_FILE',
  'GEN_FILE_CONFLICT',
  'GEN_MISSING_SOURCE',
] as const;

export type GenIssueCode = (typeof GEN_ISSUE_CODES)[number];
export type GenIssue = Issue<GenIssueCode>;

const MESSAGES: Readonly<Record<GenIssueCode, string>> = {
  GEN_EMPTY_PATH: 'Un fichier du plan n’a pas de chemin.',
  // Un seul code pour les trois causes — chemin absolu, remontée, lien
  // symbolique — parce que du point de vue de l'utilisateur c'est le même
  // problème : le fichier voulait sortir du dossier cible. Le message dit
  // laquelle des causes s'applique.
  GEN_PATH_RESERVED:
    'Le chemin {value} écrit dans un dossier .git. Un hook ou une configuration Git y exécuterait du code au prochain commit : aucun fichier généré n’y entre.',
  GEN_PATH_TRAVERSAL:
    'Le chemin {value} sort du dossier cible ({cause}). La génération n’écrit jamais en dehors du dossier demandé.',
  GEN_BACKSLASH_SEPARATOR:
    'Le chemin {value} utilise un antislash. Un plan s’écrit avec des séparateurs « / » ; la traduction vers le système de fichiers est faite à l’écriture.',
  GEN_NOT_A_FILE: 'Le chemin {value} désigne un dossier, pas un fichier.',
  GEN_FILE_CONFLICT:
    'Deux fichiers visent {value} : « {first} » et « {second} ». Ils s’écraseraient l’un l’autre.',
  GEN_MISSING_SOURCE:
    'Le fichier {value} n’indique pas son origine. Un fichier sans origine est intraçable dans le rapport de génération.',
};

const messageFor = createMessageFormatter(MESSAGES);

export interface PlannedFile {
  /** Chemin relatif au dossier cible, séparateurs POSIX. */
  readonly path: string;
  readonly contents: string;
  /** Template ou recette à l'origine du fichier — traçabilité (§6.14). */
  readonly source: string;
  /** Bit d'exécution, pour les scripts. */
  readonly executable?: boolean;
}

export interface FilePlan {
  readonly targetDir: string;
  /** Triés par chemin : un plan est reproductible. */
  readonly files: readonly PlannedFile[];
}

/** Détecte une racine absolue, POSIX comme Windows. */
function isAbsolute(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
}

/**
 * Normalise un chemin relatif en résolvant `.` et `..`, et dit s'il sort.
 *
 * La vérification porte sur le chemin **résolu**, pas sur sa forme :
 * `a/../../b` ne commence pas par `..` mais sort quand même du dossier. Se
 * contenter d'interdire un `..` en tête serait une passoire.
 */
function normalizeWithin(path: string): string | undefined {
  const resolved: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (resolved.length === 0) {
        return undefined;
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return resolved.length === 0 ? undefined : resolved.join('/');
}

/**
 * Un segment `.git`, quelle que soit sa casse — macOS et Windows ne la
 * distinguent pas — ni ses points ou espaces finaux, que Windows ignore.
 */
function entersGitDir(path: string): boolean {
  return path.split('/').some((segment) => segment.replace(/[. ]+$/, '').toLowerCase() === '.git');
}

/**
 * Clé d'identité d'un fichier sur le disque : chemin résolu, sans casse.
 *
 * Comparer les chemins tels qu'écrits laisserait passer `lib/./a.ts` contre
 * `lib/a.ts`, ou `README.md` contre `readme.md` sur un disque insensible à la
 * casse : deux écritures du même fichier, la seconde écrasant la première sans
 * conflit signalé.
 */
function identityOf(path: string): string {
  return (normalizeWithin(path) ?? path).toLowerCase();
}

function validateOne(file: PlannedFile): GenIssue[] {
  const issues: GenIssue[] = [];
  const { path } = file;

  if (path.length === 0) {
    return [{ code: 'GEN_EMPTY_PATH', path: [], message: messageFor('GEN_EMPTY_PATH', {}) }];
  }

  if (path.includes('\\')) {
    issues.push({
      code: 'GEN_BACKSLASH_SEPARATOR',
      path: [path],
      message: messageFor('GEN_BACKSLASH_SEPARATOR', { value: path }),
    });
  }

  if (isAbsolute(path)) {
    issues.push({
      code: 'GEN_PATH_TRAVERSAL',
      path: [path],
      message: messageFor('GEN_PATH_TRAVERSAL', { value: path, cause: 'chemin absolu' }),
    });
  } else if (path.endsWith('/')) {
    issues.push({
      code: 'GEN_NOT_A_FILE',
      path: [path],
      message: messageFor('GEN_NOT_A_FILE', { value: path }),
    });
  } else if (normalizeWithin(path) === undefined) {
    issues.push({
      code: 'GEN_PATH_TRAVERSAL',
      path: [path],
      message: messageFor('GEN_PATH_TRAVERSAL', { value: path, cause: 'remontée hors du dossier' }),
    });
  }

  if (entersGitDir(path)) {
    issues.push({
      code: 'GEN_PATH_RESERVED',
      path: [path],
      message: messageFor('GEN_PATH_RESERVED', { value: path }),
    });
  }

  if (file.source.length === 0) {
    issues.push({
      code: 'GEN_MISSING_SOURCE',
      path: [path],
      message: messageFor('GEN_MISSING_SOURCE', { value: path }),
    });
  }

  return issues;
}

/**
 * Construit un plan à partir d'une liste de fichiers, ou refuse.
 *
 * Toutes les règles de sécurité sont appliquées **ici**, avant qu'une seule
 * écriture soit envisagée. C'est le seul endroit où elles peuvent l'être sans
 * qu'un chemin dangereux ait déjà touché le disque.
 */
export function planFiles(
  targetDir: string,
  files: readonly PlannedFile[],
): ParseResult<FilePlan, GenIssueCode> {
  const issues: GenIssue[] = [];

  for (const file of files) {
    issues.push(...validateOne(file));
  }

  const byPath = new Map<string, PlannedFile>();
  for (const file of files) {
    const existing = byPath.get(identityOf(file.path));
    if (existing !== undefined) {
      issues.push({
        code: 'GEN_FILE_CONFLICT',
        path: [file.path],
        message: messageFor('GEN_FILE_CONFLICT', {
          value: file.path,
          first: existing.source,
          second: file.source,
        }),
      });
      continue;
    }
    byPath.set(identityOf(file.path), file);
  }

  if (issues.length > 0) {
    return fail(issues);
  }

  // Tri par chemin : deux exécutions du même pipeline doivent produire le même
  // plan, donc la même arborescence affichée et le même ordre d'écriture.
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  return ok({ targetDir, files: sorted });
}

/** Décrit un plan sous forme d'arborescence — c'est ce que montre le dry-run (§6.12). */
export function describePlan(plan: FilePlan): string {
  if (plan.files.length === 0) {
    return 'Aucun fichier à générer.';
  }

  const lines: string[] = [];
  let previous: string[] = [];

  for (const file of plan.files) {
    const segments = file.path.split('/');
    const directories = segments.slice(0, -1);
    const name = segments.at(-1) ?? file.path;

    for (const [depth, directory] of directories.entries()) {
      if (previous[depth] !== directory) {
        lines.push(`${'  '.repeat(depth)}${directory}/`);
      }
    }
    lines.push(`${'  '.repeat(directories.length)}${name}`);
    previous = directories;
  }

  const count = plan.files.length;
  const total = plan.files.reduce((sum, file) => sum + file.contents.length, 0);
  lines.push('');
  lines.push(`${count} fichier${count > 1 ? 's' : ''}, ${total} caractères.`);

  return lines.join('\n');
}

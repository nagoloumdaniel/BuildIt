import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSafeRelativePath } from '@project-factory/recipes';
import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';
import type { PlannedFile } from './plan.js';
import { renderTemplate, type TemplateContext, type TemplateIssueCode } from './template.js';

/**
 * Template Resolver (§22) : des templates sur le disque aux fichiers du plan.
 *
 * Deux formes de demande :
 * - `directory` — le template d'une fiche certifiée (`frontend/next`). Son
 *   arborescence est recopiée telle quelle à la racine du projet : le template
 *   **est** la forme du projet, sans règle de placement cachée.
 * - `file` — un fichier de recette, rendu vers une cible explicite.
 *
 * Lecture seule : ce module ne touche au disque que pour lire les templates,
 * ce qui garde le dry-run sans écriture.
 */

export const TEMPLATE_LOAD_CODES = [
  'GEN_TEMPLATE_MISSING',
  'GEN_TEMPLATE_BINARY',
  'GEN_TEMPLATE_SYMLINK',
  'GEN_TEMPLATE_PATH_UNSAFE',
] as const;

export type TemplateLoadCode = (typeof TEMPLATE_LOAD_CODES)[number];
export type TemplateLoadIssue = Issue<TemplateLoadCode | TemplateIssueCode>;

const MESSAGES: Readonly<Record<TemplateLoadCode, string>> = {
  GEN_TEMPLATE_MISSING:
    'Le template « {value} » est introuvable ou vide. La fiche ou la recette promet un fichier qui n’existe pas.',
  GEN_TEMPLATE_BINARY:
    'Le template « {value} » est un fichier binaire. Le rendu ne traite que du texte.',
  GEN_TEMPLATE_SYMLINK:
    'Le template « {value} » est un lien symbolique. Un lien peut pointer n’importe où sur la machine : il est refusé.',
  GEN_TEMPLATE_PATH_UNSAFE:
    'Le chemin « {value} » peut sortir de son dossier. Un chemin de template est relatif, en « / », sans « . » ni « .. ».',
};

const messageFor = createMessageFormatter(MESSAGES);

export type TemplateRequest =
  | { readonly kind: 'directory'; readonly template: string }
  | {
      readonly kind: 'file';
      readonly template: string;
      readonly target: string;
      /** Provenance inscrite au plan, par exemple `recipe:stripe-checkout`. */
      readonly origin: string;
    };

function issue(code: TemplateLoadCode, value: string): TemplateLoadIssue {
  return { code, path: [value], message: messageFor(code, { value }) };
}

type Kind = 'file' | 'directory' | 'symlink' | 'other' | 'missing';

function kindOf(path: string): Kind {
  try {
    const stats = lstatSync(path);
    if (stats.isSymbolicLink()) {
      return 'symlink';
    }
    return stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other';
  } catch {
    return 'missing';
  }
}

/** Fichiers d'un dossier, chemins relatifs POSIX, triés. */
function walk(
  root: string,
  relative: string,
  label: string,
  issues: TemplateLoadIssue[],
): string[] {
  const found: string[] = [];
  for (const name of readdirSync(join(root, relative)).sort()) {
    const child = relative === '' ? name : `${relative}/${name}`;
    const kind = kindOf(join(root, child));
    if (kind === 'symlink') {
      issues.push(issue('GEN_TEMPLATE_SYMLINK', `${label}/${child}`));
    } else if (kind === 'directory') {
      found.push(...walk(root, child, label, issues));
    } else if (kind === 'file') {
      found.push(child);
    }
  }
  return found;
}

/** Lit un fichier de template ; un octet nul trahit un binaire. */
function readText(path: string, label: string, issues: TemplateLoadIssue[]): string | undefined {
  const bytes = readFileSync(path);
  if (bytes.includes(0)) {
    issues.push(issue('GEN_TEMPLATE_BINARY', label));
    return undefined;
  }
  return bytes.toString('utf8');
}

function render(
  source: string,
  context: TemplateContext,
  label: string,
  issues: TemplateLoadIssue[],
): string | undefined {
  const rendered = renderTemplate(source, context, label);
  if (!rendered.ok) {
    issues.push(...rendered.issues);
    return undefined;
  }
  return rendered.value;
}

function loadDirectory(
  root: string,
  template: string,
  context: TemplateContext,
  issues: TemplateLoadIssue[],
): PlannedFile[] {
  const directory = join(root, template);
  const kind = kindOf(directory);
  if (kind === 'symlink') {
    issues.push(issue('GEN_TEMPLATE_SYMLINK', template));
    return [];
  }
  const before = issues.length;
  const relatives = kind === 'directory' ? walk(directory, '', template, issues) : [];
  if (relatives.length === 0) {
    // Un dossier qui ne contient qu'un lien refusé a déjà son problème : le
    // dire « vide » en plus serait faux.
    if (issues.length === before) {
      issues.push(issue('GEN_TEMPLATE_MISSING', template));
    }
    return [];
  }

  const files: PlannedFile[] = [];
  for (const relative of relatives) {
    const label = `${template}/${relative}`;
    const source = readText(join(directory, relative), label, issues);
    const contents = source === undefined ? undefined : render(source, context, label, issues);
    if (contents !== undefined) {
      files.push({ path: relative, contents, source: `template:${template}` });
    }
  }
  return files;
}

function loadFile(
  root: string,
  request: Extract<TemplateRequest, { kind: 'file' }>,
  context: TemplateContext,
  issues: TemplateLoadIssue[],
): PlannedFile[] {
  if (!isSafeRelativePath(request.target)) {
    issues.push(issue('GEN_TEMPLATE_PATH_UNSAFE', request.target));
    return [];
  }
  const path = join(root, request.template);
  const kind = kindOf(path);
  if (kind === 'symlink') {
    issues.push(issue('GEN_TEMPLATE_SYMLINK', request.template));
    return [];
  }
  if (kind !== 'file') {
    issues.push(issue('GEN_TEMPLATE_MISSING', request.template));
    return [];
  }
  const source = readText(path, request.template, issues);
  const contents =
    source === undefined ? undefined : render(source, context, request.template, issues);
  return contents === undefined ? [] : [{ path: request.target, contents, source: request.origin }];
}

/**
 * Charge et rend les templates demandés.
 *
 * Tous les problèmes sont rapportés d'un coup. Aucune demande : aucun accès au
 * disque — le générateur n'exige pas de dossier de templates tant qu'aucune
 * fiche certifiée ni recette n'en a besoin.
 */
export function loadTemplateFiles(
  root: string,
  requests: readonly TemplateRequest[],
  context: TemplateContext,
): ParseResult<PlannedFile[], TemplateLoadCode | TemplateIssueCode> {
  const issues: TemplateLoadIssue[] = [];
  const files: PlannedFile[] = [];

  for (const request of requests) {
    if (!isSafeRelativePath(request.template)) {
      issues.push(issue('GEN_TEMPLATE_PATH_UNSAFE', request.template));
      continue;
    }
    files.push(
      ...(request.kind === 'directory'
        ? loadDirectory(root, request.template, context, issues)
        : loadFile(root, request, context, issues)),
    );
  }

  return issues.length > 0 ? fail(issues) : ok(files);
}

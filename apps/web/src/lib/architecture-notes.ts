/**
 * L'architecture d'un projet : des chemins du plan vers un arbre annoté.
 *
 * Deux temps, et deux raisons :
 *
 * 1. **Ranger** (`buildFileTree`). Le moteur ne rend qu'une liste de chemins
 *    (`previewManifestAction`, un dry-run du §22). L'arbre en est une pure
 *    dérivation : aucun contenu inventé, et un ordre qui ne dépend pas de
 *    l'ordre d'arrivée du plan, sinon deux aperçus du même projet se
 *    ressembleraient sans être identiques.
 * 2. **Expliquer** (`noteFor`, `buildArchitecture`). Chaque nœud reçoit, au
 *    plus, une phrase de la base de connaissance (`architecture.notes` du
 *    dictionnaire). La phrase est choisie par motif de chemin, le plus
 *    spécifique l'emporte, et une règle peut exiger qu'un autre fichier existe
 *    dans le même projet : c'est ce qui fait qu'un `app/` de Next.js n'est pas
 *    décrit comme le `app/` d'une application Vite, qui n'y range qu'une
 *    feuille de style.
 *
 * Les règles ne décrivent que ce que le générateur produit vraiment (gabarits
 * de `packages/generator/templates`, fichiers de `scaffold.ts`,
 * `infrastructure.ts`, `monorepo.ts`, `integrations.data.ts`, et les cibles
 * des recettes). Le test de couverture rejoue chaque preset : un dossier ou
 * un fichier racine sans phrase le fait échouer, avec la liste des oubliés.
 */

import type { FR_ARCHITECTURE } from './i18n/messages.architecture';

/** L'identifiant d'une phrase : une clé de `architecture.notes`, vérifiée au typecheck. */
export type NoteId = keyof (typeof FR_ARCHITECTURE)['architecture']['notes'];

export type NodeKind = 'file' | 'directory';

export interface TreeNode {
  /** Le segment, tel quel : c'est ce qui s'affiche. */
  readonly name: string;
  /** Le chemin complet depuis la racine, séparateur `/`. */
  readonly path: string;
  readonly kind: NodeKind;
  /** Vide pour un fichier. Trié : dossiers d'abord, puis par nom. */
  readonly children: readonly TreeNode[];
}

export interface ArchitectureNode extends TreeNode {
  /** Profondeur depuis la racine du projet (0 pour un nœud racine). */
  readonly depth: number;
  /** Les fichiers sous ce nœud, toutes profondeurs ; 1 pour un fichier. */
  readonly fileCount: number;
  /** La phrase du nœud ; absente quand il n'a rien de propre à dire. */
  readonly note?: NoteId;
  readonly children: readonly ArchitectureNode[];
}

/* ------------------------------------------------------------------------ */
/* Ranger                                                                   */
/* ------------------------------------------------------------------------ */

/** Nœud de travail : un `Map` donne l'identité par nom sans doublon. */
interface MutableNode {
  readonly name: string;
  readonly path: string;
  kind: NodeKind;
  readonly children: Map<string, MutableNode>;
}

/**
 * Les segments utiles d'un chemin.
 *
 * `\` est accepté comme séparateur : un plan venu d'une machine Windows ne doit
 * pas produire un fichier nommé `src\app\page.tsx`. Les segments vides (`//`) et
 * les `.` sont ignorés : ce ne sont pas des noms de fichiers.
 */
function segmentsOf(path: string): string[] {
  return path
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
}

/** Dossiers d'abord, puis par nom : l'ordre est une décision, pas un hasard. */
function compare(a: MutableNode, b: MutableNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'directory' ? -1 : 1;
  }
  return a.name.localeCompare(b.name, 'fr');
}

function toNodes(level: ReadonlyMap<string, MutableNode>): readonly TreeNode[] {
  return [...level.values()].sort(compare).map((node) => ({
    name: node.name,
    path: node.path,
    kind: node.kind,
    children: toNodes(node.children),
  }));
}

/**
 * Construit l'arbre d'un plan.
 *
 * Un nom qui apparaît à la fois comme fichier et comme dossier devient un
 * dossier : le cas ne vient pas de `planProject`, mais une entrée inattendue ne
 * doit pas casser l'écran ni dupliquer une branche.
 */
export function buildFileTree(paths: readonly string[]): readonly TreeNode[] {
  const root = new Map<string, MutableNode>();

  for (const raw of paths) {
    const segments = segmentsOf(raw);
    let level = root;
    let prefix = '';

    for (const [index, name] of segments.entries()) {
      const isLast = index === segments.length - 1;
      const path = prefix === '' ? name : `${prefix}/${name}`;
      prefix = path;

      const existing = level.get(name);
      if (existing === undefined) {
        const node: MutableNode = {
          name,
          path,
          kind: isLast ? 'file' : 'directory',
          children: new Map(),
        };
        level.set(name, node);
        level = node.children;
        continue;
      }

      // Un chemin plus profond impose que ce nom soit un dossier.
      if (!isLast && existing.kind === 'file') {
        existing.kind = 'directory';
      }
      level = existing.children;
    }
  }

  return toNodes(root);
}

/** Le nombre de fichiers : ce que l'écran annonce, dossiers exclus. */
export function countFiles(nodes: readonly TreeNode[]): number {
  return nodes.reduce(
    (total, node) => total + (node.kind === 'file' ? 1 : countFiles(node.children)),
    0,
  );
}

/* ------------------------------------------------------------------------ */
/* Expliquer                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Une règle de la base de connaissance.
 *
 * - `match` est un motif de chemin **relatif à son application** (voir
 *   `scopeOf`) : `lib/db.ts` décrit aussi bien `lib/db.ts` d'une application
 *   seule que `apps/web/lib/db.ts` d'un monorepo, parce que c'est le même
 *   fichier, produit par la même intégration. `*` remplace n'importe quelle
 *   suite de caractères dans **un** segment (`next.config.*`, `apps/*`).
 * - `anywhere` : le motif vise le **nom** du nœud, à n'importe quelle
 *   profondeur (`*.test.ts`). Sinon il est ancré sur le chemin entier : le
 *   nombre de segments fixe la profondeur.
 * - `requires` : un motif qui doit désigner un chemin existant **dans la même
 *   application**. C'est la condition de stack : `app/` n'est l'App Router que
 *   là où il y a un `next.config.*`.
 */
export interface NoteRule {
  readonly match: string;
  readonly note: NoteId;
  readonly kind?: NodeKind;
  readonly anywhere?: boolean;
  readonly requires?: string;
}

/**
 * La base, dans l'ordre de lecture de l'arbre. L'ordre ne décide de rien (la
 * spécificité décide, voir `specificity`) sauf à égalité parfaite, où la
 * première règle gagne.
 *
 * Pas de phrase pour un fichier qui n'ajoute rien à celle de son dossier :
 * `components/ui/button.tsx` est dit par `components/ui`, `route.ts` par son
 * segment `[...all]`. Un silence vaut mieux qu'une redite.
 */
export const NOTE_RULES: readonly NoteRule[] = [
  // Racine d'une application (ou du dépôt)
  { match: 'README.md', note: 'readme', kind: 'file' },
  { match: 'package.json', note: 'packageJsonMonorepo', kind: 'file', requires: 'apps/*' },
  { match: 'package.json', note: 'packageJson', kind: 'file' },
  { match: '.gitignore', note: 'gitignore', kind: 'file' },
  { match: '.env.example', note: 'envExample', kind: 'file' },
  { match: 'env.d.ts', note: 'envDts', kind: 'file' },
  { match: 'tsconfig.json', note: 'tsconfig', kind: 'file' },
  { match: 'biome.json', note: 'biome', kind: 'file' },
  {
    match: 'pnpm-workspace.yaml',
    note: 'pnpmWorkspaceMonorepo',
    kind: 'file',
    requires: 'apps/*',
  },
  { match: 'pnpm-workspace.yaml', note: 'pnpmWorkspace', kind: 'file' },
  { match: 'turbo.json', note: 'turbo', kind: 'file' },
  { match: 'Dockerfile', note: 'dockerfile', kind: 'file' },
  { match: '.dockerignore', note: 'dockerignore', kind: 'file' },
  { match: 'docker-compose.yml', note: 'compose', kind: 'file' },
  { match: '.devcontainer', note: 'devcontainer', kind: 'directory' },
  { match: '.github', note: 'github', kind: 'directory' },
  { match: '.github/workflows/*.yml', note: 'ci', kind: 'file' },
  { match: 'next.config.*', note: 'nextConfig', kind: 'file' },
  { match: 'prisma.config.ts', note: 'prismaConfig', kind: 'file' },
  { match: 'playwright.config.ts', note: 'playwrightConfig', kind: 'file' },
  { match: 'instrumentation.ts', note: 'instrumentation', kind: 'file' },
  { match: 'instrumentation-client.ts', note: 'instrumentationClient', kind: 'file' },

  // Next.js (App Router)
  { match: 'app', note: 'appRouter', kind: 'directory', requires: 'next.config.*' },
  { match: 'app', note: 'appStyles', kind: 'directory' },
  { match: 'app/layout.tsx', note: 'rootLayout', kind: 'file' },
  { match: 'app/page.tsx', note: 'homePage', kind: 'file' },
  { match: 'app/globals.css', note: 'globalsCss', kind: 'file' },
  { match: 'app/api', note: 'apiRoutes', kind: 'directory' },
  { match: 'app/api/auth', note: 'authRoute', kind: 'directory' },
  { match: 'app/api/auth/[...all]', note: 'catchAll', kind: 'directory' },
  { match: 'app/status', note: 'statusPage', kind: 'directory' },
  { match: 'app/dashboard', note: 'dashboard', kind: 'directory' },
  { match: 'app/dashboard/users', note: 'dashboardUsers', kind: 'directory' },
  { match: 'app/dashboard/settings', note: 'dashboardSettings', kind: 'directory' },
  { match: 'app/sign-in', note: 'signIn', kind: 'directory' },
  { match: 'components', note: 'components', kind: 'directory' },
  { match: 'components/ui', note: 'componentsUi', kind: 'directory' },
  { match: 'components/dashboard', note: 'componentsDashboard', kind: 'directory' },

  // lib/
  { match: 'lib', note: 'lib', kind: 'directory' },
  { match: 'lib/db.ts', note: 'db', kind: 'file' },
  { match: 'lib/auth.ts', note: 'auth', kind: 'file' },
  { match: 'lib/auth-client.ts', note: 'authClient', kind: 'file' },
  { match: 'lib/utils.ts', note: 'utils', kind: 'file' },
  { match: 'lib/redis.ts', note: 'redis', kind: 'file' },
  { match: 'lib/api.ts', note: 'apiClient', kind: 'file' },
  { match: 'lib/observability', note: 'observability', kind: 'directory' },
  { match: 'lib/observability/sentry.client.ts', note: 'sentryClient', kind: 'file' },
  { match: 'lib/observability/posthog.client.ts', note: 'posthogClient', kind: 'file' },
  { match: 'lib/email.ts', note: 'email', kind: 'file' },
  { match: 'lib/stripe', note: 'stripe', kind: 'directory' },
  { match: 'lib/stripe/checkout.ts', note: 'checkout', kind: 'file' },
  { match: 'lib/dashboard.ts', note: 'dashboardData', kind: 'file' },
  { match: 'lib/signups.ts', note: 'signups', kind: 'file' },

  // Prisma
  { match: 'prisma', note: 'prisma', kind: 'directory' },
  { match: 'prisma/schema/schema.prisma', note: 'schemaPrisma', kind: 'file' },
  { match: 'prisma/schema/auth.prisma', note: 'authPrisma', kind: 'file' },

  // Tests
  { match: '*.test.ts', note: 'unitTest', kind: 'file', anywhere: true },
  { match: 'e2e', note: 'e2e', kind: 'directory' },
  { match: 'e2e/home.e2e.ts', note: 'homeE2e', kind: 'file' },

  // Serveur Hono : `src/app.ts` ne vient que de son gabarit.
  { match: 'src', note: 'honoSrc', kind: 'directory', requires: 'src/app.ts' },
  { match: 'src/app.ts', note: 'honoApp', kind: 'file' },
  { match: 'src/index.ts', note: 'honoIndex', kind: 'file', requires: 'src/app.ts' },
  { match: 'src/app.test.ts', note: 'honoTest', kind: 'file' },
  { match: 'src/contract.test.ts', note: 'contractTest', kind: 'file' },

  // Monorepo
  { match: 'apps', note: 'apps', kind: 'directory' },
  { match: 'apps/web', note: 'appWeb', kind: 'directory' },
  { match: 'apps/api', note: 'appApi', kind: 'directory' },
  { match: 'packages', note: 'packages', kind: 'directory' },
  { match: 'packages/shared', note: 'shared', kind: 'directory' },
  // Squelette d'architecture (docs, ADR, dossiers de base)
  { match: 'CONTRIBUTING.md', note: 'contributing', kind: 'file' },
  { match: 'SECURITY.md', note: 'security', kind: 'file' },
  { match: 'docs', note: 'docs', kind: 'directory' },
  { match: 'docs/architecture', note: 'docsArchitecture', kind: 'directory' },
  { match: 'docs/decisions', note: 'docsDecisions', kind: 'directory' },
  { match: 'features', note: 'features', kind: 'directory' },
  { match: 'src/features', note: 'features', kind: 'directory' },
  { match: 'shared', note: 'sharedCode', kind: 'directory' },
  { match: 'src/shared', note: 'sharedCode', kind: 'directory' },
  { match: 'modules', note: 'modules', kind: 'directory' },
  { match: 'src/modules', note: 'modules', kind: 'directory' },
  { match: 'platform', note: 'platform', kind: 'directory' },
  { match: 'src/platform', note: 'platform', kind: 'directory' },
  { match: 'events', note: 'events', kind: 'directory' },
  { match: 'src/events', note: 'events', kind: 'directory' },
  { match: 'infra', note: 'infra', kind: 'directory' },
  { match: 'infra/environments', note: 'environments', kind: 'directory' },
  { match: 'tests', note: 'crossTests', kind: 'directory' },
  { match: 'services', note: 'services', kind: 'directory' },
  { match: 'functions', note: 'functions', kind: 'directory' },
  { match: 'packages/contracts', note: 'contracts', kind: 'directory' },
  { match: 'packages/event-contracts', note: 'eventContracts', kind: 'directory' },
];

/** Les dossiers dont chaque enfant est une application à part entière. */
const SCOPE_ROOTS = new Set(['apps', 'packages']);

export interface Scope {
  /** Le préfixe de l'application (`apps/web`), vide pour la racine du dépôt. */
  readonly prefix: string;
  /** Le chemin vu depuis l'application. */
  readonly relative: string;
}

/**
 * L'application à laquelle appartient un chemin.
 *
 * Dans un monorepo, `apps/web/lib/db.ts` est le `lib/db.ts` de l'application
 * web : même fichier, même rôle. `apps/web` lui-même reste un chemin de la
 * racine : c'est le dossier de l'application, pas un de ses fichiers.
 */
export function scopeOf(path: string): Scope {
  const segments = segmentsOf(path);
  const [first, second] = segments;
  if (
    first !== undefined &&
    second !== undefined &&
    segments.length > 2 &&
    SCOPE_ROOTS.has(first)
  ) {
    return { prefix: `${first}/${second}`, relative: segments.slice(2).join('/') };
  }
  return { prefix: '', relative: segments.join('/') };
}

const patternCache = new Map<string, RegExp>();

/** `*` couvre un morceau de segment, jamais un `/` : `apps/*` n'atteint pas `apps/web/lib`. */
function patternOf(glob: string): RegExp {
  const cached = patternCache.get(glob);
  if (cached !== undefined) {
    return cached;
  }
  const source = glob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
  const pattern = new RegExp(`^${source}$`);
  patternCache.set(glob, pattern);
  return pattern;
}

/**
 * Plus une règle est précise, plus elle pèse : ancrée avant « n'importe où »,
 * puis plus de caractères littéraux, puis conditionnée avant libre. `app` sous
 * condition (`next.config.*`) l'emporte donc sur `app` tout court quand la
 * condition tient, et `src/app.test.ts` sur `*.test.ts`.
 */
function specificity(rule: NoteRule): number {
  const literal = rule.match.replaceAll('*', '').length;
  return (
    (rule.anywhere === true ? 0 : 10_000) + literal * 10 + (rule.requires === undefined ? 0 : 1)
  );
}

/** Ce qu'il faut connaître du plan pour évaluer une condition `requires`. */
export interface PlanIndex {
  /** Tous les chemins du plan, fichiers **et** dossiers intermédiaires. */
  readonly paths: ReadonlySet<string>;
}

/** Indexe un plan : chaque fichier, et chacun de ses dossiers parents. */
export function indexPlan(files: readonly string[]): PlanIndex {
  const paths = new Set<string>();
  for (const file of files) {
    const segments = segmentsOf(file);
    for (let end = 1; end <= segments.length; end += 1) {
      paths.add(segments.slice(0, end).join('/'));
    }
  }
  return { paths };
}

/** La condition tient-elle dans **cette** application du plan ? */
function satisfied(requires: string, scope: Scope, index: PlanIndex): boolean {
  const pattern = patternOf(requires);
  const prefix = scope.prefix === '' ? '' : `${scope.prefix}/`;
  for (const path of index.paths) {
    if (path.startsWith(prefix) && pattern.test(path.slice(prefix.length))) {
      return true;
    }
  }
  return false;
}

/** Une règle s'applique-t-elle à ce nœud, sans regarder la condition ? */
function matches(rule: NoteRule, relative: string, kind: NodeKind): boolean {
  if (rule.kind !== undefined && rule.kind !== kind) {
    return false;
  }
  if (rule.anywhere === true) {
    const name = relative.slice(relative.lastIndexOf('/') + 1);
    return patternOf(rule.match).test(name);
  }
  return patternOf(rule.match).test(relative);
}

/**
 * La phrase d'un chemin : la règle la plus spécifique qui s'applique, ou rien.
 *
 * `rules` est injectable pour les tests ; l'écran passe la base par défaut.
 */
export function noteFor(
  path: string,
  kind: NodeKind,
  index: PlanIndex,
  rules: readonly NoteRule[] = NOTE_RULES,
): NoteId | undefined {
  const scope = scopeOf(path);
  let best: { readonly rule: NoteRule; readonly score: number } | undefined;
  for (const rule of rules) {
    if (!matches(rule, scope.relative, kind)) {
      continue;
    }
    if (rule.requires !== undefined && !satisfied(rule.requires, scope, index)) {
      continue;
    }
    const score = specificity(rule);
    if (best === undefined || score > best.score) {
      best = { rule, score };
    }
  }
  return best?.rule.note;
}

function annotate(
  nodes: readonly TreeNode[],
  depth: number,
  index: PlanIndex,
  inherited: ReadonlySet<NoteId>,
  rules: readonly NoteRule[],
): readonly ArchitectureNode[] {
  return nodes.map((node) => {
    const found = noteFor(node.path, node.kind, index, rules);
    // Une phrase déjà dite par un ancêtre ne se répète pas plus bas.
    const note = found === undefined || inherited.has(found) ? undefined : found;
    const below = note === undefined ? inherited : new Set([...inherited, note]);
    const children = annotate(node.children, depth + 1, index, below, rules);
    return {
      name: node.name,
      path: node.path,
      kind: node.kind,
      depth,
      fileCount:
        node.kind === 'file' ? 1 : children.reduce((total, child) => total + child.fileCount, 0),
      ...(note === undefined ? {} : { note }),
      children,
    };
  });
}

/** Le plan entier, rangé et expliqué : ce que l'écran affiche. */
export function buildArchitecture(
  files: readonly string[],
  rules: readonly NoteRule[] = NOTE_RULES,
): readonly ArchitectureNode[] {
  return annotate(buildFileTree(files), 0, indexPlan(files), new Set(), rules);
}

/** Les chemins de tous les dossiers d'un arbre, profondeur d'abord. */
export function directoryPaths(nodes: readonly TreeNode[]): readonly string[] {
  return nodes.flatMap((node) =>
    node.kind === 'directory' ? [node.path, ...directoryPaths(node.children)] : [],
  );
}

/**
 * Les dossiers ouverts à l'arrivée : ceux de la racine. On voit d'un coup
 * d'œil ce qu'ils contiennent sans être noyé sous les branches profondes,
 * qui restent repliées.
 */
export function initiallyOpen(nodes: readonly TreeNode[]): ReadonlySet<string> {
  return new Set(nodes.filter((node) => node.kind === 'directory').map((node) => node.path));
}

/** Les nœuds racine (dossiers et fichiers) qu'aucune règle ne décrit. */
export function uncoveredRoots(nodes: readonly ArchitectureNode[]): readonly string[] {
  return nodes.filter((node) => node.note === undefined).map((node) => node.path);
}

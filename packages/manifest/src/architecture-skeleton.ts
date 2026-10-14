import type { Architecture } from './schema/enums.js';

/**
 * Le squelette de dossiers propre à chaque architecture.
 *
 * Donnée pure, sans `fs` : le générateur en tire les README posés dans le
 * projet, et l'écran Architecture de l'assistant en tire son aperçu
 * d'arborescence une seule source, donc jamais deux versions qui divergent.
 *
 * Trois niveaux distincts, à ne pas confondre :
 * - l'organisation du dépôt (monorepo : `apps/`, `packages/`, `infra/`) ;
 * - l'architecture du code (modules hexagonaux, front par fonctionnalités) ;
 * - le runtime (services, fonctions, flux d'événements).
 *
 * Principe : ne créer que les dossiers qui portent une responsabilité réelle.
 * Le code applicatif lui-même vient des templates, qui gardent la main.
 */

export interface SkeletonDir {
  /** Chemin relatif à la racine du projet, séparateurs POSIX, sans `/` final. */
  readonly path: string;
  /** Sa responsabilité et sa règle de dépendance, en une phrase. */
  readonly role: string;
}

export interface SkeletonStack {
  /** Un framework frontend est choisi. */
  readonly frontend: boolean;
  /** Un framework backend est choisi. */
  readonly backend: boolean;
}

const DOCS: readonly SkeletonDir[] = [
  {
    path: 'docs/architecture',
    role: 'Vue d’ensemble de l’architecture : arborescence, frontières et flux principaux.',
  },
  {
    path: 'docs/decisions',
    role: 'Décisions d’architecture (ADR) : une décision par fichier, jamais réécrite, seulement remplacée.',
  },
];

/** Front organisé par fonctionnalités. */
function frontend(base: string): SkeletonDir[] {
  return [
    {
      path: `${base}src/features`,
      role: 'Une fonctionnalité par dossier (components, api, tests). Une fonctionnalité n’importe pas une autre : ce qui est commun monte dans shared.',
    },
    {
      path: `${base}src/shared/ui`,
      role: 'Composants d’interface génériques, sans logique métier ni appel réseau.',
    },
    {
      path: `${base}src/shared/lib`,
      role: 'Utilitaires purs partagés par les fonctionnalités. Ne dépend d’aucune fonctionnalité.',
    },
  ];
}

/** Back en monolithe modulaire hexagonal. */
function modules(base: string): SkeletonDir[] {
  const module = `${base}src/modules/example`;
  return [
    {
      path: `${base}src/modules`,
      role: 'Un module métier par dossier. Un module n’atteint un autre que par son API publique, jamais par ses fichiers internes.',
    },
    {
      path: `${module}/domain`,
      role: 'Règles métier pures : entités, valeurs, invariants. N’importe aucun framework, aucune base, aucun réseau.',
    },
    {
      path: `${module}/application`,
      role: 'Cas d’usage (use-cases) et ports (interfaces) dont ils ont besoin. Dépend du domaine, jamais des adaptateurs.',
    },
    {
      path: `${module}/adapters`,
      role: 'Adaptateurs entrants (HTTP, jobs) et sortants (base, API tierces) qui implémentent les ports.',
    },
    {
      path: `${base}src/platform`,
      role: 'Socle technique partagé : connexion base de données, observabilité. Aucune règle métier ici.',
    },
  ];
}

const ENVIRONMENTS: readonly SkeletonDir[] = ['development', 'staging', 'production'].map(
  (env) => ({
    path: `infra/environments/${env}`,
    role: `Configuration d’infrastructure de l’environnement ${env}. Aucun secret en clair.`,
  }),
);

const EVENT_CONTRACTS: SkeletonDir = {
  path: 'packages/event-contracts',
  role: 'Schémas versionnés des événements échangés. Seule dépendance commune entre producteurs et consommateurs.',
};

export function skeletonTree(
  architecture: Architecture,
  stack: SkeletonStack,
): readonly SkeletonDir[] {
  const dirs: SkeletonDir[] = [];
  switch (architecture) {
    case 'single-app':
      if (stack.frontend) dirs.push(...frontend(''));
      if (stack.backend || !stack.frontend) dirs.push(...modules(''));
      break;
    case 'modular-monolith':
      if (stack.frontend) dirs.push(...frontend(''));
      dirs.push(...modules(''));
      break;
    case 'monorepo':
      if (stack.frontend) dirs.push(...frontend('apps/web/'));
      if (stack.backend) dirs.push(...modules('apps/api/'));
      // Un contrat partagé n'a de sens qu'entre deux applications.
      if (stack.frontend && stack.backend) {
        dirs.push({
          path: 'packages/contracts',
          role: 'Contrats partagés entre applications (types, schémas d’API). Ne dépend d’aucune application.',
        });
      }
      dirs.push(
        ...ENVIRONMENTS,
        {
          path: 'tests/integration',
          role: 'Tests qui traversent plusieurs applications ou paquets.',
        },
        {
          path: 'tests/e2e',
          role: 'Parcours utilisateur de bout en bout, sur le produit déployé.',
        },
      );
      break;
    case 'microservices':
      dirs.push(
        {
          path: 'services/gateway',
          role: 'Point d’entrée unique : routage, authentification, limitation de débit. Aucune règle métier.',
        },
        {
          path: 'services/example-service/src/domain',
          role: 'Domaine du service, isolé : il possède ses données et ne lit jamais la base d’un autre service.',
        },
        {
          path: 'services/example-service/src/api',
          role: 'API exposée par le service (HTTP ou RPC), seule porte d’entrée vers son domaine.',
        },
        EVENT_CONTRACTS,
        ...ENVIRONMENTS,
      );
      break;
    case 'serverless':
      dirs.push(
        {
          path: 'functions/http',
          role: 'Fonctions déclenchées par une requête HTTP. Courtes et sans état.',
        },
        {
          path: 'functions/events',
          role: 'Fonctions déclenchées par un événement (file, stockage, webhook).',
        },
        {
          path: 'functions/scheduled',
          role: 'Fonctions planifiées (cron). Idempotentes : rejouables sans effet de bord.',
        },
        ...ENVIRONMENTS,
      );
      break;
    case 'event-driven':
      dirs.push(
        ...modules(''),
        {
          path: 'src/events/producers',
          role: 'Publication des événements, toujours via l’outbox.',
        },
        {
          path: 'src/events/consumers',
          role: 'Consommateurs idempotents : un même événement traité deux fois ne change rien.',
        },
        {
          path: 'src/events/outbox',
          role: 'Outbox transactionnelle : l’événement est écrit dans la même transaction que la donnée.',
        },
        {
          path: 'src/events/dead-letter',
          role: 'Événements en échec après les nouvelles tentatives, à rejouer ou analyser.',
        },
        EVENT_CONTRACTS,
      );
      break;
  }
  return [...dirs, ...DOCS];
}

/**
 * Retire `shared/ui` et `shared/lib` quand l'application a déjà son
 * équivalent : `components/` (pour `shared/ui`) ou `lib/` (pour `shared/lib`),
 * au même niveau que `shared/` ou à la racine de l'application (au-dessus de
 * `src/`). Next.js pose `components/` et `lib/` : pas de doublon.
 *
 * `existsDir` reçoit un chemin de dossier relatif POSIX, sans `/` final.
 */
export function withoutDuplicateShared(
  dirs: readonly SkeletonDir[],
  existsDir: (path: string) => boolean,
): SkeletonDir[] {
  const twins: Record<string, string> = { ui: 'components', lib: 'lib' };
  return dirs.filter((dir) => {
    const match = /^(.*?)shared\/(ui|lib)$/.exec(dir.path);
    if (match === null) return true;
    const root = match[1] ?? '';
    const twin = twins[match[2] ?? ''] ?? '';
    const candidates = [`${root}${twin}`];
    if (root.endsWith('src/')) candidates.push(`${root.slice(0, -'src/'.length)}${twin}`);
    return !candidates.some((path) => existsDir(path));
  });
}

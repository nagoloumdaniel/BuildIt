import { resolve } from '@buildit/compatibility';
import {
  type Architecture,
  MANIFEST_VERSION,
  type Manifest,
  parseManifest,
  type Target,
} from '@buildit/manifest';
import {
  loadCatalogue,
  type Registry,
  type RegistryEntry,
  RUNTIME_ECOSYSTEMS,
  slotFor,
  UI_ECOSYSTEMS,
} from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { INTEGRATIONS } from './integrations.data.js';
import { planProject } from './pipeline.js';

/**
 * Couverture de génération du catalogue entier.
 *
 * Chaque fiche du registry est planifiée au moins une fois, dans la plus petite
 * sélection valide qui la contient, par le chemin exact qu'emprunte le
 * configurateur web : sélection → `resolve` (compatibility) → placement dans le
 * manifest → `parseManifest` → `planProject`. Puis des combinaisons réalistes,
 * par écosystème, vérifient que les fiches tiennent ensemble.
 *
 * Ce que ce test prouve, et rien de plus : chaque technologie produit un plan
 * de fichiers **cohérent** — manifest valide, combinaison acceptée par le
 * moteur, dépendances npm sans conflit de plages, aucun fichier réclamé deux
 * fois, aucun script en double. C'est un dry-run (§22) : rien n'est écrit,
 * rien n'est installé, rien n'est compilé. La compilation réelle reste le
 * travail du test de fumée (`socle.smoke.ts`), qui ne couvre que les fiches
 * certifiées.
 */

const loaded = loadCatalogue();
if (!loaded.ok) {
  throw new Error(`Catalogue illisible : ${loaded.issues.map((issue) => issue.code).join(', ')}`);
}
const registry: Registry = loaded.value;
const ENTRIES: readonly RegistryEntry[] = registry.entries();

function entry(id: string): RegistryEntry {
  const found = registry.get(id);
  if (found === undefined) {
    throw new Error(`fiche absente du catalogue : ${id}`);
  }
  return found;
}

/**
 * Le socle d'une application web, par moteur d'interface. Un framework et son
 * langage : le minimum que le schéma du manifest exige pour `frontend`.
 */
const WEB_BASE: Readonly<Record<(typeof UI_ECOSYSTEMS)[number], readonly string[]>> = {
  react: ['next', 'typescript'],
  vue: ['nuxt', 'typescript'],
  svelte: ['sveltekit', 'typescript'],
  angular: ['angular', 'typescript'],
  solid: ['solidjs', 'typescript'],
  qwik: ['qwik', 'typescript'],
  preact: ['preact', 'typescript'],
  html: ['htmx', 'javascript'],
};

/**
 * Le socle d'une API, par runtime : le backend et son langage. `.NET` n'a
 * aucun backend au catalogue — C# n'a donc aucun socle (voir plus bas).
 */
const API_BASE: Readonly<
  Record<(typeof RUNTIME_ECOSYSTEMS)[number], readonly string[] | undefined>
> = {
  node: ['hono', 'typescript'],
  python: ['fastapi', 'python'],
  go: ['gin', 'go'],
  rust: ['axum', 'rust'],
  php: ['laravel', 'php'],
  ruby: ['rails', 'ruby'],
  jvm: ['spring-boot', 'java'],
  dotnet: undefined,
};

/** Les catégories dont un projet n'a qu'un représentant (`arity.ts`). */
const EXCLUSIVE = new Set(['frontend', 'backend', 'database', 'orm', 'authentication']);

function uiOf(item: RegistryEntry): (typeof UI_ECOSYSTEMS)[number] | undefined {
  return UI_ECOSYSTEMS.find((value) => item.ecosystems?.includes(value));
}

function runtimeOf(item: RegistryEntry): (typeof RUNTIME_ECOSYSTEMS)[number] | undefined {
  return RUNTIME_ECOSYSTEMS.find((value) => item.ecosystems?.includes(value));
}

/** Les `requires` d'une fiche, transitivement — ce que le moteur ajoutera. */
function closure(id: string, seen: Set<string> = new Set()): Set<string> {
  if (!seen.has(id)) {
    seen.add(id);
    for (const required of entry(id).requires ?? []) {
      closure(required, seen);
    }
  }
  return seen;
}

interface Draft {
  readonly targets: readonly Target[];
  readonly technologies: readonly string[];
  readonly architecture?: Architecture;
}

/**
 * La plus petite sélection valide qui contient `item`.
 *
 * Une fiche liée à un runtime serveur (Prisma, Django ORM, Gin…) vit dans une
 * API de ce runtime ; une fiche liée à un moteur d'interface (Vuetify, Pinia…)
 * dans une application web de ce moteur ; une fiche agnostique dans une
 * application Next.js. Le socle cède la place quand la fiche — ou ce qu'elle
 * exige — occupe déjà une catégorie exclusive (Django ORM amène Django, qui
 * remplace FastAPI).
 */
function minimalDraft(item: RegistryEntry): Draft | undefined {
  const runtime = runtimeOf(item);
  const onApi = runtime !== undefined || !item.targets.includes('web');
  let base: readonly string[] | undefined;
  if (onApi) {
    base = API_BASE[runtime ?? 'node'];
  } else if (item.category === 'language') {
    // Un langage choisi seul : un framework qui n'en impose pas d'autre.
    base = ['react'];
  } else {
    base = WEB_BASE[uiOf(item) ?? 'react'];
  }
  if (base === undefined) {
    return undefined;
  }

  const wanted = closure(item.id);
  const taken = new Set([...wanted].map((id) => entry(id).category));
  const kept = base.filter((id) => {
    const category = entry(id).category;
    if (item.category === 'language' && category === 'language') {
      return false;
    }
    return !(EXCLUSIVE.has(category) && taken.has(category));
  });

  const technologies = new Set([...kept, ...wanted]);
  // Un ORM sans base n'est pas un manifest valide : `database.engine` est requis.
  if (item.category === 'orm') {
    technologies.add(item.id === 'mongoose' ? 'mongodb' : 'postgresql');
  }
  return { targets: [onApi ? 'api' : 'web'], technologies: [...technologies] };
}

/** Les applications du §10 et la cible qui les fait exister. */
const APPS = [
  { key: 'frontend', target: 'web', fields: ['framework', 'language', 'styling', 'ui'] },
  { key: 'backend', target: 'api', fields: ['framework', 'language'] },
] as const;

type AppValues = Partial<Record<'framework' | 'language' | 'styling' | 'ui', string>>;

/**
 * Le placement de `apps/web/src/lib/draft-to-manifest.ts`, réduit aux cibles
 * que le catalogue sait servir (web, api).
 *
 * Recopié ici plutôt qu'importé : le générateur ne dépend pas de l'application
 * web. La règle elle-même — catégorie → emplacement — n'est pas recopiée, elle
 * vient de `slotFor` dans le registry, comme côté web.
 */
function toManifest(draft: Draft, ids: readonly string[]): Manifest {
  const targets = new Set<string>(draft.targets);
  const apps: Record<'frontend' | 'backend', AppValues> = { frontend: {}, backend: {} };
  const singles: Partial<Record<'engine' | 'orm' | 'provider', string>> = {};
  const lists = {
    services: new Set<string>(),
    quality: new Set<string>(),
    infra: new Set<string>(),
  };

  for (const id of [...ids].sort()) {
    const item = entry(id);
    const slot = slotFor(item.category);
    if (slot.kind === 'list') {
      lists[slot.field].add(id);
      continue;
    }
    if (slot.kind === 'single') {
      if (singles[slot.field] === undefined) {
        singles[slot.field] = id;
      } else {
        lists.services.add(id);
      }
      continue;
    }
    let placed = false;
    for (const app of APPS) {
      const accepts = (app.fields as readonly string[]).includes(slot.field);
      if (!targets.has(app.target) || !accepts || !item.targets.includes(app.target)) {
        continue;
      }
      if (apps[app.key][slot.field] !== undefined) {
        continue;
      }
      apps[app.key][slot.field] = id;
      placed = true;
    }
    if (!placed) {
      lists.services.add(id);
    }
  }

  const raw: Record<string, unknown> = {
    manifestVersion: MANIFEST_VERSION,
    name: 'couverture',
    targets: [...draft.targets],
    architecture: draft.architecture ?? 'single-app',
  };
  for (const app of APPS) {
    if (targets.has(app.target)) {
      raw[app.key] = apps[app.key];
    }
  }
  if (singles.engine !== undefined || singles.orm !== undefined) {
    raw['database'] = {
      ...(singles.engine === undefined ? {} : { engine: singles.engine }),
      ...(singles.orm === undefined ? {} : { orm: singles.orm }),
    };
  }
  if (singles.provider !== undefined) {
    raw['auth'] = { provider: singles.provider };
  }
  for (const field of ['services', 'quality', 'infra'] as const) {
    if (lists[field].size > 0) {
      raw[field] = [...lists[field]].sort();
    }
  }

  const parsed = parseManifest(raw);
  if (!parsed.ok) {
    throw new Error(
      `manifest refusé : ${parsed.issues.map((issue) => `${issue.code} ${issue.message}`).join(' | ')}`,
    );
  }
  return parsed.value;
}

/**
 * Le chemin complet d'une sélection jusqu'au plan. Lève avec les codes et les
 * messages de l'étage qui refuse : un échec doit dire quelle fiche et pourquoi.
 */
function planDraft(draft: Draft) {
  const resolution = resolve(
    { targets: draft.targets, technologies: draft.technologies },
    registry,
  );
  if (!resolution.ok) {
    throw new Error(
      `résolution refusée : ${resolution.issues.map((issue) => `${issue.code} ${issue.message}`).join(' | ')}`,
    );
  }
  const manifest = toManifest(draft, resolution.value.technologies);
  const planned = planProject(manifest, '/couverture', {
    registry,
    now: new Date('2026-01-01T00:00:00Z'),
  });
  if (!planned.ok) {
    throw new Error(
      `plan refusé : ${planned.issues.map((issue) => `${issue.code} ${issue.message}`).join(' | ')}`,
    );
  }
  return { resolution: resolution.value, manifest, plan: planned.value };
}

/**
 * Paquets npm qui ne fonctionnent que sous un framework : les poser dans un
 * projet qui n'a pas ce framework livre une dépendance morte, voire un import
 * qui casse (`@sentry/nextjs` dans une API FastAPI, `next-auth` dans
 * SvelteKit). Données de test, pas de produit : elles décrivent les paquets
 * que le catalogue publie aujourd'hui.
 */
const REACT_FRONTENDS = ['next', 'react', 'remix', 'preact'];
const FRAMEWORK_BOUND_PACKAGES: Readonly<Record<string, readonly string[]>> = {
  next: ['next'],
  '@sentry/nextjs': ['next'],
  '@clerk/nextjs': ['next'],
  'next-auth': ['next'],
  react: REACT_FRONTENDS,
  '@tanstack/react-query': REACT_FRONTENDS,
  'react-hook-form': REACT_FRONTENDS,
  '@testing-library/react': REACT_FRONTENDS,
  '@mui/material': REACT_FRONTENDS,
  '@mantine/core': REACT_FRONTENDS,
};

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Cohérence d'un plan, au-delà de « le pipeline n'a rien refusé » : ce que le
 * catalogue promet pour chaque fiche résolue doit se retrouver dans les
 * fichiers. Un plan accepté mais qui oublierait un paquet, une variable
 * d'environnement ou lancerait en CI un script absent serait un faux positif.
 */
function expectCoherentPlan(
  files: readonly { path: string; contents: string }[],
  technologies: readonly string[],
): void {
  const byPath = new Map(files.map((file) => [file.path, file.contents]));
  const manifests = files
    .filter((file) => file.path === 'package.json' || file.path.endsWith('/package.json'))
    .map((file) => JSON.parse(file.contents) as PackageJson);
  expect(manifests.length).toBeGreaterThan(0);

  const installed = new Set<string>();
  for (const pkg of manifests) {
    const production = Object.keys(pkg.dependencies ?? {});
    const development = new Set(Object.keys(pkg.devDependencies ?? {}));
    // Un paquet n'a qu'un rôle : le package.json ne peut pas le porter deux fois.
    expect(production.filter((name) => development.has(name))).toEqual([]);
    for (const name of [...production, ...development]) {
      installed.add(name);
    }
    for (const [script, command] of Object.entries(pkg.scripts ?? {})) {
      expect(command.trim(), `script ${script} vide`).not.toBe('');
    }
  }

  const env = [...byPath.entries()]
    .filter(([path]) => path === '.env.example' || path.endsWith('/.env.example'))
    .map(([, contents]) => contents)
    .join('\n');
  const readme = byPath.get('README.md') ?? '';

  for (const id of technologies) {
    const item = entry(id);
    for (const name of [...(item.packages ?? []), ...(item.devPackages ?? [])]) {
      expect(installed, `${id} : paquet ${name} absent du package.json`).toContain(name);
    }
    for (const name of item.env ?? []) {
      expect(env, `${id} : variable ${name} absente de .env.example`).toContain(name);
    }
    expect(readme, `${id} absent du README`).toContain(item.name);
  }

  const stack = new Set(technologies);
  for (const name of installed) {
    const frameworks = FRAMEWORK_BOUND_PACKAGES[name];
    if (frameworks !== undefined) {
      expect(
        frameworks.some((id) => stack.has(id)),
        `${name} posé sans ${frameworks.join(' ni ')}`,
      ).toBe(true);
    }
  }

  // La CI ne lance que des scripts qui existent à la racine.
  const ci = byPath.get('.github/workflows/ci.yml');
  const root = JSON.parse(byPath.get('package.json') ?? '{}') as PackageJson;
  if (ci !== undefined) {
    for (const match of ci.matchAll(/^\s*- run: pnpm run (\S+)/gm)) {
      expect(Object.keys(root.scripts ?? {}), `CI : script ${match[1]} absent`).toContain(match[1]);
    }
  }
}

/**
 * Les fiches qu'aucun manifest ne peut porter, avec la raison. Liste fermée et
 * vérifiée : une fiche qui deviendrait plaçable doit en sortir.
 */
const UNPLACEABLE: Readonly<Record<string, string>> = {
  // C# ne vise que `api`, et le catalogue n'a aucun backend .NET : le schéma
  // exige `backend.framework`, et tout backend existant déclare un autre
  // runtime (COMPAT_ECOSYSTEM_MISMATCH). Il redeviendra plaçable avec une
  // fiche ASP.NET Core.
  csharp: 'aucun backend .NET au catalogue',
};

describe('couverture du catalogue : chaque fiche se planifie', () => {
  it('le catalogue est entièrement couvert', () => {
    expect(ENTRIES.length).toBeGreaterThanOrEqual(283);
    const uncovered = ENTRIES.filter(
      (item) => minimalDraft(item) === undefined && UNPLACEABLE[item.id] === undefined,
    );
    expect(uncovered.map((item) => item.id)).toEqual([]);
  });

  it.each(Object.keys(UNPLACEABLE))('%s reste sans socle, pour la raison déclarée', (id) => {
    expect(minimalDraft(entry(id))).toBeUndefined();
  });

  const placeable = ENTRIES.filter((item) => UNPLACEABLE[item.id] === undefined);

  it.each(placeable.map((item) => [item.id, item] as const))(
    '%s : sélection minimale → résolution → manifest → plan',
    (_id, item) => {
      const draft = minimalDraft(item);
      expect(draft).toBeDefined();
      if (draft === undefined) {
        return;
      }
      const { resolution, plan } = planDraft(draft);
      expect(resolution.technologies).toContain(item.id);
      expect(plan.plan.files.length).toBeGreaterThan(0);
      expect(plan.plan.files.map((file) => file.path)).toContain('package.json');
      expectCoherentPlan(plan.plan.files, resolution.technologies);
      // Aucun avertissement de couverture de génération ne subsiste.
      expect(plan.warnings.map((warning) => warning.code)).not.toContain(
        'COMPAT_EXPERIMENTAL_COMBINATION',
      );
    },
  );
});

/**
 * Des stacks complètes, par écosystème : les fiches prises une à une se
 * planifient, il reste à vérifier qu'elles se planifient **ensemble**
 * (conflits de plages npm, de scripts, de fichiers).
 */
const COMBINATIONS: readonly (readonly [string, Draft])[] = [
  [
    'SaaS React complet',
    {
      targets: ['web'],
      technologies: [
        'next',
        'typescript',
        'tailwind',
        'shadcn-ui',
        'postgresql',
        'prisma',
        'better-auth',
        'stripe',
        'resend',
        'sentry',
        'posthog',
        'zustand',
        'tanstack-query',
        'react-hook-form',
        'zod',
        'trpc',
        'redis',
        's3',
        'openai',
        'vercel-ai-sdk',
        'biome',
        'vitest',
        'playwright',
        'testing-library',
        'husky',
        'lint-staged',
        'docker',
        'github-actions',
        'vercel',
      ],
    },
  ],
  [
    'React (Vite) + bibliothèques',
    {
      targets: ['web'],
      technologies: [
        'react',
        'typescript',
        'vite',
        'material-ui',
        'emotion',
        'redux-toolkit',
        'swr',
        'formik',
        'yup',
        'jest',
        'eslint',
        'prettier',
        'storybook',
      ],
    },
  ],
  [
    'Remix + Drizzle + Clerk',
    {
      targets: ['web'],
      technologies: [
        'remix',
        'typescript',
        'tailwind',
        'daisyui',
        'sqlite',
        'drizzle',
        'clerk',
        'jotai',
        'valibot',
        'cypress',
        'netlify',
      ],
    },
  ],
  [
    'Vue / Nuxt',
    {
      targets: ['web'],
      technologies: [
        'nuxt',
        'typescript',
        'vuetify',
        'pinia',
        'tanstack-query',
        'tanstack-form',
        'zod',
        'supabase',
        'supabase-auth',
        'vitest',
        'eslint',
        'prettier',
        'netlify',
      ],
    },
  ],
  [
    'Vue (SPA) + PrimeVue',
    {
      targets: ['web'],
      technologies: ['vue', 'typescript', 'primevue', 'sass', 'pinia', 'urql', 'vitest'],
    },
  ],
  [
    'SvelteKit',
    {
      targets: ['web'],
      technologies: [
        'sveltekit',
        'typescript',
        'tailwind',
        'postgresql',
        'drizzle',
        'authjs',
        'tanstack-query',
        'zod',
        'vitest',
        'playwright',
        'biome',
        'cloudflare',
      ],
    },
  ],
  [
    'Angular',
    {
      targets: ['web'],
      technologies: [
        'angular',
        'typescript',
        'ngrx',
        'apollo-client',
        'graphql',
        'sass',
        'carbon-design-system',
        'jest',
        'eslint',
      ],
    },
  ],
  [
    'Solid',
    {
      targets: ['web'],
      technologies: ['solidjs', 'typescript', 'unocss', 'urql', 'vitest'],
    },
  ],
  ['Qwik', { targets: ['web'], technologies: ['qwik', 'typescript', 'tailwind', 'vitest'] }],
  [
    'Preact',
    { targets: ['web'], technologies: ['preact', 'typescript', 'css-modules', 'tanstack-query'] },
  ],
  [
    'Astro',
    {
      targets: ['web'],
      technologies: ['astro', 'typescript', 'tailwind', 'sanity', 'plausible', 'netlify'],
    },
  ],
  ['htmx', { targets: ['web'], technologies: ['htmx', 'javascript', 'bootstrap', 'umami'] }],
  [
    'API Node : Hono (preset API)',
    {
      targets: ['api'],
      technologies: [
        'hono',
        'typescript',
        'postgresql',
        'prisma',
        'redis',
        'bullmq',
        'better-auth',
        'resend',
        'sentry',
        'opentelemetry',
        'biome',
        'vitest',
        'docker',
        'github-actions',
        'fly-io',
      ],
    },
  ],
  [
    'API Node : NestJS',
    {
      targets: ['api'],
      technologies: [
        'nestjs',
        'typescript',
        'postgresql',
        'typeorm',
        'graphql',
        'kafka',
        'jest',
        'eslint',
        'prettier',
        'docker',
        'kubernetes',
      ],
    },
  ],
  [
    'API Node : Fastify / Express / Elysia',
    {
      targets: ['api'],
      technologies: ['fastify', 'typescript', 'mongodb', 'mongoose', 'joi', 'rabbitmq', 'vitest'],
    },
  ],
  [
    'API Node : Express',
    {
      targets: ['api'],
      technologies: ['express', 'javascript', 'mysql', 'sequelize', 'mocha'],
    },
  ],
  [
    'API Python : Django',
    {
      targets: ['api'],
      technologies: ['django', 'python', 'postgresql', 'django-orm', 'redis', 'docker', 'sentry'],
    },
  ],
  [
    'API Python : FastAPI',
    {
      targets: ['api'],
      technologies: [
        'fastapi',
        'python',
        'postgresql',
        'sqlalchemy',
        'langchain',
        'qdrant',
        'docker',
      ],
    },
  ],
  [
    'API Go',
    { targets: ['api'], technologies: ['gin', 'go', 'postgresql', 'gorm', 'nats', 'docker'] },
  ],
  [
    'API Rust',
    { targets: ['api'], technologies: ['axum', 'rust', 'postgresql', 'sqlx', 'docker'] },
  ],
  [
    'API PHP : Laravel',
    { targets: ['api'], technologies: ['laravel', 'php', 'mysql', 'eloquent', 'redis'] },
  ],
  ['API Ruby : Rails', { targets: ['api'], technologies: ['rails', 'ruby', 'postgresql'] }],
  [
    'API JVM : Spring Boot',
    {
      targets: ['api'],
      technologies: ['spring-boot', 'java', 'postgresql', 'hibernate', 'kafka', 'docker'],
    },
  ],
  [
    'Monorepo Next.js + Hono (Turborepo)',
    {
      targets: ['web', 'api'],
      architecture: 'monorepo',
      technologies: [
        'next',
        'hono',
        'typescript',
        'tailwind',
        'shadcn-ui',
        'postgresql',
        'prisma',
        'better-auth',
        'redis',
        'zod',
        'biome',
        'vitest',
        'playwright',
        'turborepo',
        'pnpm',
        'docker',
        'github-actions',
      ],
    },
  ],
  [
    'Monorepo Nuxt + NestJS (Nx)',
    {
      targets: ['web', 'api'],
      architecture: 'monorepo',
      technologies: ['nuxt', 'nestjs', 'typescript', 'postgresql', 'drizzle', 'nx', 'vitest'],
    },
  ],
];

describe('couverture du catalogue : combinaisons par écosystème', () => {
  it.each(COMBINATIONS)('%s', (_name, draft) => {
    const { resolution, plan } = planDraft(draft);
    for (const id of draft.technologies) {
      expect(resolution.technologies).toContain(id);
    }
    expect(plan.plan.files.length).toBeGreaterThan(0);
    expectCoherentPlan(plan.plan.files, resolution.technologies);
    expect(plan.warnings.map((warning) => warning.code)).not.toContain(
      'COMPAT_EXPERIMENTAL_COMBINATION',
    );
  });
});

/**
 * Les fiches qui apportent quelque chose au-delà de leurs paquets — scripts,
 * fichiers, services locaux — sont celles qui peuvent se marcher dessus. Toute
 * paire que le moteur de compatibilité accepte doit aussi se planifier : un
 * refus qui n'arrive qu'à la génération, après que l'écran a dit « compatible »,
 * est le pire moment pour l'apprendre.
 */
describe('couverture du catalogue : paires de fiches intégrées', () => {
  const integrated = [...new Set(INTEGRATIONS.map((integration) => integration.id))].sort();
  const pairs = integrated.flatMap((first, index) =>
    integrated.slice(index + 1).map((second) => [first, second] as const),
  );

  it.each(pairs)('%s + %s', (first, second) => {
    const left = minimalDraft(entry(first));
    const right = minimalDraft(entry(second));
    if (left === undefined || right === undefined) {
      return;
    }
    const targets = [...new Set([...left.targets, ...right.targets])];
    // Une application web et une API dans le même projet : c'est le monorepo,
    // une application par dossier. En application seule, les deux frameworks
    // se disputeraient `dev`, `build` et `start`.
    const draft: Draft = {
      targets,
      technologies: [...new Set([...left.technologies, ...right.technologies])],
      ...(targets.length > 1 ? { architecture: 'monorepo' as const } : {}),
    };
    const resolution = resolve(
      { targets: draft.targets, technologies: draft.technologies },
      registry,
    );
    // Une paire que le moteur refuse est un refus nommé, au bon écran : rien à
    // vérifier de plus ici.
    if (!resolution.ok) {
      return;
    }
    const { plan } = planDraft(draft);
    expectCoherentPlan(plan.plan.files, resolution.value.technologies);
  });
});

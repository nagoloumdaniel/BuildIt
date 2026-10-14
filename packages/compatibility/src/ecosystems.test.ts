import { loadCatalogue, type Registry } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { optionsFor, resolve, type Selection } from './resolve.js';

/**
 * L'audit de compatibilité, sur le **vrai** catalogue.
 *
 * Ces tests ne décrivent pas des fiches inventées : ils rejouent, sur les 283
 * fiches livrées, les combinaisons que l'audit a corrigées dans les deux sens.
 * Si quelqu'un retire un écosystème d'une fiche ou remet une catégorie en
 * « un seul choix », c'est ici que ça casse avec le nom de la paire.
 */

const catalogue = loadCatalogue();
if (!catalogue.ok) {
  throw new Error('catalogue illisible');
}
const REGISTRY: Registry = catalogue.value;

function check(targets: Selection['targets'], technologies: readonly string[]) {
  return resolve({ targets, technologies }, REGISTRY);
}

const codes = (result: ReturnType<typeof check>): readonly string[] =>
  result.ok ? [] : result.issues.map((issue) => issue.code);

describe('combinaisons standard qui étaient refusées à tort', () => {
  it.each([
    ['Tailwind + PostCSS', ['web'], ['next', 'tailwind', 'postcss']],
    ['Sass + CSS Modules', ['web'], ['next', 'sass', 'css-modules']],
    ['shadcn/ui sur Radix', ['web'], ['next', 'shadcn-ui', 'radix-ui']],
    ['ESLint + Stylelint', ['web'], ['next', 'eslint', 'stylelint']],
    ['Docker + Kubernetes + Helm', ['api'], ['express', 'docker', 'kubernetes', 'helm']],
    ['pnpm + Changesets', ['web'], ['next', 'pnpm', 'changesets']],
    ['Stripe + PayPal', ['web'], ['next', 'stripe', 'paypal']],
    ['Vercel + Fly.io', ['web', 'api'], ['next', 'express', 'vercel', 'fly-io']],
    ['TypeScript au front, Python à l’API', ['web', 'api'], ['next', 'fastapi', 'python']],
    ['Lerna sur Nx', ['web'], ['next', 'lerna', 'nx']],
    ['Astro + composants Vue', ['web'], ['astro', 'vuetify']],
    ['Preact + bibliothèque React', ['web'], ['preact', 'zustand']],
    [
      'COBOL batch : GnuCOBOL, ESQL PostgreSQL, Docker',
      ['library'],
      ['cobol', 'gnucobol', 'cobol-check', 'ocesql', 'postgresql', 'make', 'docker'],
    ],
    ['Flutter exige Dart', ['mobile'], ['flutter']],
    ['Expo en TypeScript', ['mobile'], ['expo', 'typescript']],
    ['Tauri en TypeScript', ['desktop'], ['tauri', 'typescript']],
  ] as const)('%s', (_name, targets, technologies) => {
    const result = check(targets, technologies);
    expect(codes(result)).toEqual([]);
  });
});

describe('combinaisons impossibles qui passaient', () => {
  it.each([
    ['Next.js + Vuetify', ['web'], ['next', 'vuetify']],
    ['Vue + React Hook Form', ['web'], ['vue', 'react-hook-form']],
    ['Angular + Zustand', ['web'], ['angular', 'zustand']],
    ['Nuxt + shadcn/ui', ['web'], ['nuxt', 'shadcn-ui']],
    ['Django + Prisma', ['api'], ['django', 'prisma']],
    ['FastAPI + tRPC', ['api'], ['fastapi', 'trpc']],
    ['Gin + SQLAlchemy', ['api'], ['gin', 'sqlalchemy']],
    ['Python + Go', ['api'], ['python', 'go']],
    ['Express + Python', ['api'], ['express', 'python']],
    ['htmx + composants React', ['web'], ['htmx', 'mantine']],
    ['COBOL + Hono', ['api'], ['cobol', 'hono']],
    ['COBOL + Prisma', ['api'], ['cobol', 'prisma']],
    ['GnuCOBOL + Python', ['api'], ['gnucobol', 'python']],
    ['Open COBOL ESQL + Express', ['api'], ['ocesql', 'express']],
  ] as const)('%s', (_name, targets, technologies) => {
    expect(codes(check(targets, technologies))).toContain('COMPAT_ECOSYSTEM_MISMATCH');
  });

  it('nomme les deux fiches et leurs écosystèmes', () => {
    const result = check(['web'], ['next', 'vuetify']);
    const issue = result.ok ? undefined : result.issues[0];
    expect(issue?.path).toEqual(expect.arrayContaining(['next', 'vuetify']));
    expect(issue?.message).toContain('React');
    expect(issue?.message).toContain('Vue');
  });
});

describe('les conflits réels restent refusés', () => {
  it.each([
    ['npm + pnpm', ['next', 'npm', 'pnpm']],
    ['Turborepo + Nx', ['next', 'turborepo', 'nx']],
    ['Tailwind + UnoCSS', ['next', 'tailwind', 'unocss']],
  ] as const)('%s', (_name, technologies) => {
    expect(codes(check(['web'], technologies))).toContain('COMPAT_DECLARED_CONFLICT');
  });

  it('deux frameworks web restent exclusifs', () => {
    expect(codes(check(['web'], ['next', 'nuxt']))).toContain('COMPAT_EXCLUSIVE_CATEGORY');
  });
});

describe('dépendances qui manquaient', () => {
  it.each([
    ['daisyui', 'tailwind'],
    ['django-orm', 'django'],
    ['eloquent', 'laravel'],
  ] as const)('%s ajoute %s', (id, required) => {
    const result = check(['api', 'web'], [id]);
    expect(result.ok && result.value.technologies).toContain(required);
  });
});

describe('optionsFor dit ce qui bloque', () => {
  it('une option bloquée porte le refus et les fiches en cause', () => {
    const options = optionsFor('ui', { targets: ['web'], technologies: ['next'] }, REGISTRY);
    const vuetify = options.find((option) => option.entry.id === 'vuetify');

    expect(vuetify?.state).toBe('blocked');
    expect(vuetify?.blocking?.code).toBe('COMPAT_ECOSYSTEM_MISMATCH');
    expect(vuetify?.blocking?.path).toEqual(expect.arrayContaining(['vuetify', 'next']));
  });

  it('une option utilisable ne porte aucun refus', () => {
    const options = optionsFor('ui', { targets: ['web'], technologies: ['next'] }, REGISTRY);
    const radix = options.find((option) => option.entry.id === 'radix-ui');

    expect(radix?.state).toBe('available');
    expect(radix?.blocking).toBeUndefined();
  });
});

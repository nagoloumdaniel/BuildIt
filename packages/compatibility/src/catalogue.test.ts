import { loadCatalogue, type Registry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { optionsFor, resolve } from './resolve.js';

/**
 * Le moteur confronté au **vrai** catalogue de 282 fiches.
 *
 * Les tests de règles travaillent sur des fixtures de deux ou trois entrées :
 * ils prouvent que chaque règle fait ce qu'elle dit. Rien ne garantit pour
 * autant que les données réelles traversent le moteur sans se contredire.
 */

const loaded = loadCatalogue();

function catalogue(): Registry {
  if (!loaded.ok) {
    throw new Error('le catalogue ne charge pas');
  }
  return loaded.value;
}

/** La stack du preset SaaS (§8), telle que le cahier des charges la décrit. */
const SAAS = [
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
  'vercel',
  'vitest',
  'playwright',
];

describe('le preset SaaS se résout', () => {
  it('sans erreur — sinon le message dit laquelle', () => {
    const result = resolve({ targets: ['web'], technologies: SAAS }, catalogue());
    const problems = result.ok ? [] : result.issues.map((i) => `${i.code} : ${i.message}`);
    expect(problems).toEqual([]);
  });

  it('conserve toutes les technologies choisies', () => {
    const result = resolve({ targets: ['web'], technologies: SAAS }, catalogue());
    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const id of SAAS) {
        expect(result.value.technologies, `perdue : ${id}`).toContain(id);
      }
    }
  });

  it('est marquée expérimentale — aucun template n’existe encore', () => {
    const result = resolve({ targets: ['web'], technologies: SAAS }, catalogue());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('experimental');
    }
  });

  it('avertit sur la licence de Sentry — §11', () => {
    const result = resolve({ targets: ['web'], technologies: SAAS }, catalogue());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const licence = result.value.warnings.find((w) => w.code === 'COMPAT_RESTRICTIVE_LICENSE');
      expect(licence?.message).toContain('Sentry');
    }
  });
});

describe('résolution automatique sur le catalogue réel', () => {
  it('choisir better-auth ajoute typescript, et le dit', () => {
    const result = resolve({ targets: ['web'], technologies: ['better-auth'] }, catalogue());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.technologies).toContain('typescript');
      expect(result.value.additions).toContainEqual({
        id: 'typescript',
        requiredBy: 'better-auth',
      });
    }
  });

  it('choisir shadcn-ui ajoute tailwind', () => {
    const result = resolve({ targets: ['web'], technologies: ['shadcn-ui'] }, catalogue());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.technologies).toContain('tailwind');
    }
  });
});

describe('incompatibilités réelles', () => {
  it('refuse deux ORM', () => {
    const result = resolve({ targets: ['web'], technologies: ['prisma', 'drizzle'] }, catalogue());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('COMPAT_EXCLUSIVE_CATEGORY');
      expect(result.issues[0]?.message).toContain('Prisma');
      expect(result.issues[0]?.message).toContain('Drizzle');
    }
  });

  it('accepte Vitest et Playwright ensemble', () => {
    expect(
      resolve({ targets: ['web'], technologies: ['vitest', 'playwright'] }, catalogue()).ok,
    ).toBe(true);
  });

  it('refuse un backend d’API quand seul le web est ciblé', () => {
    const result = resolve({ targets: ['web'], technologies: ['nestjs'] }, catalogue());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('COMPAT_TARGET_UNSUPPORTED');
    }
  });
});

describe('optionsFor sur le catalogue réel — §5', () => {
  it('rend les 17 ORM du catalogue, jamais une liste filtrée', () => {
    const options = optionsFor('orm', { targets: ['web'], technologies: ['prisma'] }, catalogue());
    expect(options.length).toBe(catalogue().query({ category: 'orm' }).length);
  });

  it('grise les autres ORM avec une raison lisible', () => {
    const options = optionsFor('orm', { targets: ['web'], technologies: ['prisma'] }, catalogue());
    const drizzle = options.find((option) => option.entry.id === 'drizzle');
    expect(drizzle?.state).toBe('blocked');
    expect(drizzle?.reason).toContain('Prisma');
  });

  it('aucune option bloquée du catalogue n’est sans raison', () => {
    const registry = catalogue();
    const selection = { targets: ['web' as const], technologies: ['next', 'prisma', 'postgresql'] };
    for (const category of ['orm', 'frontend', 'database', 'ui', 'testing', 'hosting'] as const) {
      for (const option of optionsFor(category, selection, registry)) {
        if (option.state === 'blocked') {
          expect(option.reason, `raison manquante : ${option.entry.id}`).toBeTruthy();
        }
      }
    }
  });

  it('un choix libère les options compatibles ailleurs', () => {
    const options = optionsFor(
      'authentication',
      { targets: ['web'], technologies: ['next', 'prisma'] },
      catalogue(),
    );
    const betterAuth = options.find((option) => option.entry.id === 'better-auth');
    expect(betterAuth?.state).toBe('available');
  });
});

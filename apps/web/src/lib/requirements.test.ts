import { ARCHITECTURES, type Architecture } from '@buildit/manifest';
import { describe, expect, it } from 'vitest';
import type { DraftState } from './draft';
import { freshDraft } from './draft';
import { draftToManifest } from './draft-to-manifest';
import { FR } from './i18n/messages';
import { missingRequirements, requirementText } from './requirements';

/**
 * Les minimums d'un écran, sans DOM et sans React.
 *
 * Le catalogue est le **vrai** : les identifiants (`next`, `hono`, `bullmq`)
 * sont ceux des fiches, et c'est ce qui prouve que le module ne recopie aucune
 * liste de technologies (§11). Si une fiche change de catégorie ou de cible,
 * c'est ici que ça se voit.
 */

function draft(extra: Partial<DraftState>): DraftState {
  return { ...freshDraft(), name: 'sonde', ...extra };
}

function kinds(state: DraftState): readonly string[] {
  return missingRequirements(state).map((need) => need.kind);
}

function texts(state: DraftState): string {
  return missingRequirements(state)
    .map((need) => requirementText(FR, need))
    .join(' ');
}

describe('une plateforme exige son framework', () => {
  it('refuse une cible web sans framework frontend', () => {
    expect(kinds(draft({ targets: ['web'] }))).toContain('framework');
  });

  it('accepte un framework qui sert la cible', () => {
    expect(kinds(draft({ targets: ['web'], technologies: ['next'] }))).not.toContain('framework');
  });

  it('ne confond pas les plateformes : Expo ne sert pas web', () => {
    expect(kinds(draft({ targets: ['web'], technologies: ['expo'] }))).toContain('framework');
    expect(kinds(draft({ targets: ['mobile'], technologies: ['expo'] }))).not.toContain(
      'framework',
    );
  });

  it('demande un backend pour la plateforme API', () => {
    expect(kinds(draft({ targets: ['api'] }))).toContain('framework');
    expect(kinds(draft({ targets: ['api'], technologies: ['hono'] }))).not.toContain('framework');
  });

  it('ne demande rien pour une bibliothèque, qui n’est pas une application', () => {
    expect(kinds(draft({ targets: ['library'] }))).toEqual([]);
  });
});

describe('les formes serveur exigent une application serveur', () => {
  for (const architecture of ['modular-monolith', 'microservices', 'serverless', 'event-driven']) {
    it(`${architecture} : plateforme API d’abord, framework backend ensuite`, () => {
      const withoutApi = draft({ targets: ['web'], architecture, technologies: ['next'] });
      expect(kinds(withoutApi)).toContain('server-platform');

      const withApi = draft({
        targets: ['web', 'api'],
        architecture,
        technologies: ['next'],
      });
      expect(kinds(withApi)).toContain('backend');
      expect(
        kinds({ ...withApi, technologies: ['next', 'hono'] }),
        'hono est un backend qui sert api',
      ).not.toContain('backend');
    });
  }

  it('single-app n’ajoute aucun besoin serveur', () => {
    const state = draft({ targets: ['web'], architecture: 'single-app', technologies: ['next'] });
    expect(kinds(state)).toEqual([]);
  });
});

describe('monorepo : au moins une application', () => {
  it('exige une application quand aucune plateforme n’en produit', () => {
    expect(kinds(draft({ targets: ['library'], architecture: 'monorepo' }))).toContain(
      'application',
    );
  });

  it('se tait dès qu’une plateforme en produit une', () => {
    const state = draft({ targets: ['web'], architecture: 'monorepo', technologies: ['next'] });
    expect(kinds(state)).not.toContain('application');
  });
});

describe('capacités et infrastructures des architectures', () => {
  const serving: Pick<DraftState, 'targets' | 'technologies'> = {
    targets: ['web', 'api'],
    technologies: ['next', 'hono'],
  };

  it('microservices : une file et des conteneurs', () => {
    const state = draft({ ...serving, architecture: 'microservices' });
    expect(kinds(state)).toEqual(['capability', 'infrastructure']);
    expect(texts(state)).toContain('File d’attente');

    // La file se choisit à l'écran Capacités, les conteneurs à l'écran
    // Infrastructure — ou par la case Docker, qui vaut un conteneur.
    const filled = draft({
      ...serving,
      architecture: 'microservices',
      capabilities: ['bullmq'],
      infra: { docker: true, ci: false },
    });
    expect(kinds(filled)).toEqual([]);
  });

  it('event-driven : une file, rien d’autre', () => {
    const state = draft({ ...serving, architecture: 'event-driven' });
    expect(kinds(state)).toEqual(['capability']);

    const withQueue = draft({ ...serving, architecture: 'event-driven', capabilities: ['kafka'] });
    expect(kinds(withQueue)).toEqual([]);
  });

  it('serverless : un hébergement', () => {
    const state = draft({ ...serving, architecture: 'serverless' });
    expect(kinds(state)).toEqual(['infrastructure']);
    expect(texts(state)).toContain('Hébergement');

    const withHost = draft({
      ...serving,
      architecture: 'serverless',
      technologies: ['next', 'hono', 'vercel'],
    });
    expect(kinds(withHost)).toEqual([]);
  });
});

describe('un ORM sans base ne produit pas de manifest', () => {
  it('exige un moteur dès qu’un ORM est choisi', () => {
    const state = draft({ targets: ['web'], technologies: ['next', 'prisma'] });
    expect(kinds(state)).toContain('database');
    expect(texts(state)).toContain('ORM');
  });

  it('se tait dès qu’un moteur est choisi', () => {
    const state = draft({ targets: ['web'], technologies: ['next', 'prisma', 'postgresql'] });
    expect(kinds(state)).toEqual([]);
  });
});

describe('les phrases', () => {
  it('n’écrivent aucun nom de technologie : elles nomment plateforme, architecture et catégorie', () => {
    const state = draft({ targets: ['web'], architecture: 'microservices' });
    const text = texts(state);

    expect(text).toContain('Web');
    expect(text).toContain('API');
    expect(text).toContain('Backend');
    expect(text).not.toContain('next');
    expect(text).not.toContain('hono');
  });
});

/**
 * L'invariant qui compte : **satisfaire les minimums suffit à produire un
 * manifest**. C'est la seule façon de prouver que le tableau des besoins n'est
 * ni trop faible (le manifest échouerait plus loin) ni arbitraire : chaque
 * combinaison d'architecture et de plateformes est passée au vrai
 * `draftToManifest`, celui qui parle au schéma du §10.
 *
 * Le langage n'est pas dans les besoins (le moteur le réclame déjà à l'écran
 * Stack) : la sonde l'ajoute, comme le ferait un utilisateur.
 */
describe('satisfaire les minimums suffit à produire un manifest', () => {
  /** Une fiche qui porte le framework de chaque plateforme. */
  const FRAMEWORK: Readonly<Record<string, string>> = {
    web: 'next',
    mobile: 'expo',
    desktop: 'electron',
    api: 'hono',
  };
  const SERVER: ReadonlySet<string> = new Set([
    'modular-monolith',
    'microservices',
    'serverless',
    'event-driven',
  ]);

  function satisfying(architecture: Architecture, base: readonly string[]): DraftState {
    const targets = [...base];
    const technologies = new Set<string>();
    const capabilities: string[] = [];
    const infra = { docker: false, ci: false };

    // Une forme serveur, et un monorepo sans application, ont besoin d'une
    // plateforme qui en produise une : c'est ce que la phrase du refus dit.
    if (SERVER.has(architecture) && !targets.includes('api')) {
      targets.push('api');
    }
    if (architecture === 'monorepo' && !targets.some((target) => target in FRAMEWORK)) {
      targets.push('web');
    }

    for (const target of targets) {
      const framework = FRAMEWORK[target];
      if (framework !== undefined) {
        technologies.add(framework);
      }
      // `frontend.language` et `mobile.language` sont obligatoires (§10).
      if (target === 'web' || target === 'mobile') {
        technologies.add('typescript');
      }
    }
    if (architecture === 'microservices' || architecture === 'event-driven') {
      capabilities.push('bullmq');
    }
    if (architecture === 'microservices') {
      infra.docker = true;
    }
    if (architecture === 'serverless') {
      technologies.add('vercel');
    }

    return {
      ...freshDraft(),
      name: 'sonde-minimums',
      targets,
      architecture,
      technologies: [...technologies],
      capabilities,
      infra,
    };
  }

  const TARGET_SETS: readonly (readonly string[])[] = [
    ['web'],
    ['api'],
    ['web', 'api'],
    ['mobile'],
    ['desktop'],
    ['library'],
    ['web', 'mobile', 'desktop', 'api'],
  ];

  it.each(
    ARCHITECTURES.flatMap((architecture) =>
      TARGET_SETS.map((targets) => [architecture, targets.join('+'), targets] as const),
    ),
  )('%s + %s', (architecture, _label, targets) => {
    const state = satisfying(architecture, targets);

    expect(kinds(state), JSON.stringify(state)).toEqual([]);
    const result = draftToManifest(state);
    expect(result.ok, JSON.stringify(!result.ok ? result.issues : [])).toBe(true);
  });

  /**
   * Le cas signalé : plateformes web, mobile, API **et** bibliothèque. Chaque
   * application a son framework — Next.js pour le web, Expo pour le mobile, un
   * backend pour l'API — et le manifest les range chacune dans son emplacement.
   */
  it('web + mobile + API + bibliothèque : trois applications, trois frameworks', () => {
    const state: DraftState = {
      ...freshDraft(),
      name: 'multi-plateformes',
      targets: ['web', 'mobile', 'api', 'library'],
      architecture: 'monorepo',
      technologies: ['next', 'expo', 'hono', 'typescript', 'postgresql', 'prisma'],
      capabilities: [],
      infra: { docker: true, ci: true },
    };

    expect(missingRequirements(state)).toEqual([]);
    const result = draftToManifest(state);
    expect(result.ok, JSON.stringify(!result.ok ? result.issues : [])).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.frontend?.framework).toBe('next');
    expect(result.value.mobile?.framework).toBe('expo');
    expect(result.value.backend?.framework).toBe('hono');
  });
});

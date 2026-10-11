import { planProject } from '@buildit/generator';
import { parseManifest, serializeManifest } from '@buildit/manifest';
import { getPreset } from '@buildit/presets';
import { describe, expect, it } from 'vitest';
import { type DraftState, freshDraft } from './draft';
import { draftToManifest } from './draft-to-manifest';

/**
 * Le contrat UI/CLI (§9, gate M5) commence ici : les mêmes choix, saisis à
 * l'écran ou en ligne de commande, doivent produire le même manifest.
 *
 * Les assertions qui comptent ne sont pas « le champ vaut X » mais celles qui
 * passent par le **vrai** catalogue et le **vrai** pipeline : `parseManifest`
 * puis `planProject`. Un mapping qui n'invente rien doit survivre aux deux.
 */

/** Le brouillon équivalent au preset SaaS : les mêmes choix, saisis aux écrans. */
function saasDraft(): DraftState {
  return {
    ...freshDraft(),
    step: 'preview',
    name: 'mon-projet',
    targets: ['web'],
    type: 'saas',
    architecture: 'single-app',
    technologies: [
      'next',
      'typescript',
      'tailwind',
      'shadcn-ui',
      'postgresql',
      'prisma',
      'better-auth',
      'biome',
      'vitest',
      'playwright',
      'vercel',
    ],
    capabilities: ['stripe', 'resend', 'sentry', 'posthog'],
    envVarNames: ['DATABASE_URL', 'BETTER_AUTH_SECRET'],
    infra: { docker: true, ci: true },
  };
}

/** Le manifest du CLI pour les mêmes choix : c'est lui qui fait foi. */
function saasPresetManifest(
  name: string,
): ReturnType<NonNullable<ReturnType<typeof getPreset>>['manifest']> {
  const preset = getPreset('saas');
  if (preset === undefined) {
    throw new Error('Le preset « saas » a disparu du catalogue des presets.');
  }
  return preset.manifest(name);
}

describe('draftToManifest — un brouillon incomplet est refusé, avec des problèmes lisibles', () => {
  it('un brouillon vide ne produit pas de manifest, mais une liste de problèmes', () => {
    const result = draftToManifest(freshDraft());
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.issues.length).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(issue.message.length).toBeGreaterThan(0);
      // Un `{param}` non substitué est un bug visible par l'utilisateur, pas un message.
      expect(issue.message).not.toContain('{');
    }
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain('MANIFEST_TARGETS_EMPTY');
    expect(codes).toContain('MANIFEST_FIELD_REQUIRED');
  });

  it('une cible web sans framework est refusée : aucun projet vide n’est accepté en silence', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    // La cible implique une application : c’est le schéma qui dit ce qui lui manque.
    expect(result.issues.some((issue) => issue.path.join('.') === 'frontend.framework')).toBe(true);
  });

  it('une cible mobile reste refusée tant que le catalogue n’offre aucun framework mobile', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['mobile'],
      architecture: 'single-app',
      // Tailwind ne sert que le web : il ne devient pas le style d’une
      // application mobile, et n’est donc pas une valeur inventée pour elle.
      technologies: ['typescript', 'tailwind'],
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    // Aucune valeur n’est inventée pour combler le trou : le champ reste absent.
    expect(result.issues.some((issue) => issue.path.join('.') === 'mobile.framework')).toBe(true);
  });

  it('une cible desktop est refusée : aucun champ du manifest ne peut décrire une application de bureau', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['desktop'],
      architecture: 'single-app',
      technologies: ['typescript'],
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.issues.some((issue) => issue.path.join('.') === 'desktop.framework')).toBe(true);
  });

  it('une cible inconnue — brouillon d’une autre version — est refusée en nommant les valeurs acceptées', () => {
    const draft = { ...freshDraft(), name: 'mon-projet', targets: ['website'] };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const issue = result.issues.find((candidate) => candidate.code === 'MANIFEST_ENUM_UNKNOWN');
    expect(issue?.message).toContain('web');
  });

  it('une architecture inconnue est refusée avec une suggestion', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'micro-services',
      technologies: ['next', 'typescript'],
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const issue = result.issues.find((candidate) => candidate.code === 'MANIFEST_ENUM_UNKNOWN');
    expect(issue?.hint).toContain('microservices');
  });

  it('un ORM sans base de données est refusé, comme « pf add » le refuse', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript', 'prisma'],
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.issues.some((issue) => issue.path.join('.') === 'database.engine')).toBe(true);
  });
});

describe('draftToManifest — le manifest produit est celui du moteur (§9, §10)', () => {
  it('un brouillon complet passe parseManifest ET planProject', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: [
        'next',
        'typescript',
        'tailwind',
        'shadcn-ui',
        'postgresql',
        'prisma',
        'better-auth',
      ],
      capabilities: ['stripe', 'sentry'],
      infra: { docker: true, ci: true },
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    // La forme d’abord — puis l’identité et la combinaison, par le vrai moteur.
    const planned = planProject(result.value, '/pf-apercu');
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }
    const paths = planned.value.plan.files.map((file) => file.path);
    expect(paths).toContain('package.json');
    expect(paths).toContain('.env.example');
    // Les booléens de l’écran Infrastructure sont devenus des ids que le moteur
    // connaît : sans eux, ni Dockerfile ni workflow ne seraient planifiés.
    expect(paths).toContain('Dockerfile');
    expect(paths).toContain('.github/workflows/ci.yml');
  });

  it('les mêmes choix qu’au CLI donnent le même manifest, octet pour octet (gate M5)', () => {
    const result = draftToManifest(saasDraft());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(serializeManifest(result.value)).toBe(
      serializeManifest(saasPresetManifest('mon-projet')),
    );

    // Le mapping, champ par champ, tel que le preset SaaS le pose.
    expect(result.value.manifestVersion).toBe(1);
    expect(result.value.targets).toEqual(['web']);
    expect(result.value.architecture).toBe('single-app');
    expect(result.value.frontend).toEqual({
      framework: 'next',
      language: 'typescript',
      styling: 'tailwind',
      ui: 'shadcn-ui',
    });
    expect(result.value.database).toEqual({ engine: 'postgresql', orm: 'prisma' });
    expect(result.value.auth).toEqual({ provider: 'better-auth' });
    expect(result.value.services).toEqual(['posthog', 'resend', 'sentry', 'stripe']);
    expect(result.value.quality).toEqual(['biome', 'playwright', 'vitest']);
    expect(result.value.infra).toEqual(['docker', 'github-actions', 'vercel']);
  });

  it('le plan du brouillon contient les fichiers des outils choisis', () => {
    const result = draftToManifest(saasDraft());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const planned = planProject(result.value, '/pf-apercu');
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }
    const paths = planned.value.plan.files.map((file) => file.path);
    // `quality` non vide est ce qui pose la configuration des outils de qualité.
    expect(paths).toContain('biome.json');
    expect(paths).toContain('playwright.config.ts');
  });

  it('le même choix saisi dans un autre ordre donne la même chaîne', () => {
    const draft = saasDraft();
    const result = draftToManifest(draft);
    const reversed = draftToManifest({
      ...draft,
      technologies: [...draft.technologies].reverse(),
      capabilities: [...draft.capabilities].reverse(),
    });
    expect(result.ok).toBe(true);
    expect(reversed.ok).toBe(true);
    if (!result.ok || !reversed.ok) {
      return;
    }
    expect(serializeManifest(reversed.value)).toBe(serializeManifest(result.value));
  });

  it('l’écran Infrastructure traduit ses deux booléens en ids réels du catalogue', () => {
    const result = draftToManifest({
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript'],
      infra: { docker: true, ci: true },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.infra).toEqual(['docker', 'github-actions']);
  });

  it('sans Docker, sans CI ni outil de qualité, les champs restent absents — jamais un tableau vide', () => {
    const result = draftToManifest({
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript'],
      infra: { docker: false, ci: false },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect('infra' in result.value).toBe(false);
    expect('quality' in result.value).toBe(false);
    expect('services' in result.value).toBe(false);
  });

  it('une capacité rejoint les services, et un id de catégorie connue va là où « pf add » le mettrait', () => {
    const result = draftToManifest({
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript'],
      capabilities: ['stripe', 'zod', 'vitest', 'postgresql', 'postgresql'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // L’écran Capabilities (§6.7) et l’écran Stack Builder désignent les mêmes
    // ids : le placement suit la catégorie du registry, pas l’écran d’où vient
    // le choix — sinon les deux écrans produiraient deux manifests différents.
    expect(result.value.services).toEqual(['stripe', 'zod']);
    expect(result.value.quality).toEqual(['vitest']);
    expect(result.value.database).toEqual({ engine: 'postgresql' });
  });
});

describe('draftToManifest — garde-fous', () => {
  it('aucune variable d’environnement n’entre dans le manifest (§6.8, §24)', () => {
    const draft = { ...saasDraft(), envVarNames: ['DATABASE_URL', 'sk_live_51H8xQ'] };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const serialized = serializeManifest(result.value);
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('sk_live');

    // Le brouillon avec ou sans ses variables donne le même manifest : elles ne
    // sont pas seulement absentes du résultat, elles n’y entrent jamais.
    const withoutEnv = draftToManifest({ ...draft, envVarNames: [] });
    expect(withoutEnv.ok).toBe(true);
    if (!withoutEnv.ok) {
      return;
    }
    expect(serializeManifest(withoutEnv.value)).toBe(serialized);

    // La sonde : si une façade ajoutait ce champ, le schéma strict le refuse.
    const probe = parseManifest({ ...result.value, envVarNames: draft.envVarNames });
    expect(probe.ok).toBe(false);
    if (probe.ok) {
      return;
    }
    expect(probe.issues.map((issue) => issue.code)).toEqual(['MANIFEST_UNKNOWN_FIELD']);
  });

  it('le « type » du brouillon (écran Project Type) n’est pas un champ du manifest', () => {
    const withType = draftToManifest({ ...saasDraft(), type: 'marketplace' });
    expect(withType.ok).toBe(true);
    if (!withType.ok) {
      return;
    }
    expect('type' in withType.value).toBe(false);
    expect(serializeManifest(withType.value)).toBe(
      serializeManifest(saasPresetManifest('mon-projet')),
    );

    // La sonde : le schéma est strict, « type » n’y a pas sa place.
    const probe = parseManifest({ ...withType.value, type: 'marketplace' });
    expect(probe.ok).toBe(false);
    if (probe.ok) {
      return;
    }
    expect(probe.issues.map((issue) => issue.code)).toEqual(['MANIFEST_UNKNOWN_FIELD']);
  });

  it('deux frameworks front concurrents : la forme tient, la combinaison est refusée par le moteur', () => {
    const draft = saasDraft();
    const result = draftToManifest({ ...draft, technologies: [...draft.technologies, 'nuxt'] });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Le champ à valeur unique garde un id — le premier dans l’ordre canonique —
    // et l’autre n’est pas perdu pour autant : il reste dans la sélection, donc
    // le compatibility engine voit les deux et refuse la combinaison (§12).
    expect(result.value.frontend?.framework).toBe('next');
    expect(result.value.services).toContain('nuxt');

    const planned = planProject(result.value, '/pf-apercu');
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      return;
    }
    expect(planned.issues.map((issue) => issue.code)).toContain('COMPAT_EXCLUSIVE_CATEGORY');
  });

  it('deux bases de données concurrentes : même règle, le moteur nomme le conflit', () => {
    const result = draftToManifest({
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript', 'postgresql', 'mysql', 'prisma'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.database?.engine).toBe('mysql');
    expect(result.value.services).toContain('postgresql');

    const planned = planProject(result.value, '/pf-apercu');
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      return;
    }
    expect(planned.issues.map((issue) => issue.code)).toContain('COMPAT_EXCLUSIVE_CATEGORY');
  });

  it('un backend choisi pour un projet sans cible api n’obtient pas de champ backend', () => {
    const result = draftToManifest({
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript', 'hono'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Hono ne sert que la cible api : le manifest ne lui invente pas un
    // `backend` que la cible ne demande pas, et ne le perd pas non plus.
    expect('backend' in result.value).toBe(false);
    expect(result.value.services).toContain('hono');

    const planned = planProject(result.value, '/pf-apercu');
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      return;
    }
    expect(planned.issues.map((issue) => issue.code)).toContain('COMPAT_TARGET_UNSUPPORTED');
  });

  it('une technologie inconnue du catalogue est portée jusqu’au moteur, qui la nomme', () => {
    const draft = saasDraft();
    const result = draftToManifest({
      ...draft,
      technologies: [...draft.technologies, 'techno-supprimee'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    // Le manifest valide la forme, le registry valide l’identité : écarter ce
    // choix en silence ferait générer un projet sans lui, sans rien dire.
    expect(result.value.services).toContain('techno-supprimee');

    const planned = planProject(result.value, '/pf-apercu');
    expect(planned.ok).toBe(false);
    if (planned.ok) {
      return;
    }
    expect(planned.issues.map((issue) => issue.code)).toContain('COMPAT_UNKNOWN_TECHNOLOGY');
  });
});

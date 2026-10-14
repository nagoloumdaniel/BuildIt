import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import {
  blockedReason,
  canAdvance,
  nextStep,
  previousStep,
  STEP_ORDER,
  type StepId,
  stepIndex,
} from './flow';
import { FR } from './i18n/messages';

describe('STEP_ORDER', () => {
  it('couvre les étapes du §3 sans le menu ni le graphe', () => {
    expect(STEP_ORDER).toEqual([
      'create',
      'target',
      'type',
      'architecture',
      'stack',
      'capabilities',
      'env',
      'infrastructure',
      'blueprint',
      'preview',
      'generate',
      'report',
    ]);
  });

  it('next/previous bornés à null aux extrémités', () => {
    expect(previousStep('create')).toBeNull();
    expect(nextStep('report')).toBeNull();
    expect(nextStep('create')).toBe('target');
    expect(previousStep('target')).toBe('create');
  });

  it('une étape qui n’appartient pas au parcours ne mène nulle part', () => {
    // Un brouillon écrit par une version antérieure peut nommer un écran qui
    // n'existe plus : `loadDraft` le normalise, ces fonctions ne l'inventent pas.
    expect(nextStep('ecran-disparu' as StepId)).toBeNull();
    expect(previousStep('ecran-disparu' as StepId)).toBeNull();
  });

  it('chaque étape a un rang, et le rang est réversible', () => {
    STEP_ORDER.forEach((step, index) => {
      expect(stepIndex(step)).toBe(index);
      if (index > 0) {
        expect(nextStep(STEP_ORDER[index - 1] as (typeof STEP_ORDER)[number])).toBe(step);
      }
    });
  });
});

describe('canAdvance bloquants du §6', () => {
  it('create : un nom conforme passe', () => {
    expect(canAdvance({ ...freshDraft(), name: 'mon-projet' }, FR)).toBe(true);
  });

  it('create : un nom vide est refusé', () => {
    expect(canAdvance({ ...freshDraft(), name: '' }, FR)).toBe(false);
  });

  it('create : un nom invalide selon le pattern du manifest est refusé', () => {
    expect(canAdvance({ ...freshDraft(), name: 'Espace Interdit' }, FR)).toBe(false);
  });

  it('target : au moins une cible', () => {
    expect(canAdvance({ ...freshDraft(), step: 'target', targets: [] }, FR)).toBe(false);
    expect(canAdvance({ ...freshDraft(), step: 'target', targets: ['web'] }, FR)).toBe(true);
  });

  it('target : mobile et desktop passent, le catalogue leur offre un framework', () => {
    // Expo, React Native, Flutter (mobile) ; Electron, Tauri (desktop).
    for (const target of ['mobile', 'desktop']) {
      const draft = { ...freshDraft(), step: 'target' as const, targets: [target] };
      expect(canAdvance(draft, FR), `${target} devrait être franchissable`).toBe(true);
    }
  });

  it('target : les cibles que le catalogue honore passent', () => {
    for (const target of ['web', 'api', 'library']) {
      const draft = { ...freshDraft(), step: 'target' as const, targets: [target] };
      expect(canAdvance(draft, FR), `${target} devrait passer`).toBe(true);
    }
  });

  it('stack : la résolution doit exister, ne porter aucun problème, et les minimums être tenus', () => {
    const base = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web'],
      step: 'stack' as const,
      technologies: ['next', 'typescript'],
    };
    expect(canAdvance(base, FR)).toBe(false);
    expect(
      canAdvance({ ...base, resolution: { status: 'certified', issues: ['doublon'] } }, FR),
    ).toBe(false);
    expect(canAdvance({ ...base, resolution: { status: 'certified', issues: [] } }, FR)).toBe(true);
    expect(canAdvance({ ...base, resolution: { status: 'experimental', issues: [] } }, FR)).toBe(
      true,
    );
  });

  it('stack : la plateforme choisie exige son framework avant de continuer', () => {
    const draft = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web'],
      step: 'stack' as const,
      resolution: { status: 'certified' as const, issues: [] },
    };
    expect(canAdvance(draft, FR)).toBe(false);
    expect(blockedReason(draft, FR)).toContain('framework');

    // Une fiche « frontend » qui ne sert pas web ne satisfait pas la cible.
    expect(canAdvance({ ...draft, technologies: ['expo'] }, FR)).toBe(false);
    expect(canAdvance({ ...draft, technologies: ['next'] }, FR)).toBe(true);
  });

  it('stack : une forme serveur exige la plateforme API puis un backend', () => {
    const base = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web'],
      architecture: 'microservices',
      step: 'stack' as const,
      technologies: ['next'],
      resolution: { status: 'certified' as const, issues: [] },
    };
    expect(blockedReason(base, FR)).toContain('API');

    const withApi = { ...base, targets: ['web', 'api'] };
    expect(blockedReason(withApi, FR)).toContain('Backend');
    expect(canAdvance({ ...withApi, technologies: ['next', 'hono'] }, FR)).toBe(true);
  });

  it('capabilities : la file d’attente d’une architecture événementielle est exigée', () => {
    const base = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web', 'api'],
      architecture: 'event-driven',
      technologies: ['next', 'hono', 'typescript'],
      step: 'capabilities' as const,
    };
    expect(canAdvance(base, FR)).toBe(false);
    expect(blockedReason(base, FR)).toContain('File d’attente');
    expect(canAdvance({ ...base, capabilities: ['bullmq'] }, FR)).toBe(true);
  });

  it('infrastructure : les conteneurs d’une architecture de services sont exigés', () => {
    const base = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web', 'api'],
      architecture: 'microservices',
      technologies: ['next', 'hono', 'typescript'],
      capabilities: ['bullmq'],
      step: 'infrastructure' as const,
    };
    expect(canAdvance(base, FR)).toBe(false);
    expect(blockedReason(base, FR)).toContain('Conteneurs');
    // La case Docker de l'écran vaut un choix de la catégorie `containers`.
    expect(canAdvance({ ...base, infra: { docker: true, ci: false } }, FR)).toBe(true);
  });

  it('un ORM sans base de données est refusé avant la génération', () => {
    const base = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web'],
      architecture: 'single-app',
      technologies: ['next', 'typescript', 'prisma'],
      step: 'stack' as const,
      resolution: { status: 'certified' as const, issues: [] },
    };
    expect(blockedReason(base, FR)).toContain('ORM');
    expect(
      canAdvance({ ...base, technologies: ['next', 'typescript', 'prisma', 'postgresql'] }, FR),
    ).toBe(true);
  });

  it('les étapes sans bloquant écrit passent', () => {
    for (const step of [
      'type',
      'architecture',
      'capabilities',
      'env',
      'infrastructure',
      'blueprint',
      'preview',
      'generate',
      'report',
    ] as const) {
      expect(canAdvance({ ...freshDraft(), step }, FR)).toBe(true);
      expect(blockedReason({ ...freshDraft(), step }, FR)).toBeUndefined();
    }
  });
});

describe('blockedReason la phrase que l’écran affiche', () => {
  it('dit quoi corriger quand le nom ne convient pas', () => {
    expect(blockedReason({ ...freshDraft(), name: 'Espace Interdit' }, FR)).toContain('nom');
    expect(blockedReason({ ...freshDraft(), name: 'mon-projet' }, FR)).toBeUndefined();
  });

  it('réclame une plateforme, puis se taît dès qu’il y en a une', () => {
    expect(blockedReason({ ...freshDraft(), step: 'target' }, FR)).toContain('plateforme');
    expect(
      blockedReason({ ...freshDraft(), step: 'target', targets: ['web'] }, FR),
    ).toBeUndefined();
  });

  it('porte le refus du moteur tel quel : c’est lui qui explique (§12)', () => {
    const base = {
      ...freshDraft(),
      name: 'ok',
      targets: ['web'],
      step: 'stack' as const,
      technologies: ['next', 'typescript'],
    };
    expect(blockedReason(base, FR)).toContain('compatibilité');
    expect(
      blockedReason(
        { ...base, resolution: { status: 'certified', issues: ['prisma exclut X'] } },
        FR,
      ),
    ).toBe('prisma exclut X');
  });
});

describe('le verdict du moteur est opposable partout', () => {
  const refused = { status: 'certified' as const, issues: ['prisma exclut X'] };
  const base = {
    ...freshDraft(),
    name: 'ok',
    targets: ['web'],
    technologies: ['next', 'typescript'],
  };

  it('bloque les écrans après le Stack : capacités, infrastructure, plan', () => {
    for (const step of ['capabilities', 'infrastructure', 'blueprint'] as const) {
      expect(blockedReason({ ...base, step, resolution: refused }, FR)).toBe('prisma exclut X');
    }
  });

  it('laisse passer un verdict certifié', () => {
    for (const step of ['capabilities', 'infrastructure'] as const) {
      expect(
        blockedReason({ ...base, step, resolution: { status: 'certified', issues: [] } }, FR),
      ).toBeUndefined();
    }
  });

  it('un verdict absent ne bloque pas un écran avancé : il y sera recalculé', () => {
    // Seul le Stack exige que la vérification ait eu lieu : un rechargement
    // direct sur un écran avancé ne doit pas rester coincé sur une vérification
    // que personne n'a encore relancée.
    expect(blockedReason({ ...base, step: 'infrastructure' }, FR)).toBeUndefined();
    expect(blockedReason({ ...base, step: 'stack' }, FR)).toContain('compatibilité');
  });
});

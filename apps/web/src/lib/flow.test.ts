import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import { canAdvance, nextStep, previousStep, STEP_ORDER, type StepId, stepIndex } from './flow';

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

describe('canAdvance — bloquants du §6', () => {
  it('create : un nom conforme passe', () => {
    expect(canAdvance({ ...freshDraft(), name: 'mon-projet' })).toBe(true);
  });

  it('create : un nom vide est refusé', () => {
    expect(canAdvance({ ...freshDraft(), name: '' })).toBe(false);
  });

  it('create : un nom invalide selon le pattern du manifest est refusé', () => {
    expect(canAdvance({ ...freshDraft(), name: 'Espace Interdit' })).toBe(false);
  });

  it('target : au moins une cible', () => {
    expect(canAdvance({ ...freshDraft(), step: 'target', targets: [] })).toBe(false);
    expect(canAdvance({ ...freshDraft(), step: 'target', targets: ['web'] })).toBe(true);
  });

  it('stack : la résolution doit exister et ne porter aucun problème', () => {
    const base = { ...freshDraft(), name: 'ok', targets: ['web'], step: 'stack' as const };
    expect(canAdvance(base)).toBe(false);
    expect(canAdvance({ ...base, resolution: { status: 'certified', issues: ['doublon'] } })).toBe(
      false,
    );
    expect(canAdvance({ ...base, resolution: { status: 'certified', issues: [] } })).toBe(true);
    expect(canAdvance({ ...base, resolution: { status: 'experimental', issues: [] } })).toBe(true);
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
      expect(canAdvance({ ...freshDraft(), step })).toBe(true);
    }
  });
});

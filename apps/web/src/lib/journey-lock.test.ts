import { describe, expect, it } from 'vitest';
import { STEP_ORDER, type StepId } from './flow';
import { isGenerated, lockedRedirect, lockSource } from './journey-lock';

const OPEN: readonly StepId[] = ['generate', 'report'];
const CLOSED = STEP_ORDER.filter((step) => !OPEN.includes(step));

describe('isGenerated', () => {
  it('ne verrouille que sur le drapeau posé', () => {
    expect(isGenerated({})).toBe(false);
    expect(isGenerated({ generated: true })).toBe(true);
  });
});

describe('lockedRedirect', () => {
  it('ne renvoie jamais personne tant que rien n’est généré', () => {
    for (const step of STEP_ORDER) {
      expect(lockedRedirect(step, { step: 'report' })).toBeNull();
    }
  });

  it('laisse ouverts la Génération et le Rapport', () => {
    for (const step of OPEN) {
      expect(lockedRedirect(step, { step: 'report', generated: true })).toBeNull();
      expect(lockedRedirect(step, { step: 'generate', generated: true })).toBeNull();
    }
  });

  it('referme les dix premières étapes vers le Rapport quand le parcours s’y était arrêté', () => {
    expect(CLOSED).toHaveLength(10);
    for (const step of CLOSED) {
      expect(lockedRedirect(step, { step: 'report', generated: true })).toBe('report');
    }
  });

  it('sinon vers la Génération', () => {
    expect(lockedRedirect('stack', { step: 'generate', generated: true })).toBe('generate');
    expect(lockedRedirect('create', { step: 'stack', generated: true })).toBe('generate');
  });
});

describe('lockSource', () => {
  it('préfère le stockage quand il porte le verrou : il garde la dernière étape vraie', () => {
    const memory = { step: 'stack' as const, generated: true as const };
    const stored = { step: 'report' as const, generated: true as const };
    expect(lockSource(memory, stored)).toBe(stored);
  });

  it('retombe sur la mémoire sans stockage généré', () => {
    const memory = { step: 'generate' as const, generated: true as const };
    expect(lockSource(memory, { step: 'create' })).toBe(memory);
  });
});

import { describe, expect, it } from 'vitest';
import { createStepMemory, slideDirection, stepMemory, TRACE_TTL_MS } from './journey-transition';

describe('slideDirection', () => {
  it('sans trace (rechargement, accès direct), rien ne glisse', () => {
    expect(slideDirection(null, 3, 0)).toBe('none');
  });

  it('avancer entre par la droite, reculer par la gauche', () => {
    expect(slideDirection({ index: 2, leftAt: null }, 3, 0)).toBe('forward');
    expect(slideDirection({ index: 5, leftAt: null }, 1, 0)).toBe('backward');
  });

  it('un remontage sur la même étape ne bouge pas', () => {
    expect(slideDirection({ index: 4, leftAt: null }, 4, 0)).toBe('none');
  });

  it('une trace quittée depuis trop longtemps est périmée', () => {
    expect(slideDirection({ index: 2, leftAt: 1000 }, 3, 1000 + TRACE_TTL_MS)).toBe('forward');
    expect(slideDirection({ index: 2, leftAt: 1000 }, 3, 1001 + TRACE_TTL_MS)).toBe('none');
  });

  it('un rang hors parcours ne glisse pas', () => {
    expect(slideDirection({ index: 2, leftAt: null }, -1, 0)).toBe('none');
  });
});

describe('createStepMemory', () => {
  it('retient l’étape montrée puis l’heure de sa sortie', () => {
    const memory = createStepMemory();
    expect(memory.read()).toBeNull();
    memory.enter(2);
    expect(memory.read()).toEqual({ index: 2, leftAt: null });
    memory.leave(2, 50);
    expect(memory.read()).toEqual({ index: 2, leftAt: 50 });
  });

  it('une sortie tardive n’écrase pas l’écran qui a déjà pris la place', () => {
    const memory = createStepMemory();
    memory.enter(2);
    memory.enter(3);
    memory.leave(2, 50);
    expect(memory.read()).toEqual({ index: 3, leftAt: null });
    memory.leave(3, 60);
    memory.leave(3, 90);
    expect(memory.read()).toEqual({ index: 3, leftAt: 60 });
  });

  it('clear oublie tout', () => {
    const memory = createStepMemory();
    memory.enter(1);
    memory.clear();
    expect(memory.read()).toBeNull();
  });

  it('la mémoire partagée part vide', () => {
    expect(stepMemory.read()).toBeNull();
  });
});

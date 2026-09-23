import { describe, expect, it } from 'vitest';
import { ARCHITECTURES, architectureSchema, TARGETS, targetSchema } from './enums.js';

describe('TARGETS', () => {
  it('correspond aux cibles du §4', () => {
    expect([...TARGETS]).toEqual(['web', 'mobile', 'desktop', 'api', 'library']);
  });

  it.each(TARGETS)('accepte %s', (value) => {
    expect(targetSchema.safeParse(value).success).toBe(true);
  });

  it.each(['Web', 'wbe', 'ios', 'android', '', 'web '])('refuse %s', (value) => {
    expect(targetSchema.safeParse(value).success).toBe(false);
  });

  it('expose les valeurs acceptées dans l’erreur — matière première de l’indice', () => {
    const result = targetSchema.safeParse('wbe');
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.code).toBe('invalid_value');
    }
  });
});

describe('ARCHITECTURES', () => {
  it('correspond aux architectures du §7.23 retenues pour le manifest', () => {
    expect([...ARCHITECTURES]).toEqual([
      'single-app',
      'monorepo',
      'modular-monolith',
      'microservices',
      'serverless',
      'event-driven',
    ]);
  });

  it.each(ARCHITECTURES)('accepte %s', (value) => {
    expect(architectureSchema.safeParse(value).success).toBe(true);
  });

  it.each(['monolith', 'Monorepo', 'mono-repo', ''])('refuse %s', (value) => {
    expect(architectureSchema.safeParse(value).success).toBe(false);
  });
});

describe('fermeture des énumérations', () => {
  it('aucune énumération ne contient un nom de technologie', () => {
    const forbidden = ['next', 'expo', 'tauri', 'react', 'nestjs', 'postgresql'];
    for (const value of [...TARGETS, ...ARCHITECTURES]) {
      expect(forbidden).not.toContain(value);
    }
  });
});

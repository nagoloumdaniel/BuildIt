import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import { hasChoices } from './journey-cancel';

describe('hasChoices', () => {
  it('un brouillon neuf ne porte aucun choix, même avancé dans le parcours', () => {
    expect(hasChoices(freshDraft())).toBe(false);
    expect(hasChoices({ ...freshDraft(), step: 'stack', mode: 'expert' })).toBe(false);
  });

  it.each([
    ['nom', { name: 'mon-app' }],
    ['plateformes', { targets: ['web'] }],
    ['type', { type: 'saas' }],
    ['architecture', { architecture: 'monolith' }],
    ['technologies', { technologies: ['next'] }],
    ['capacités', { capabilities: ['auth'] }],
    ['variables', { envVarNames: ['API_KEY'] }],
    ['docker', { infra: { docker: true, ci: false } }],
    ['ci', { infra: { docker: false, ci: true } }],
  ])('compte « %s » comme un choix', (_label, patch) => {
    expect(hasChoices({ ...freshDraft(), ...patch })).toBe(true);
  });
});

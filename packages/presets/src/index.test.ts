import { planProject } from '@project-factory/generator';
import { parseManifest, serializeManifest } from '@project-factory/manifest';
import { describe, expect, it } from 'vitest';
import { getPreset, PRESET_IDS, PRESETS } from './index.js';

describe('presets', () => {
  it('un preset par identifiant, dans l’ordre annoncé', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual([...PRESET_IDS]);
  });

  it.each(PRESET_IDS)('%s : le manifest est valide et déjà canonique', (id) => {
    const manifest = getPreset(id)?.manifest('demo');
    const parsed = parseManifest(manifest);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      // Canonique : la même forme qu'après un aller-retour — un preset ne
      // doit pas produire un autre manifest selon qu'il passe par le CLI ou
      // par un fichier.
      expect(serializeManifest(parsed.value)).toBe(serializeManifest(manifest as never));
    }
  });

  it.each(PRESET_IDS)(
    '%s : se planifie, recettes comprises, sans combinaison expérimentale',
    (id) => {
      const preset = getPreset(id);
      if (preset === undefined) {
        throw new Error(`preset absent : ${id}`);
      }
      const result = planProject(preset.manifest('demo'), '/cible', { recipes: preset.recipes });
      expect(
        result.ok,
        result.ok ? '' : result.issues.map((issue) => issue.message).join(' | '),
      ).toBe(true);
      if (result.ok) {
        expect(result.value.warnings.map((warning) => warning.code)).not.toContain(
          'COMPAT_EXPERIMENTAL_COMBINATION',
        );
      }
    },
  );

  it('un identifiant inconnu ne rend rien', () => {
    expect(getPreset('marketplace')).toBeUndefined();
  });
});

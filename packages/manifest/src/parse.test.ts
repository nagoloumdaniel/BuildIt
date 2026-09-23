import { describe, expect, it } from 'vitest';
import type { ManifestIssueCode } from './errors.js';
import { parseManifest } from './parse.js';

/**
 * Le manifest d'exemple du cahier des charges §10, augmenté du seul champ que
 * le §10 laissait implicite : `manifestVersion`. Il doit valider tel quel —
 * si le spec et le code divergent, c'est ce test qui le dit.
 */
const SPEC_EXAMPLE = {
  manifestVersion: 1,
  name: 'my-project',
  targets: ['web', 'mobile'],
  architecture: 'monorepo',
  apps: ['web', 'mobile', 'api', 'admin'],
  frontend: { framework: 'next', language: 'typescript', styling: 'tailwind' },
  mobile: { framework: 'expo', language: 'typescript' },
  backend: { framework: 'nestjs' },
  database: { engine: 'postgresql', orm: 'drizzle' },
  auth: { provider: 'better-auth' },
  services: ['redis', 'storage', 'email', 'payments'],
  quality: ['biome', 'vitest', 'playwright'],
  infra: ['docker', 'github-actions'],
  shareLink: { enabled: true, readOnly: true },
};

const MINIMAL = {
  manifestVersion: 1,
  name: 'quai3',
  targets: ['web'],
  architecture: 'single-app',
};

function codesOf(input: unknown): ManifestIssueCode[] {
  const result = parseManifest(input);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('parseManifest — acceptation', () => {
  it('valide le manifest d’exemple du §10 sans modification', () => {
    const result = parseManifest(SPEC_EXAMPLE);
    expect(result.ok ? null : result.issues).toBeNull();
  });

  it('valide un manifest minimal', () => {
    expect(parseManifest(MINIMAL).ok).toBe(true);
  });

  it('conserve les valeurs typées', () => {
    const result = parseManifest(SPEC_EXAMPLE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.database?.orm).toBe('drizzle');
      expect(result.value.shareLink?.readOnly).toBe(true);
    }
  });

  it('rend un manifest en forme canonique — les ensembles sont triés', () => {
    const result = parseManifest(SPEC_EXAMPLE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.targets).toEqual(['mobile', 'web']);
      expect(result.value.services).toEqual(['email', 'payments', 'redis', 'storage']);
    }
  });

  it('deux saisies équivalentes donnent des manifests structurellement égaux', () => {
    const a = parseManifest({ ...MINIMAL, services: ['redis', 'email'] });
    const b = parseManifest({ ...MINIMAL, services: ['email', 'redis'] });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value).toEqual(b.value);
    }
  });
});

describe('parseManifest — ne lève jamais', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['nombre', 42],
    ['chaîne', 'texte'],
    ['booléen', true],
    ['tableau', []],
    ['objet vide', {}],
    ['fonction', () => undefined],
    ['NaN', Number.NaN],
  ])('%s ne provoque pas d’exception', (_label, input) => {
    expect(() => parseManifest(input)).not.toThrow();
    expect(parseManifest(input).ok).toBe(false);
  });
});

describe('parseManifest — entrée non-objet', () => {
  it.each([null, 42, 'texte', true, []])('signale MANIFEST_NOT_AN_OBJECT pour %s', (input) => {
    expect(codesOf(input)).toContain('MANIFEST_NOT_AN_OBJECT');
  });
});

describe('parseManifest — version', () => {
  it('signale une version absente', () => {
    expect(codesOf({ name: 'x', targets: ['web'], architecture: 'single-app' })).toContain(
      'MANIFEST_VERSION_MISSING',
    );
  });

  it('signale une version future', () => {
    expect(codesOf({ ...MINIMAL, manifestVersion: 2 })).toContain('MANIFEST_VERSION_UNSUPPORTED');
  });

  it('signale une version non numérique', () => {
    expect(codesOf({ ...MINIMAL, manifestVersion: '1' })).toContain('MANIFEST_VERSION_UNSUPPORTED');
  });

  it('ne rapporte que le problème de version — inutile de noyer l’utilisateur', () => {
    const codes = codesOf({ manifestVersion: 99, name: 'PAS BON', targets: [] });
    expect(codes).toEqual(['MANIFEST_VERSION_UNSUPPORTED']);
  });
});

describe('parseManifest — champs requis', () => {
  it.each(['name', 'targets', 'architecture'])('signale l’absence de %s', (field) => {
    const input: Record<string, unknown> = { ...MINIMAL };
    delete input[field];
    expect(codesOf(input)).toContain('MANIFEST_FIELD_REQUIRED');
  });

  it('rapporte tous les champs manquants d’un coup', () => {
    expect(codesOf({ manifestVersion: 1 })).toHaveLength(3);
  });
});

describe('parseManifest — valeurs invalides', () => {
  it('signale un nom de projet invalide', () => {
    expect(codesOf({ ...MINIMAL, name: 'Mon Projet' })).toContain('MANIFEST_NAME_INVALID');
  });

  it('signale un nom vide', () => {
    expect(codesOf({ ...MINIMAL, name: '' })).toContain('MANIFEST_NAME_INVALID');
  });

  it('signale un nom trop long', () => {
    expect(codesOf({ ...MINIMAL, name: 'a'.repeat(215) })).toContain('MANIFEST_NAME_INVALID');
  });

  it('signale une cible inconnue', () => {
    expect(codesOf({ ...MINIMAL, targets: ['wbe'] })).toContain('MANIFEST_ENUM_UNKNOWN');
  });

  it('signale une architecture inconnue', () => {
    expect(codesOf({ ...MINIMAL, architecture: 'monolith' })).toContain('MANIFEST_ENUM_UNKNOWN');
  });

  it('signale une liste de cibles vide', () => {
    expect(codesOf({ ...MINIMAL, targets: [] })).toContain('MANIFEST_TARGETS_EMPTY');
  });

  it('signale un doublon dans services', () => {
    expect(codesOf({ ...MINIMAL, services: ['redis', 'redis'] })).toContain(
      'MANIFEST_DUPLICATE_ENTRY',
    );
  });

  it('signale un slug de technologie invalide', () => {
    expect(
      codesOf({ ...MINIMAL, frontend: { framework: 'Next.js', language: 'typescript' } }),
    ).toContain('MANIFEST_SLUG_INVALID');
  });

  it('signale un champ inconnu plutôt que de l’ignorer', () => {
    expect(codesOf({ ...MINIMAL, frontEnd: {} })).toContain('MANIFEST_UNKNOWN_FIELD');
  });

  it('signale un champ inconnu imbriqué', () => {
    expect(codesOf({ ...MINIMAL, database: { engine: 'postgresql', ormm: 'drizzle' } })).toContain(
      'MANIFEST_UNKNOWN_FIELD',
    );
  });

  it('signale un type incorrect', () => {
    expect(codesOf({ ...MINIMAL, targets: 'web' })).toContain('MANIFEST_TYPE_MISMATCH');
  });
});

describe('parseManifest — indices', () => {
  it('propose la cible la plus proche sur une faute de frappe', () => {
    const result = parseManifest({ ...MINIMAL, targets: ['wbe'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.hint).toContain('web');
    }
  });

  it('ne propose rien quand la saisie n’évoque aucune valeur connue', () => {
    const result = parseManifest({ ...MINIMAL, targets: ['quelquechosedetrescompletementautre'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.hint).toBeUndefined();
    }
  });
});

describe('parseManifest — chemins', () => {
  it('pointe le champ fautif, index de tableau compris', () => {
    const result = parseManifest({ ...MINIMAL, targets: ['web', 'wbe'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toEqual(['targets', 1]);
    }
  });

  it('pointe un champ imbriqué', () => {
    const result = parseManifest({
      ...MINIMAL,
      database: { engine: 'postgresql', orm: 'Drizzle' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.path).toEqual(['database', 'orm']);
    }
  });
});

describe('parseManifest — aucun message vide', () => {
  it('chaque problème porte un message non vide', () => {
    const result = parseManifest({ ...MINIMAL, name: 'BAD', targets: ['wbe'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues) {
        expect(issue.message.length).toBeGreaterThan(0);
        expect(issue.message).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });
});

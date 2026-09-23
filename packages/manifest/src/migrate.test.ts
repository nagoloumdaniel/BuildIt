import { describe, expect, it } from 'vitest';
import { applyMigrations, MIGRATIONS, type Migration, migrateManifest } from './migrate.js';

const MINIMAL_V1 = {
  manifestVersion: 1,
  name: 'quai3',
  targets: ['web'],
  architecture: 'single-app',
};

describe('MIGRATIONS', () => {
  it('est vide aujourd’hui — il n’existe qu’une version de schéma', () => {
    expect(MIGRATIONS).toHaveLength(0);
  });
});

describe('migrateManifest — sans migration à appliquer', () => {
  it('laisse passer un manifest déjà à la version courante', () => {
    const result = migrateManifest(MINIMAL_V1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('quai3');
    }
  });

  it('refuse une version antérieure sans migration disponible', () => {
    const result = migrateManifest({ ...MINIMAL_V1, manifestVersion: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('MANIFEST_VERSION_UNSUPPORTED');
    }
  });

  it('refuse une version future', () => {
    const result = migrateManifest({ ...MINIMAL_V1, manifestVersion: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('MANIFEST_VERSION_UNSUPPORTED');
    }
  });

  it('ne lève jamais', () => {
    for (const input of [null, undefined, 42, 'texte', [], {}]) {
      expect(() => migrateManifest(input)).not.toThrow();
    }
  });
});

/**
 * La machinerie est livrée vide. Ces tests prouvent qu'elle fonctionne, en
 * injectant une migration factice — pour ne pas avoir à inventer le mécanisme
 * dans l'urgence le jour où la V1 ajoutera mobile et desktop (§23), sur un
 * format déjà diffusé par des liens de partage.
 */
describe('applyMigrations — machinerie', () => {
  const v0ToV1: Migration = {
    from: 0,
    to: 1,
    migrate: (input) => {
      const source = input as Record<string, unknown>;
      const { platform, ...rest } = source;
      return { ...rest, manifestVersion: 1, targets: [platform] };
    },
  };

  it('applique une migration et produit un manifest valide', () => {
    const legacy = {
      manifestVersion: 0,
      name: 'quai3',
      platform: 'web',
      architecture: 'single-app',
    };
    const result = applyMigrations(legacy, [v0ToV1]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.manifestVersion).toBe(1);
      expect(result.value.targets).toEqual(['web']);
    }
  });

  it('enchaîne plusieurs migrations dans l’ordre des versions', () => {
    const renameProject: Migration = {
      from: -1,
      to: 0,
      migrate: (input) => {
        const source = input as Record<string, unknown>;
        const { projectName, ...rest } = source;
        return { ...rest, manifestVersion: 0, name: projectName };
      },
    };
    const ancient = {
      manifestVersion: -1,
      projectName: 'quai3',
      platform: 'web',
      architecture: 'single-app',
    };
    const result = applyMigrations(ancient, [v0ToV1, renameProject]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('quai3');
      expect(result.value.targets).toEqual(['web']);
    }
  });

  it('refuse quand la chaîne est interrompue', () => {
    const result = applyMigrations({ manifestVersion: -1 }, [v0ToV1]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.code).toBe('MANIFEST_VERSION_UNSUPPORTED');
    }
  });

  it('valide le résultat de la migration — une migration boguée ne passe pas', () => {
    const broken: Migration = {
      from: 0,
      to: 1,
      migrate: () => ({ manifestVersion: 1, name: 'PAS VALIDE' }),
    };
    const result = applyMigrations({ manifestVersion: 0 }, [broken]);
    expect(result.ok).toBe(false);
  });

  it('survit à une migration qui lève une exception', () => {
    const throwing: Migration = {
      from: 0,
      to: 1,
      migrate: () => {
        throw new Error('boum');
      },
    };
    expect(() => applyMigrations({ manifestVersion: 0 }, [throwing])).not.toThrow();
    expect(applyMigrations({ manifestVersion: 0 }, [throwing]).ok).toBe(false);
  });
});

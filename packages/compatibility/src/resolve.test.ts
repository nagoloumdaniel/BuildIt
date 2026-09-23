import { loadRegistry, type Registry, type RegistryEntry } from '@project-factory/registry';
import { describe, expect, it } from 'vitest';
import { optionsFor, resolve } from './resolve.js';

function entry(patch: Partial<RegistryEntry> & { id: string }): RegistryEntry {
  return {
    name: patch.id,
    category: 'frontend',
    targets: ['web'],
    status: 'stable',
    generation: 'declared',
    license: 'MIT',
    lastReviewedAt: '2026-09-23',
    ...patch,
  };
}

function registryOf(entries: RegistryEntry[]): Registry {
  const result = loadRegistry(entries);
  if (!result.ok) {
    throw new Error(`fixture invalide : ${result.issues.map((i) => i.message).join(' | ')}`);
  }
  return result.value;
}

const BASE = registryOf([
  entry({ id: 'typescript', category: 'language', targets: ['web', 'api'] }),
  entry({ id: 'next', requires: ['typescript'] }),
  entry({ id: 'vue', requires: ['typescript'] }),
  entry({ id: 'prisma', category: 'orm', targets: ['web', 'api'], requires: ['typescript'] }),
  entry({ id: 'drizzle', category: 'orm', targets: ['web', 'api'], requires: ['typescript'] }),
  entry({ id: 'vitest', category: 'testing', targets: ['web', 'api'] }),
  entry({ id: 'playwright', category: 'testing' }),
  entry({ id: 'nestjs', category: 'backend', targets: ['api'] }),
]);

const codes = (result: ReturnType<typeof resolve>): string[] =>
  result.ok ? [] : result.issues.map((issue) => issue.code);

describe('résolution', () => {
  it('résout une sélection déjà complète', () => {
    const result = resolve({ targets: ['web'], technologies: ['typescript'] }, BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.technologies).toEqual(['typescript']);
      expect(result.value.additions).toEqual([]);
    }
  });

  it('ajoute les dépendances obligatoires', () => {
    const result = resolve({ targets: ['web'], technologies: ['next'] }, BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.technologies).toEqual(['next', 'typescript']);
    }
  });

  it('dit ce qu’il a ajouté et pourquoi', () => {
    const result = resolve({ targets: ['web'], technologies: ['next'] }, BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.additions).toEqual([{ id: 'typescript', requiredBy: 'next' }]);
    }
  });

  it('résout en profondeur', () => {
    const deep = registryOf([
      entry({ id: 'a', requires: ['b'] }),
      entry({ id: 'b', category: 'orm', requires: ['c'] }),
      entry({ id: 'c', category: 'language' }),
    ]);
    const result = resolve({ targets: ['web'], technologies: ['a'] }, deep);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.technologies).toEqual(['a', 'b', 'c']);
    }
  });

  it('n’ajoute pas deux fois une dépendance partagée', () => {
    const shared = registryOf([
      entry({ id: 'typescript', category: 'language' }),
      entry({ id: 'a', requires: ['typescript'] }),
      entry({ id: 'b', category: 'orm', requires: ['typescript'] }),
    ]);
    const result = resolve({ targets: ['web'], technologies: ['a', 'b'] }, shared);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.technologies).toEqual(['a', 'b', 'typescript']);
      expect(result.value.additions).toHaveLength(1);
    }
  });

  it('rend les technologies triées — sortie reproductible', () => {
    const a = resolve({ targets: ['web'], technologies: ['next', 'vitest'] }, BASE);
    const b = resolve({ targets: ['web'], technologies: ['vitest', 'next'] }, BASE);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.value.technologies).toEqual(b.value.technologies);
    }
  });
});

describe('erreurs de résolution', () => {
  it('signale une technologie inconnue', () => {
    expect(codes(resolve({ targets: ['web'], technologies: ['inexistant'] }, BASE))).toContain(
      'COMPAT_UNKNOWN_TECHNOLOGY',
    );
  });

  it('signale deux technologies d’une catégorie exclusive', () => {
    expect(
      codes(resolve({ targets: ['web'], technologies: ['prisma', 'drizzle'] }, BASE)),
    ).toContain('COMPAT_EXCLUSIVE_CATEGORY');
  });

  it('accepte deux technologies d’une catégorie cumulative', () => {
    expect(resolve({ targets: ['web'], technologies: ['vitest', 'playwright'] }, BASE).ok).toBe(
      true,
    );
  });

  it('signale une technologie hors des cibles choisies', () => {
    expect(codes(resolve({ targets: ['web'], technologies: ['nestjs'] }, BASE))).toContain(
      'COMPAT_TARGET_UNSUPPORTED',
    );
  });

  it('signale une sélection sans cible', () => {
    expect(codes(resolve({ targets: [], technologies: ['next'] }, BASE))).toContain(
      'COMPAT_NO_TARGET',
    );
  });

  it('détecte un cycle plutôt que de boucler indéfiniment', () => {
    const cyclic = registryOf([
      entry({ id: 'a', requires: ['b'] }),
      entry({ id: 'b', category: 'orm', requires: ['a'] }),
    ]);
    expect(codes(resolve({ targets: ['web'], technologies: ['a'] }, cyclic))).toContain(
      'COMPAT_CIRCULAR_DEPENDENCY',
    );
  });

  it('ne lève jamais', () => {
    const cyclic = registryOf([
      entry({ id: 'a', requires: ['b'] }),
      entry({ id: 'b', category: 'orm', requires: ['a'] }),
    ]);
    for (const selection of [
      { targets: [] as never[], technologies: [] },
      { targets: ['web' as const], technologies: ['inexistant'] },
      { targets: ['web' as const], technologies: ['a'] },
    ]) {
      expect(() => resolve(selection, cyclic)).not.toThrow();
    }
  });

  it('une sélection vide avec une cible est valide', () => {
    expect(resolve({ targets: ['web'], technologies: [] }, BASE).ok).toBe(true);
  });
});

describe('statut de la combinaison', () => {
  it('expérimentale dès qu’une technologie n’est pas certifiée', () => {
    const result = resolve({ targets: ['web'], technologies: ['next'] }, BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('experimental');
      expect(result.value.warnings.map((w) => w.code)).toContain('COMPAT_EXPERIMENTAL_COMBINATION');
    }
  });

  it('certifiée quand toutes les technologies le sont', () => {
    const certified = registryOf([
      entry({ id: 'a', generation: 'certified', template: 'frontend/a' }),
      entry({ id: 'b', category: 'orm', generation: 'certified', template: 'orm/b' }),
    ]);
    const result = resolve({ targets: ['web'], technologies: ['a', 'b'] }, certified);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('certified');
      expect(result.value.warnings).toEqual([]);
    }
  });

  it('une sélection vide est certifiée — rien de non testé n’y figure', () => {
    const result = resolve({ targets: ['web'], technologies: [] }, BASE);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('certified');
    }
  });

  it('remonte les avertissements de licence et de dépréciation', () => {
    const flagged = registryOf([
      entry({ id: 'mongodb', category: 'database', license: 'SSPL-1.0' }),
      entry({ id: 'vieux', category: 'orm', status: 'deprecated' }),
    ]);
    const result = resolve({ targets: ['web'], technologies: ['mongodb', 'vieux'] }, flagged);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const warned = result.value.warnings.map((w) => w.code);
      expect(warned).toContain('COMPAT_RESTRICTIVE_LICENSE');
      expect(warned).toContain('COMPAT_DEPRECATED_TECHNOLOGY');
    }
  });
});

describe('optionsFor — le §5', () => {
  it('rend toutes les options de la catégorie, jamais une liste filtrée', () => {
    const options = optionsFor('orm', { targets: ['web'], technologies: [] }, BASE);
    expect(options.map((option) => option.entry.id)).toEqual(['drizzle', 'prisma']);
  });

  it('marque l’option déjà choisie', () => {
    const options = optionsFor('orm', { targets: ['web'], technologies: ['prisma'] }, BASE);
    expect(options.find((option) => option.entry.id === 'prisma')?.state).toBe('selected');
  });

  it('marque bloquée l’option incompatible, sans la masquer', () => {
    const options = optionsFor('orm', { targets: ['web'], technologies: ['prisma'] }, BASE);
    const drizzle = options.find((option) => option.entry.id === 'drizzle');
    expect(drizzle).toBeDefined();
    expect(drizzle?.state).toBe('blocked');
  });

  it('dit pourquoi une option est bloquée — c’est l’info-bulle du §5', () => {
    const options = optionsFor('orm', { targets: ['web'], technologies: ['prisma'] }, BASE);
    const drizzle = options.find((option) => option.entry.id === 'drizzle');
    expect(drizzle?.reason).toBeDefined();
    expect(drizzle?.reason).toContain('prisma');
  });

  it('marque disponible une option compatible', () => {
    const options = optionsFor('testing', { targets: ['web'], technologies: ['vitest'] }, BASE);
    expect(options.find((option) => option.entry.id === 'playwright')?.state).toBe('available');
  });

  it('bloque une option hors des cibles choisies', () => {
    const options = optionsFor('backend', { targets: ['web'], technologies: [] }, BASE);
    expect(options.find((option) => option.entry.id === 'nestjs')?.state).toBe('blocked');
  });

  it('rend une liste vide pour une catégorie sans fiche', () => {
    expect(optionsFor('ai', { targets: ['web'], technologies: [] }, BASE)).toEqual([]);
  });

  it('aucune option bloquée n’est sans raison', () => {
    const categories = ['orm', 'frontend', 'backend', 'testing'] as const;
    for (const category of categories) {
      for (const option of optionsFor(
        category,
        { targets: ['web'], technologies: ['prisma', 'next'] },
        BASE,
      )) {
        if (option.state === 'blocked') {
          expect(option.reason, `raison manquante : ${option.entry.id}`).toBeTruthy();
        }
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { projectNameSchema, techSlugSchema, uniqueArray } from './primitives.js';

describe('projectNameSchema', () => {
  it.each(['a', 'my-project', 'project.factory', 'my_lib', 'quai3', 'a'.repeat(214)])(
    'accepte %s',
    (value) => {
      expect(projectNameSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    ['vide', ''],
    ['majuscules', 'MyProject'],
    ['espace', 'my project'],
    ['commence par un point', '.hidden'],
    ['commence par un tiret bas', '_private'],
    ['caractère interdit', 'my/project'],
    ['accent', 'projét'],
    ['trop long', 'a'.repeat(215)],
  ])('refuse %s', (_label, value) => {
    expect(projectNameSchema.safeParse(value).success).toBe(false);
  });

  it('refuse une valeur qui n’est pas une chaîne', () => {
    expect(projectNameSchema.safeParse(42).success).toBe(false);
  });
});

describe('techSlugSchema', () => {
  it.each(['next', 'better-auth', 'github-actions', 'pg', 's3', 'oauth2'])(
    'accepte %s',
    (value) => {
      expect(techSlugSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each([
    ['vide', ''],
    ['majuscules', 'Next'],
    ['tiret initial', '-next'],
    ['tiret final', 'next-'],
    ['double tiret', 'better--auth'],
    ['tiret bas', 'better_auth'],
    ['point', 'next.js'],
    ['espace', 'better auth'],
  ])('refuse %s', (_label, value) => {
    expect(techSlugSchema.safeParse(value).success).toBe(false);
  });
});

describe('uniqueArray', () => {
  const schema = uniqueArray(techSlugSchema);

  it('accepte des valeurs distinctes', () => {
    expect(schema.safeParse(['redis', 'storage']).success).toBe(true);
  });

  it('accepte un tableau vide — la contrainte de non-vacuité est portée ailleurs', () => {
    expect(schema.safeParse([]).success).toBe(true);
  });

  it('refuse un doublon plutôt que de dédupliquer en silence', () => {
    const result = schema.safeParse(['redis', 'redis']);
    expect(result.success).toBe(false);
  });

  it('marque le doublon avec le code MANIFEST_DUPLICATE_ENTRY', () => {
    const result = schema.safeParse(['redis', 'redis']);
    expect(result.success).toBe(false);
    if (!result.success) {
      // `params` n'existe que sur les issues personnalisées : il faut restreindre
      // l'union avant d'y accéder. C'est exactement ce que fera parse.ts.
      const codes = result.error.issues
        .filter((issue) => issue.code === 'custom')
        .map((issue) => issue.params?.['pfCode']);
      expect(codes).toContain('MANIFEST_DUPLICATE_ENTRY');
    }
  });

  it('refuse un élément invalide', () => {
    expect(schema.safeParse(['redis', 'Redis!']).success).toBe(false);
  });
});

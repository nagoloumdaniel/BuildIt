import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { normalizeZodIssues } from './zod.js';

const schema = z
  .object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-z]+$/),
    kind: z.enum(['web', 'mobile']),
    count: z.number(),
    tags: z
      .array(z.string())
      .refine((values) => new Set(values).size === values.length, {
        params: { pfCode: 'DUPLICATE' },
        error: 'doublon',
      })
      .optional(),
  })
  .strict();

function kindsOf(input: unknown): string[] {
  const result = schema.safeParse(input);
  return result.success ? [] : normalizeZodIssues(result.error.issues, input).map((i) => i.kind);
}

const VALID = { name: 'ok', kind: 'web', count: 1 };

describe('champ manquant', () => {
  it.each(['name', 'kind', 'count'])('signale %s absent comme « required »', (field) => {
    const input: Record<string, unknown> = { ...VALID };
    delete input[field];
    expect(kindsOf(input)).toContain('required');
  });

  it('une énumération absente est « required », pas « enum-unknown »', () => {
    const { kind: _removed, ...rest } = VALID;
    expect(kindsOf(rest)).toEqual(['required']);
  });
});

describe('clé inconnue', () => {
  it('signale « unknown-field »', () => {
    expect(kindsOf({ ...VALID, inconnu: 1 })).toContain('unknown-field');
  });

  it('pointe la clé fautive, pas l’objet parent', () => {
    const result = schema.safeParse({ ...VALID, inconnu: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = normalizeZodIssues(result.error.issues, {});
      expect(issues[0]?.path).toEqual(['inconnu']);
    }
  });
});

describe('énumération', () => {
  it('signale « enum-unknown » et expose les valeurs acceptées', () => {
    const input = { ...VALID, kind: 'wbe' };
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = normalizeZodIssues(result.error.issues, input)[0];
      expect(issue?.kind).toBe('enum-unknown');
      expect(issue?.acceptedValues).toEqual(['web', 'mobile']);
    }
  });
});

describe('format', () => {
  it('une expression régulière non satisfaite est « format »', () => {
    expect(kindsOf({ ...VALID, name: 'ABC' })).toEqual(['format']);
  });

  it('une chaîne trop courte est aussi « format »', () => {
    expect(kindsOf({ ...VALID, name: '' })).toContain('format');
  });
});

describe('type', () => {
  it('signale « type-mismatch » et expose le type attendu', () => {
    const input = { ...VALID, count: 'x' };
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = normalizeZodIssues(result.error.issues, input)[0];
      expect(issue?.kind).toBe('type-mismatch');
      expect(issue?.expectedType).toBe('number');
    }
  });
});

describe('vérification personnalisée', () => {
  it('remonte le code déclaré en params.pfCode', () => {
    const input = { ...VALID, tags: ['a', 'a'] };
    const result = schema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = normalizeZodIssues(result.error.issues, input)[0];
      expect(issue?.kind).toBe('custom');
      expect(issue?.declaredCode).toBe('DUPLICATE');
    }
  });
});

describe('erreur Zod non répertoriée', () => {
  it('retombe sur « type-mismatch » plutôt que de perdre l’erreur', () => {
    const multiple = z.object({ n: z.number().multipleOf(5) });
    const input = { n: 3 };
    const result = multiple.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = normalizeZodIssues(result.error.issues, input)[0];
      expect(issue?.kind).toBe('type-mismatch');
      expect(issue?.value).toBe(3);
    }
  });
});

describe('rapport complet', () => {
  it('normalise toutes les erreurs, pas seulement la première', () => {
    expect(kindsOf({ name: 'ABC', kind: 'wbe', count: 'x', inconnu: 1 })).toHaveLength(4);
  });
});

describe('valeur fautive', () => {
  it('rapporte la valeur telle qu’elle apparaît dans l’entrée', () => {
    const input = { ...VALID, name: 'ABC' };
    const result = schema.safeParse(input);
    if (!result.success) {
      expect(normalizeZodIssues(result.error.issues, input)[0]?.value).toBe('ABC');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { type GenerationReport, loadReport, REPORT_STORAGE_KEY, saveReport } from './result';

/**
 * Le rapport vit dans `sessionStorage`, donc **derrière une frontière non
 * fiable** : n'importe quel JSON peut s'y trouver. `loadReport` ne fait jamais
 * confiance à la forme relue — un rapport corrompu rend `null`, pas un écran
 * cassé (§3 : une reprise impossible rend un état frais).
 */

function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

const REPORT: GenerationReport = {
  ok: true,
  directory: '/tmp/pf/mon-projet',
  files: ['package.json', 'src/app/page.tsx'],
  bytes: 2048,
  warnings: ['un avertissement'],
  steps: ['plan', 'write'],
  issues: [],
};

describe('saveReport / loadReport — aller-retour', () => {
  it('rend le rapport tel qu’écrit', () => {
    const storage = fakeStorage() as unknown as Storage;
    saveReport(storage, REPORT);
    expect(loadReport(storage)).toEqual(REPORT);
  });

  it('écrit sous la clé de session dédiée', () => {
    const map = fakeStorage();
    saveReport(map as unknown as Storage, REPORT);
    expect(map.getItem(REPORT_STORAGE_KEY)).not.toBeNull();
  });

  it('conserve un rapport d’échec — le rapport doit pouvoir dire le refus', () => {
    const storage = fakeStorage() as unknown as Storage;
    const refused: GenerationReport = {
      ok: false,
      directory: '',
      files: [],
      bytes: 0,
      warnings: [],
      steps: [],
      issues: ['Le dossier existe déjà.'],
    };
    saveReport(storage, refused);
    expect(loadReport(storage)).toEqual(refused);
  });
});

describe('loadReport — la relecture ne croit rien sur parole', () => {
  it('rend null sans stockage et sans valeur', () => {
    expect(loadReport(null)).toBeNull();
    expect(loadReport(fakeStorage() as unknown as Storage)).toBeNull();
  });

  it('rend null sur un JSON corrompu', () => {
    const storage = fakeStorage({ [REPORT_STORAGE_KEY]: '{"ok":' }) as unknown as Storage;
    expect(loadReport(storage)).toBeNull();
  });

  it.each([
    '[]',
    '"texte"',
    '42',
    'null',
    '{"ok":"oui"}',
    '{"ok":true}',
    '{"ok":true,"directory":42,"bytes":0}',
    '{"ok":true,"directory":"/tmp","bytes":"beaucoup"}',
  ])('rend null sur une forme hostile %s', (raw) => {
    const storage = fakeStorage({ [REPORT_STORAGE_KEY]: raw }) as unknown as Storage;
    expect(loadReport(storage)).toBeNull();
  });

  it('écarte les éléments non textuels des listes au lieu de les afficher', () => {
    const raw = JSON.stringify({
      ok: true,
      directory: '/tmp/pf',
      bytes: 10,
      files: ['package.json', 42, null, { path: 'x' }],
      warnings: 'pas un tableau',
      steps: ['plan'],
      issues: [],
    });
    const storage = fakeStorage({ [REPORT_STORAGE_KEY]: raw }) as unknown as Storage;
    expect(loadReport(storage)).toEqual({
      ok: true,
      directory: '/tmp/pf',
      bytes: 10,
      files: ['package.json'],
      warnings: [],
      steps: ['plan'],
      issues: [],
    });
  });

  it('un stockage qui lève ne fait pas tomber l’écran', () => {
    const hostile = {
      getItem: () => {
        throw new Error('refusé');
      },
      setItem: () => {
        throw new Error('refusé');
      },
    } as unknown as Storage;
    expect(loadReport(hostile)).toBeNull();
    expect(() => saveReport(hostile, REPORT)).not.toThrow();
  });
});

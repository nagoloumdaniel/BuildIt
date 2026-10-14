import { describe, expect, it } from 'vitest';
import {
  clearDraft,
  DRAFT_VERSION,
  freshDraft,
  loadDraft,
  restorePersistedDraft,
  samePersistedDraft,
  saveDraft,
} from './draft';

/** Un `Storage` en mémoire : le navigateur n'est pas disponible sous Vitest. */
function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('saveDraft / loadDraft aller-retour', () => {
  it('rend un brouillon identique', () => {
    const storage = fakeStorage() as unknown as Storage;
    const draft = { ...freshDraft(), name: 'mon-projet', targets: ['web'] };
    saveDraft(storage, draft);
    expect(loadDraft(storage)).toEqual(draft);
  });

  it('conserve les champs optionnels quand ils sont remplis', () => {
    const storage = fakeStorage() as unknown as Storage;
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      mode: 'expert' as const,
      type: 'saas',
      architecture: 'single-app',
      technologies: ['next'],
      capabilities: ['stripe'],
      envVarNames: ['DATABASE_URL'],
      infra: { docker: true, ci: true },
    };
    saveDraft(storage, draft);
    expect(loadDraft(storage)).toEqual(draft);
  });
});

describe('variables ajoutées à la main (`customEnv`)', () => {
  it('survivent au rechargement, et un nom invalide relu est écarté', () => {
    const storage = fakeStorage() as unknown as Storage;
    saveDraft(storage, { ...freshDraft(), name: 'app', customEnv: ['API_URL'] });
    expect(loadDraft(storage).customEnv).toEqual(['API_URL']);

    const raw = JSON.parse(storage.getItem('pf-draft') ?? '{}') as Record<string, unknown>;
    storage.setItem('pf-draft', JSON.stringify({ ...raw, customEnv: ['ok_non', 'BON'] }));
    expect(loadDraft(storage).customEnv).toEqual(['BON']);
  });

  it('une liste vide n’est pas persistée', () => {
    const storage = fakeStorage() as unknown as Storage;
    saveDraft(storage, { ...freshDraft(), customEnv: [] });
    expect('customEnv' in loadDraft(storage)).toBe(false);
  });
});

describe('loadDraft une reprise impossible rend un brouillon frais, jamais un crash', () => {
  it('sans storage', () => {
    expect(loadDraft(null)).toEqual(freshDraft());
  });

  it('avec du JSON corrompu', () => {
    const storage = fakeStorage({ 'pf-draft': '{oops' }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('avec une version antérieure ou future', () => {
    const ancien = JSON.stringify({ ...freshDraft(), version: DRAFT_VERSION - 1 });
    const storage = fakeStorage({ 'pf-draft': ancien }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('avec des champs manquants', () => {
    const storage = fakeStorage({ 'pf-draft': '{"version":1}' }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('avec du JSON qui n’est pas un objet', () => {
    const storage = fakeStorage({ 'pf-draft': '"une chaîne"' }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('avec un tableau au lieu d’un objet', () => {
    const storage = fakeStorage({ 'pf-draft': '[1,2]' }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('une étape inconnue retombe sur la première, le reste est conservé', () => {
    const storage = fakeStorage({
      'pf-draft': JSON.stringify({ ...freshDraft(), step: 'ecran-disparu', name: 'ok' }),
    }) as unknown as Storage;
    const draft = loadDraft(storage);
    expect(draft.step).toBe('create');
    expect(draft.name).toBe('ok');
  });

  it('des champs mal typés sont ignorés, pas recopiés', () => {
    const storage = fakeStorage({
      'pf-draft': JSON.stringify({
        version: DRAFT_VERSION,
        name: 'ok',
        targets: ['web', 42],
        technologies: 'next',
        envVarNames: [null],
        infra: 'oui',
        mode: 'bidouille',
        type: '',
      }),
    }) as unknown as Storage;
    const draft = loadDraft(storage);
    expect(draft.targets).toEqual(['web']);
    expect(draft.technologies).toEqual([]);
    expect(draft.envVarNames).toEqual([]);
    expect(draft.infra).toEqual({ docker: false, ci: false });
    expect(draft.mode).toBe('guided');
    expect(draft.type).toBeUndefined();
  });
});

describe('§6.8 aucune valeur sensible dans le brouillon', () => {
  it('les variables d’environnement ne portent que des noms', () => {
    const draft = freshDraft();
    expect(draft.envVarNames).toEqual([]);
    expect(Object.keys(draft)).not.toContain('envVars');
    expect(JSON.stringify(draft)).not.toContain('value');
  });

  it('la résolution du moteur est transitoire : saveDraft ne la persiste pas', () => {
    const storage = fakeStorage() as unknown as Storage;
    const draft = {
      ...freshDraft(),
      resolution: { status: 'certified' as const, issues: [] },
    };
    saveDraft(storage, draft);
    expect(loadDraft(storage).resolution).toBeUndefined();
    expect(storage.getItem('pf-draft')).not.toContain('resolution');
  });

  it('la forme persistée est écrite champ par champ, jamais recopiée du brouillon', () => {
    const storage = fakeStorage() as unknown as Storage;
    saveDraft(storage, freshDraft());
    const persisted: unknown = JSON.parse(storage.getItem('pf-draft') ?? '{}');
    expect(Object.keys(persisted as Record<string, unknown>).sort()).toEqual([
      'capabilities',
      'envVarNames',
      'infra',
      'mode',
      'name',
      'step',
      'targets',
      'technologies',
      'version',
    ]);
  });
});

describe('samePersistedDraft ce qui part dans localStorage, et rien d’autre', () => {
  it('vrai pour deux brouillons frais distincts', () => {
    expect(samePersistedDraft(freshDraft(), freshDraft())).toBe(true);
  });

  it('faux dès qu’un champ persisté diffère', () => {
    expect(samePersistedDraft(freshDraft(), { ...freshDraft(), name: 'x' })).toBe(false);
    expect(samePersistedDraft(freshDraft(), { ...freshDraft(), targets: ['web'] })).toBe(false);
    expect(samePersistedDraft(freshDraft(), { ...freshDraft(), mode: 'expert' })).toBe(false);
    expect(
      samePersistedDraft(freshDraft(), { ...freshDraft(), infra: { docker: true, ci: false } }),
    ).toBe(false);
    expect(samePersistedDraft(freshDraft(), { ...freshDraft(), step: 'stack' })).toBe(false);
  });

  it('ignore resolution, qui n’est jamais persistée', () => {
    const avecResolution = {
      ...freshDraft(),
      resolution: { status: 'certified' as const, issues: ['un point à corriger'] },
    };
    expect(samePersistedDraft(freshDraft(), avecResolution)).toBe(true);
  });

  it('compare l’ordre des tableaux : strict, donc jamais un faux « identique »', () => {
    const a = { ...freshDraft(), targets: ['web', 'mobile'] };
    const b = { ...freshDraft(), targets: ['mobile', 'web'] };
    expect(samePersistedDraft(a, b)).toBe(false);
  });

  it('vrai pour un brouillon relu depuis le stockage, sans la résolution', () => {
    const storage = fakeStorage() as unknown as Storage;
    const draft = { ...freshDraft(), name: 'mon-projet', targets: ['web'] };
    saveDraft(storage, draft);
    expect(samePersistedDraft(loadDraft(storage), draft)).toBe(true);
  });
});

describe('restorePersistedDraft le stockage relu, sans défaire la mémoire', () => {
  it('ce qui a changé en mémoire depuis la création du store gagne', () => {
    const baseline = freshDraft();
    const current = { ...baseline, step: 'stack' as const };
    const restored = restorePersistedDraft({ ...baseline, step: 'blueprint' }, current, baseline);
    expect(restored.step).toBe('stack');
  });

  it('les champs que la mémoire n’a pas touchés viennent du stockage', () => {
    const baseline = freshDraft();
    const stored = { ...baseline, name: 'repris', targets: ['web'] };
    const restored = restorePersistedDraft(stored, baseline, baseline);
    expect(restored.name).toBe('repris');
    expect(restored.targets).toEqual(['web']);
  });

  it('un tableau de même valeur garde sa référence : c’est ce que lit useMemo', () => {
    const baseline = freshDraft();
    const current = { ...baseline, step: 'stack' as const };
    const restored = restorePersistedDraft({ ...baseline }, current, baseline);
    expect(restored.targets).toBe(current.targets);
    expect(restored.technologies).toBe(current.technologies);
    expect(restored.step).toBe('stack');
  });

  it('un tableau de valeur différente vient du stockage', () => {
    const baseline = freshDraft();
    const restored = restorePersistedDraft(
      { ...baseline, technologies: ['next'] },
      baseline,
      baseline,
    );
    expect(restored.technologies).toEqual(['next']);
    expect(restored.technologies).not.toBe(baseline.technologies);
  });

  it('un tableau changé en mémoire n’est pas écrasé par le stockage', () => {
    const baseline = freshDraft();
    const current = { ...baseline, targets: ['mobile'] };
    const restored = restorePersistedDraft({ ...baseline, targets: ['web'] }, current, baseline);
    expect(restored.targets).toBe(current.targets);
  });

  it('la résolution n’est pas restaurée : elle n’est jamais persistée', () => {
    const baseline = freshDraft();
    const restored = restorePersistedDraft(
      { ...baseline, resolution: { status: 'certified', issues: ['x'] } },
      baseline,
      baseline,
    );
    expect(restored.resolution).toBeUndefined();
  });
});

describe('clearDraft', () => {
  it('oublie le brouillon', () => {
    const storage = fakeStorage() as unknown as Storage;
    saveDraft(storage, { ...freshDraft(), name: 'x' });
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('sans storage ne lève pas', () => {
    expect(() => clearDraft(null)).not.toThrow();
    expect(() => saveDraft(null, freshDraft())).not.toThrow();
  });
});

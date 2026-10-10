import { describe, expect, it } from 'vitest';
import { clearDraft, DRAFT_VERSION, freshDraft, loadDraft, saveDraft } from './draft';

/** Un `Storage` en mémoire : le navigateur n'est pas disponible sous Vitest. */
function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('saveDraft / loadDraft — aller-retour', () => {
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

describe('loadDraft — une reprise impossible rend un brouillon frais, jamais un crash', () => {
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

describe('§6.8 — aucune valeur sensible dans le brouillon', () => {
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

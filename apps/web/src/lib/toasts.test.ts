import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Le store des toasts porte un état de module (liste active + compteur d'ids) :
 * chaque test le recharge à neuf via `import()`, sinon l'état d'un test fuit
 * dans le suivant et l'ordre d'exécution décide du résultat. Les fausses
 * horloges sont posées **avant** le chargement pour que les minuteurs armés
 * par le store soient bien ceux qu'on avance.
 */
async function chargeStore(): Promise<typeof import('./toasts')> {
  vi.resetModules();
  return await import('./toasts');
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toast', () => {
  it('notifie les abonnés', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    const seen: string[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(...toasts.map((t) => t.message)));

    toast('projet généré', { kind: 'success' });

    expect(seen).toEqual(['projet généré']);
    unsubscribe();
  });

  it("notifie immédiatement l'abonné avec l'état courant", async () => {
    const { subscribeToasts, toast } = await chargeStore();
    toast('déjà là', { kind: 'error' });

    const seen: string[][] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.map((t) => t.message)));

    expect(seen).toEqual([['déjà là']]);
    unsubscribe();
  });

  it('expose kind et id stables, kind info par défaut', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    const kinds: string[] = [];
    const ids: number[] = [];
    const unsubscribe = subscribeToasts((toasts) => {
      const dernier = toasts.at(-1);
      if (dernier !== undefined) {
        kinds.push(dernier.kind);
        ids.push(dernier.id);
      }
    });

    toast('sans options');
    toast('en erreur', { kind: 'error' });

    expect(kinds).toEqual(['info', 'error']);
    expect(ids[0]).not.toBe(ids[1]);
    unsubscribe();
  });

  it('expire au bout de la durée demandée (fausses horloges)', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.length));

    toast('éphémère', { durationMs: 5_000 });
    expect(seen.at(-1)).toBe(1);

    vi.advanceTimersByTime(4_999);
    expect(seen.at(-1)).toBe(1);

    vi.advanceTimersByTime(1);
    expect(seen.at(-1)).toBe(0);
    unsubscribe();
  });

  it('applique la durée par défaut quand durationMs est absent', async () => {
    const { subscribeToasts, toast, DEFAULT_DURATION_MS } = await chargeStore();
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.length));

    toast('sans durée');
    expect(DEFAULT_DURATION_MS).toBe(4_000);
    expect(seen.at(-1)).toBe(1);

    vi.advanceTimersByTime(DEFAULT_DURATION_MS - 1);
    expect(seen.at(-1)).toBe(1);

    vi.advanceTimersByTime(1);
    expect(seen.at(-1)).toBe(0);
    unsubscribe();
  });

  it("une durée explicite l'emporte sur celle par défaut", async () => {
    const { subscribeToasts, toast, DEFAULT_DURATION_MS } = await chargeStore();
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.length));

    toast('long', { durationMs: DEFAULT_DURATION_MS * 3 });
    vi.advanceTimersByTime(DEFAULT_DURATION_MS);
    expect(seen.at(-1)).toBe(1);

    vi.advanceTimersByTime(DEFAULT_DURATION_MS * 2);
    expect(seen.at(-1)).toBe(0);
    unsubscribe();
  });

  it('un toast expiré ne retire pas ses voisins', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    const seen: string[][] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.map((t) => t.message)));

    toast('bref', { durationMs: 1_000 });
    toast('long', { durationMs: 9_000 });
    vi.advanceTimersByTime(1_000);

    expect(seen.at(-1)).toEqual(['long']);
    unsubscribe();
  });
});

describe('subscribeToasts', () => {
  it('se désabonner cesse les notifications', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    let appels = 0;
    const unsubscribe = subscribeToasts(() => {
      appels += 1;
    });
    // L'abonnement notifie une fois l'état courant.
    expect(appels).toBe(1);

    unsubscribe();
    toast('personne ne doit le voir', { kind: 'error' });

    expect(appels).toBe(1);
  });

  it('plusieurs abonnés reçoivent le même état', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    const vus: string[][] = [];
    const premier = subscribeToasts((toasts) => vus.push(toasts.map((t) => t.message)));
    const second = subscribeToasts((toasts) => vus.push(toasts.map((t) => t.message)));

    toast('partagé');

    expect(vus.at(-1)).toEqual(vus.at(-2));
    expect(vus.at(-1)).toEqual(['partagé']);
    premier();
    second();
  });

  it('se désabonner deux fois ne lève pas et ne notifie plus', async () => {
    const { subscribeToasts, toast } = await chargeStore();
    let appels = 0;
    const unsubscribe = subscribeToasts(() => {
      appels += 1;
    });

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();

    toast('après double désabonnement');
    expect(appels).toBe(1);
  });

  it("les abonnés voient la même référence tant que l'état n'a pas changé", async () => {
    const { subscribeToasts, toast } = await chargeStore();
    const references: (readonly unknown[])[] = [];
    const premier = subscribeToasts((toasts) => references.push(toasts));
    const second = subscribeToasts((toasts) => references.push(toasts));

    toast('une fois');

    // React (`useSyncExternalStore`) compare les instantanés par identité :
    // deux abonnés du même état doivent recevoir le même tableau.
    expect(references.at(-1)).toBe(references.at(-2));
    premier();
    second();
  });
});

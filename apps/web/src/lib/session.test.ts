import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import { createSessionStore, toggle } from './session';

/** Un `Storage` en mémoire : le navigateur n'est pas disponible sous Vitest. */
function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('createSessionStore', () => {
  it('part du brouillon persisté quand il existe', () => {
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), name: 'repris' }));
    const session = createSessionStore(storage as unknown as Storage);
    expect(session.get().name).toBe('repris');
  });

  it('sans storage, part d’un brouillon frais', () => {
    expect(createSessionStore(null).get()).toEqual(freshDraft());
  });

  it('chaque changement est persisté : fermer l’onglet ne perd rien', () => {
    const storage = fakeStorage() as unknown as Storage;
    const session = createSessionStore(storage);
    session.update((draft) => ({ ...draft, name: 'mon-projet' }));
    const reread = createSessionStore(storage);
    expect(reread.get().name).toBe('mon-projet');
  });

  it('le changement voit l’état courant, pas une copie figée', () => {
    const session = createSessionStore(null, { ...freshDraft(), name: 'avant' });
    session.update((draft) => ({ ...draft, name: `${draft.name}-apres` }));
    expect(session.get().name).toBe('avant-apres');
  });

  it('notifie les abonnés, et seulement ceux qui sont abonnés', () => {
    const session = createSessionStore(null);
    let abonne = 0;
    let retire = 0;
    const unsubscribe = session.subscribe(() => {
      abonne += 1;
    });
    const retireFn = session.subscribe(() => {
      retire += 1;
    });
    session.update((draft) => ({ ...draft, name: 'a' }));
    unsubscribe();
    session.update((draft) => ({ ...draft, name: 'b' }));

    expect(abonne).toBe(1);
    expect(retire).toBe(2);
    // Se désabonner deux fois ne lève pas et ne double rien.
    expect(() => unsubscribe()).not.toThrow();
    retireFn();
  });

  it('reset oublie le brouillon du navigateur, pas seulement la mémoire', () => {
    const storage = fakeStorage();
    const session = createSessionStore(storage as unknown as Storage);
    session.update((draft) => ({ ...draft, name: 'a-oublier' }));
    session.reset();
    expect(session.get()).toEqual(freshDraft());
    expect(storage.getItem('pf-draft')).toBeNull();
  });

  it('la référence ne change pas tant que rien ne change', () => {
    const session = createSessionStore(null);
    expect(session.get()).toBe(session.get());
  });

  it('attach branche le stockage tardivement et relit le brouillon', () => {
    // Ce que fait le provider : rendu serveur sans stockage, puis branchement
    // du `localStorage` dans un effet, une fois l'hydratation faite.
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), name: 'persiste' }));
    const session = createSessionStore(null);
    expect(session.get().name).toBe('');

    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(storage as unknown as Storage);

    expect(session.get().name).toBe('persiste');
    expect(notifie).toBe(1);
  });

  it('attach à un stockage vide repart d’un brouillon frais', () => {
    const session = createSessionStore(null, { ...freshDraft(), name: 'à-oublier' });
    session.attach(fakeStorage() as unknown as Storage);
    expect(session.get()).toEqual(freshDraft());
  });
});

describe('toggle', () => {
  it('ajoute ce qui manque, retire ce qui est là, sans muter la liste', () => {
    const initial = ['web'];
    expect(toggle(initial, 'mobile')).toEqual(['web', 'mobile']);
    expect(toggle(initial, 'web')).toEqual([]);
    expect(initial).toEqual(['web']);
  });
});
